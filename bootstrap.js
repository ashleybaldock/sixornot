/* Original code from http://starkravingfinkle.org/blog/2011/01/bootstrap-jones-adventures-in-restartless-add-ons/, modified with thanks to Mark Finkle */

// See: http://www.oxymoronical.com/experiments/apidocs/interface/nsIWindowMediatorListener for description of this object's structure
/*let sixornot_winlistener = {
    onOpenWindow: function(aWindow) {
        // Wait for the window to finish loading
        let domWindow = aWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowInternal);
        domWindow.addEventListener("load", function() {
            Components.utils.reportError("domWindow.addEventListener called");
            domWindow.removeEventListener("load", arguments.callee, false);
            Sixornot.init(domWindow);
        }, false);
    },
    onCloseWindow: function(aWindow) { },
    onWindowTitleChange: function(aWindow, aTitle) { }
}*/

/*function windowWatcher(subject, topic) {
    if (topic != "domwindowopened") return;

    subject.addEventListener("load", function () {
        subject.removeEventListener("load", arguments.callee, false);

        // Now that the window has loaded, only register on browser windows
        let doc = subject.document.documentElement;
        if (doc.getAttribute("windowtype") == "navigator:browser") 
        {
            Sixornot.init(subject);
        }
    }, false);
} */


/*
    Constants and global variables
*/
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const BUTTON_ID     = "sixornot-buttonid",
      ADDRESSBAR_ID = "sixornot-addressbarid",
      PREF_TOOLBAR  = "toolbar",
      PREF_NEXTITEM = "nextitem";

const PREF_BRANCH_SIXORNOT = Services.prefs.getBranch("extensions.sixornot.");

const PREFS = {
   enable:    false,
   nextitem:  "bookmarks-menu-button-container",
   toolbar:   "nav-bar"
};

let PREF_OBSERVER = {
  observe: function(aSubject, aTopic, aData) {
    if ("nsPref:changed" != aTopic || !PREFS[aData]) return;
    runOnWindows(function(win) {
      win.document.getElementById(KEY_ID).setAttribute(aData, getPref(aData));
      addMenuItem(win);
    });
  }
}

/*
    ipv6 only                   6only_16.png, 6only_24.png
    ipv4+ipv6 w/ local ipv6     6and4_16.png, 6and4_24.png
    ipv4+ipv6 w/o local ipv6    4pot6_16.png, 4pot6_24.png
    ipv4 only                   4only_16.png, 4only_24.png
    Unknown                     other_16.png, other_24.png
*/
let s6only_16 = "", s6and4_16 = "", s4pot6_16 = "", s4only_16 = "", sother_16 = "";
let s6only_24 = "", s6and4_24 = "", s4pot6_24 = "", s4only_24 = "", sother_24 = "";

(function(global) global.include = function include(src) (
    Services.scriptloader.loadSubScript(src, global)))(this);

/*
    Core functionality
*/
function main(win) {
    consoleService.logStringMessage("Sixornot - main");
    let doc = win.document;

    // Add iconized button
    let (toggleButton = doc.createElementNS(NS_XUL, "toolbarbutton")) {
        toggleButton.setAttribute("id", BUTTON_ID);
        toggleButton.setAttribute("label", getLocalizedStr("label"));
        toggleButton.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional");

        toggleButton.setAttribute("tooltiptext", getLocalizedStr("tt_default"));
        toggleButton.style.listStyleImage = "url('" + sother_16 + "')";

//        toggleButton.addEventListener("command", toggle, true);
        $(doc, "navigator-toolbox").palette.appendChild(toggleButton);
 
        // Move to location specified in prefs
        let toolbarId = PREF_BRANCH_SIXORNOT.getCharPref(PREF_TOOLBAR);
        let toolbar = toolbarId && $(doc, toolbarId);
        if (toolbar) {
            let nextItem = $(doc, PREF_BRANCH_SIXORNOT.getCharPref(PREF_NEXTITEM));
            toolbar.insertItem(BUTTON_ID, nextItem && nextItem.parentNode.id == toolbarId && nextItem);
        }

        win.addEventListener("aftercustomization", toggleCustomize, false);
    }

    // Add address bar icon

    unload(function() {
        let button = $(doc, BUTTON_ID) || $($(doc,"navigator-toolbox").palette, BUTTON_ID);
        button && button.parentNode.removeChild(button);

        win.removeEventListener("aftercustomization", toggleCustomize, false);
    }, win);
}



/*
    bootstrap.js API
*/
// NEW
function startup(data) AddonManager.getAddonByID(data.id, function(addon) {
    consoleService.logStringMessage("Sixornot - setInitialPrefs");
    setInitialPrefs();
    include(addon.getResourceURI("includes/utils.js").spec);
    include(addon.getResourceURI("includes/locale.js").spec);

    initLocalization(addon, "sixornot.properties");
    s6only_16 = addon.getResourceURI("images/6only_16.png").spec;
    s6and4_16 = addon.getResourceURI("images/6and4_16.png").spec;
    s4pot6_16 = addon.getResourceURI("images/4pot6_16.png").spec;
    s4only_16 = addon.getResourceURI("images/4only_16.png").spec;
    sother_16 = addon.getResourceURI("images/other_16.png").spec;
    s6only_24 = addon.getResourceURI("images/6only_24.png").spec;
    s6and4_24 = addon.getResourceURI("images/6and4_24.png").spec;
    s4pot6_24 = addon.getResourceURI("images/4pot6_24.png").spec;
    s4only_24 = addon.getResourceURI("images/4only_24.png").spec;
    sother_24 = addon.getResourceURI("images/other_24.png").spec;

    watchWindows(main);

    let prefs = PREF_BRANCH_SIXORNOT;
    prefs = prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
    prefs.addObserver("", PREF_OBSERVER, false);

    unload(function() prefs.removeObserver("", PREF_OBSERVER));
});

