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

function windowWatcher(subject, topic) {
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
}

/*
 bootstrap.js API
*/
function startup(aData, aReason) {
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
}

function shutdown(aData, aReason) {
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

function uninstall(aData, aReason) { }