// NEW
function shutdown(data, reason) {
    consoleService.logStringMessage("Sixornot - shutdown");
    if (reason !== APP_SHUTDOWN) unload();
}

// NEW
function install(){
    consoleService.logStringMessage("Sixornot - install");
    setInitialPrefs();
}

// NEW
function uninstall(){
    consoleService.logStringMessage("Sixornot - uninstall");
// If this is due to an upgrade then don't delete preferences?
// Some kind of upgrade function to potentially upgrade preference settings may be required
//   let value = PREF_BRANCH_HTML5TOGGLE.getBoolPref("enable");
    PREF_BRANCH_SIXORNOT.deleteBranch("");             
//   PREF_BRANCH_HTML5.setBoolPref('enable', value);
}




// OLD
/*function startup(aData, aReason) {
    Components.utils.import("resource://gre/modules/Services.jsm");

    // Set up access to resource: URIs
    let alias = Services.io.newFileURI(aData.installPath);
    if (!aData.installPath.isDirectory())
    {
        alias = Services.io.newURI("jar:" + alias.spec + "!/", null, null);
    }
    Services.io.getProtocolHandler("resource").QueryInterface(Components.interfaces.nsIResProtocolHandler).setSubstitution("sixornot", alias);

    // Import sixornot module as a singleton (only ever one of these even if imported multiple times)
    Components.utils.import("resource://sixornot/sixornot.js");

    // Load into any existing windows
    // https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIWindowMediator
    let enumerator = Services.wm.getEnumerator("navigator:browser");
    while (enumerator.hasMoreElements()) {
        let win = enumerator.getNext().QueryInterface(Components.interfaces.nsIDOMWindow);
        // Now that the window has loaded, only register on browser windows
        let doc = win.document.documentElement;
        if (doc.getAttribute("windowtype") == "navigator:browser") 
        {
            Sixornot.init(win);
        }
    }

    // Load into any new windows
    Services.ww.registerNotification(windowWatcher);
} */

// OLD
/*function shutdown(aData, aReason) {
    // When the application is shutting down we normally don't have to clean up any UI changes
    if (aReason == APP_SHUTDOWN) return;

    // Remove listener placed on window mediator
    Services.ww.unregisterNotification(windowWatcher);

    // Unload from any existing windows
    let enumerator = Services.wm.getEnumerator("navigator:browser");
    while (enumerator.hasMoreElements()) {
        let win = enumerator.getNext().QueryInterface(Components.interfaces.nsIDOMWindow);
        // This is called for every window open, but calling it once destroys icon for all windows open, so this is slightly redundant
        Sixornot.shutdown()
    }

    // Remove our resource: package registration
    Services.io.getProtocolHandler("resource").QueryInterface(Components.interfaces.nsIResProtocolHandler).setSubstitution("sixornot", null);
}

function install(aData, aReason) { }

function uninstall(aData, aReason) { } */


/*
    Utility functions
*/

// Update preference which determines location of button when loading into new windows
function toggleCustomize(event) {
    consoleService.logStringMessage("Sixornot - toggleCustomize");
   let toolbox = event.target, toolbarId, nextItemId;
   let button = $(toolbox.parentNode, BUTTON_ID);
   if (button) {
      let parent = button.parentNode,
          nextItem = button.nextSibling;
      if (parent && parent.localName == "toolbar") {
          toolbarId = parent.id;
          nextItemId = nextItem && nextItem.id;
      }
   }
   PREF_BRANCH_SIXORNOT.setCharPref(PREF_TOOLBAR,  toolbarId || "");
   PREF_BRANCH_SIXORNOT.setCharPref(PREF_NEXTITEM, nextItemId || "");
}

// Return preference value, either from prefs store or from internal defaults
function getPref(name) {
    consoleService.logStringMessage("Sixornot - getPref");
   try {
      return PREF_BRANCH_SIXORNOT.getComplexValue(name, Ci.nsISupportsString).data;
   } catch(e){}
   return PREFS[name];
}

// Proxy to getElementById
function $(node, childId) {
   if (node.getElementById) {
      return node.getElementById(childId);
   } else {
      return node.querySelector("#" + childId);
   }
}

// Set up initial values for preferences
function setInitialPrefs() {
    consoleService.logStringMessage("Sixornot - setInitialPrefs");
   let branch = PREF_BRANCH_SIXORNOT;
   for (let [key, val] in Iterator(PREFS)) {
      switch (typeof val) {
         case "boolean":
            branch.setBoolPref(key, val);
            break;
         case "number":
            branch.setIntPref(key, val);
            break;
         case "string":
            branch.setCharPref(key, val);
            break;
      }
   }

   // save the current value of the html5.enable preference
//   let value = PREF_BRANCH_HTML5.getBoolPref("enable");
//   PREF_BRANCH_HTML5TOGGLE.setBoolPref('enable', value);
}

// Lazy getter services
function defineLazyGetter(getterName, getterFunction)
{
    this.__defineGetter__(getterName, function() {
        delete this[getterName];
        return this[getterName] = getterFunction.apply(this);
    });
}

defineLazyGetter("consoleService", function() {
    return Components.classes["@mozilla.org/consoleservice;1"]
                     .getService(Components.interfaces.nsIConsoleService);
});

