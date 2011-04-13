/* This is a JavaScript module (JSM) to be imported via Components.utils.import() and acts as a singleton.
   Only the following listed symbols will exposed on import, and only when and where imported. */

/* This library is based on the excellent Flagfox addon by Dave Garrett
See flagfox.net for more information */

// TODO
/*
    Display local DNS name on tooltip
    Italics for link-local local IPs
    Banner notifications to explain things like IPv6-only sites with no local v6, and the consequences of having no local v6
    Banner to advise on places to go in order to get v6 tunnels etc.?
    Preferences - turn ctypes usage on/off
    Detecting type of IPv6 local address and alter display of icon accordingly
    Information added to popup to explain what the icon means
    Menu on-click of the icon to allow you to copy IP addresses to clipboard
*/

const EXPORTED_SYMBOLS = ["Sixornot"];

var SixornotVersion = "1";  // Fetched on startup; value here is a fallback

var mainPrefListener = null;
var warningsThisSession = [];

var iconsThisSession = [];

var hotKeys;
var hotClicks;

var actionsList = null;  // Loaded actions list (array of {name, template} with optional properties {iconclick, hotkey, show, custom})
var actionsListAge = 0;
var actionsSaveIsInProgress = false;

//// Main startup, shutdown, and event handling /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* ready === undefined  -->  not yet started
   ready === null       -->  aborted startup
   ready === false      -->  startup in progress
   ready === true       -->  ready to do lookups */
var ready = undefined;

function startup()
{
    ready = false;  // Starting up...

    function handleStartupError(e)
    {
        ready = null;
        Sixornot.error("Fatal Sixornot startup error!",e);
        shutdown();
    }

    try
    {
        const id = "sixornot@entropy.me.uk";  // Sixornot ID

        if ("@mozilla.org/extensions/manager;1" in Components.classes)  // Gecko 1.9.x
        {
            var ExtensionManager = Components.classes["@mozilla.org/extensions/manager;1"]
                                             .getService(Components.interfaces.nsIExtensionManager);
            SixornotVersion = ExtensionManager.getItemForID(id)
                                             .version;
            ready = true;
        }
        else  // Gecko 2.0+
        {
            Components.utils.import("resource://gre/modules/AddonManager.jsm");
            AddonManager.getAddonByID(id, function(addon) {
                try {
                    SixornotVersion = addon.version;
                    ready = true;
                } catch (e) { handleStartupError(e); }  // This callback is outside of the exception catching for startup()
            });
        }

//        Sixornot.actions.load();

//        migrateOldPrefs();
//        mergeDefaultActionUpdates();

        mainPrefListener = new PrefListener("sixornot.",onGlobalPrefChange);

        // Queue up final shutdown sequence; each window has its own unload sequence as well
        doOnShutdown(shutdown);
    }
    catch (e) { handleStartupError(e); }
}

function shutdown()
{
    if (mainPrefListener)
        mainPrefListener.unregister();
}

function onGlobalPrefChange(branch,prefName)
{
    switch (prefName)
    {
        case "actions":
            if (!actionsSaveIsInProgress)  // Reload if this wasn't our doing (manual pref edit/reset or Mozilla Weave Sync)
            {
                Sixornot.actions.load();
                mergeDefaultActionUpdates();  // Make sure changes to defaults list are handled correctly
            }
            return;

        case "showfavicons":
            actionsListAge = Date.now();  // All menus will need to be updated
            return;

        case "warn.tld":
        case "warn.proxy":
            if (!branch.prefHasUserValue(prefName))
                warningsThisSession = [];  // Reset list on pref reset
            return;
    }
}

//// Main Sixornot object (only variable exported out of this file) //////////////////////////////////////////////////////////////////////////////////////////////////////
var Sixornot =
{
    init : function(window)
    {
        // Startup if this is the first time the module has been imported
        if (ready === undefined)
        {
            consoleService.logStringMessage("Sixornot - startup requested");
            startup();
        }

        // If startup was aborted before for some reason don't try again this session
        if (ready === null)
        {
            return;
        }

        // Import ctypes module
        Components.utils.import("resource://gre/modules/ctypes.jsm");

        // Init DnsHandler
        DnsHandler.init()

        // Load the icon for this window, add created icon to the list we need to clean up on shutdown
        try
        {
            consoleService.logStringMessage("Sixornot - loading icon for new window");
            iconsThisSession.push(newIconInstance(window));
        }
        catch (e)
        {
            Sixornot.error("Error loading icon for window", e);
        }
    },

    shutdown : function(window)
    {
        function removeicon(element, index, array) {
            consoleService.logStringMessage("Sixornot - unloading icon");
            try
            {
                // This calls the unload() method of each icon, if element is already unloaded this does nothing
                element();
            }
            catch (e)
            {
                consoleService.logStringMessage(e);
            }
        }
        if (ready)
        {
            consoleService.logStringMessage("Sixornot - shutdown requested");
            consoleService.logStringMessage("Number of icons created this session: " + iconsThisSession.length);
            iconsThisSession.forEach(removeicon);
            // Clear list of icons as they are now all unloaded - I think they will be freed from memory at this point?
            iconsThisSession = [];
            shutdown();
        }
        DnsHandler.shutdown();
    },

    warning : function(window, pref, message)  // Shows a slide-down info bar (max once per session for each unique message)
    {
        if (prefService.getCharPref(pref) == "disabled")  // Valid states are: "enabled", "once", & "disabled"
            return;  // Disabled by user

        var messageID = hashString(message);
        if (warningsThisSession.indexOf(messageID)!=-1)
            return;  // Shown before this session
        warningsThisSession.push(messageID);

        var notificationBox = window.getBrowser().getNotificationBox();

        const XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
        var notification = window.document.createElementNS(XULNS,"notification");
        notification.setAttribute("type","warning");
        notification.setAttribute("priority",notificationBox.PRIORITY_WARNING_MEDIUM);
        notification.setAttribute("value",pref);
        notification.setAttribute("image","chrome://sixornot/content/icons/help.png");
        notification.setAttribute("label",message);

        var checkbox = window.document.createElementNS(XULNS,"checkbox");
        if (prefService.getCharPref(pref) == "once")  // If pref is "once", default to checked
        {
            checkbox.setAttribute("checked",true);
            prefService.setCharPref(pref,"disabled");
        }
        function onCheckboxToggled(event)
        {
            prefService.setCharPref(pref, event.target.checked ? "disabled" : "enabled");
        }
        checkbox.addEventListener("command",onCheckboxToggled,false);
        checkbox.setAttribute("label",strings.GetStringFromName("warnchecklabel"));
        notification.appendChild(checkbox);

        notification.setAttribute("persistence",100);  // Also give it a second of persistence to prevent accidental hide without user interaction
        window.setTimeout(function(){notification.removeAttribute("persistence");},1000);

        notificationBox.appendChild(notification);  // Add and show notification
        if (notificationBox._showNotification)
            notificationBox._showNotification(notification,true);  // Do slide animation (HACK: undocumented method...)

        // Fire event for accessibility APIs
        var event = window.document.createEvent("Events");
        event.initEvent("AlertActive", true, true);
        notification.dispatchEvent(event);
    },

    error : function(message,exception)  // This is more error info than others might do, but users have a bad habit of ignoring you if you don't ask for feedback
    {
        if (!message)
            message = "Unknown error!";

        logErrorMessage("Sixornot ERROR: " + message + " \n" + parseException(exception));

        try
        {
            // No L10N: We only speak English (well) and thus our forums and the problems reported on them need to be in English. Sorry.
            var outputMsg = "Sorry, the Sixornot extension has encountered a problem. " +
                            "The following error output and a Sixornot preferences dump has been sent to Tools -> Error Console.\n" +
                            "\n------------------------------------------------------------\n";

//            outputMsg += "FLAGFOX VERSION: " + Sixornot.version + " (" + Sixornot.getIPDBversion() + ")\n";

            outputMsg += "\nERROR MESSAGE: " + message + "\n";
            if (exception)
            {
                outputMsg += "\nEXCEPTION THROWN: " + exception + "\n";
                if (exception.stack)
                    outputMsg += "\nSTACK TRACE:\n" + cleanExceptionStack(exception.stack);  // ends with "\n"
            }

            try { logErrorMessage("Sixornot PREFERENCES DUMP:\n" + getPrefsDump("sixornot.")); }
            catch (prefsDumpError) { outputMsg += "\nEXCEPTION THROWN on preferences dump: " + parseException(prefsDumpError) + "\n"; }

            outputMsg += "\nBROWSER: " + appInfo.vendor + " " + appInfo.name + " " + appInfo.version +
                         " (Gecko " + appInfo.platformVersion + " / " + appInfo.platformBuildID + ")";
            outputMsg += "\nOS: " + httpService.oscpu + " (" + appInfo.OS + " " + appInfo.XPCOMABI + " " + appInfo.widgetToolkit + ")";
            outputMsg += "\nLOCALE: " + Sixornot.locale.content + " content / " + Sixornot.locale.UI + " UI / " + Sixornot.locale.OS + " OS";

            outputMsg += "\n------------------------------------------------------------\n" +
                         "\nSelect and copy the error report above. In order to fix this problem for you and others, please read and follow the " +
                         "troubleshooting and bug reporting instructions on the Sixornot support forums. Please post an abundance of information with any " +
                         "error reports, namely what you were doing at the time that may have triggered this. (English please)\n";

            var flags = promptService.BUTTON_POS_0 * promptService.BUTTON_TITLE_IS_STRING +
                        promptService.BUTTON_POS_1 * promptService.BUTTON_TITLE_IS_STRING +
                        promptService.BUTTON_POS_0_DEFAULT;
            var button = promptService.confirmEx( null, "Sixornot Error!", outputMsg, flags, "Go To Support Forums", "Ignore", "", null, {} );

            if (button == 0)  // "Forums" button
            {
                // Open forum in new tab (can't open new window; if error is on startup, we could hit another error)
                Sixornot.addTabInCurrentBrowser("http://sixornot.net/reportingbugs");
            }
        }
        catch (e) { Components.utils.reportError("EXCEPTION DURING FLAGFOX ERROR REPORTING: " + parseException(e)); }
    },

    /* openURL : function(window,url)  // Open URL in a window based on the user's pref
    {
        try
        {
            var openPref = prefService.getCharPref("flagfox.openlinksin");
            if (openPref == "tabBG" || openPref == "tabFG")
            {
                var browser = window.getBrowser();
                try { window.TreeStyleTabService.readyToOpenChildTab(browser.selectedTab); } catch (e) {}  // Support for Tree Style Tab extension
                if (versionComparator.compare(appInfo.platformVersion,"1.9.2") >= 0)
                    var newTab = browser.addTab(url, {ownerTab:browser.selectedTab, relatedToCurrent:true});  // Add tab as child in Firefox 3.6+
                else
                    var newTab = browser.addTab(url, null, null, null, browser.selectedTab);  // Firefox 3.5 & SeaMonkey 2.0 (TODO: drop with dropped Gecko 1.9.1 support)
                if (openPref == "tabFG")
                    browser.selectedTab = newTab;
            }
            else if (openPref == "currentTab")
            {
                window.content.document.location = url;
            }
            else  // "winBG" || "winFG"
            {
                var newWindow = window.open(url,"_blank");
                if (openPref == "winBG")
                {
                    newWindow.blur();
                    window.focus();
                }
            }
        } catch (e) { Flagfox.error("Failed to open URL: "+url,e); }
    }, */

    /* addTabInCurrentBrowser : function(url)  // Add tab to most recent window, regardless of where this function was called from
    {
        var currentWindow = getCurrentWindow();
        currentWindow.focus();
        var currentBrowser = currentWindow.getBrowser();
        currentBrowser.selectedTab = currentBrowser.addTab(url,null,null);
    }, */

    locale :
    {
        get content()  // Firefox primary content locale (user set)
        {
            try
            {
                try { var accept_languages = prefService.getComplexValue("intl.accept_languages",Components.interfaces.nsIPrefLocalizedString).data; }
                catch (e) { var accept_languages = prefService.getCharPref("intl.accept_languages"); }
                return cleanLocaleCode( /^[^\s,;]{2,}/.exec(accept_languages)[0] );  // Extract first locale code in pref (space/comma/semicolon delimited list)
            } catch (e) { return "en"; }
        },
        get UI()  // Sixornot UI locale
        {
            return cleanLocaleCode( Components.classes["@mozilla.org/chrome/chrome-registry;1"]
                                              .getService(Components.interfaces.nsIXULChromeRegistry)
                                              .getSelectedLocale("sixornot") );
        },
        get OS()  // Main OS locale
        {
            return cleanLocaleCode( Components.classes["@mozilla.org/intl/nslocaleservice;1"]
                                              .getService(Components.interfaces.nsILocaleService)
                                              .getSystemLocale()
                                              .getCategory("NSILOCALE_MESSAGES") );
        }
    },

    get strings() { return strings; },
    get helpstrings() { return helpstrings; },
    get countrynames() { return countrynames; },

    get version() { return SixornotVersion; }
};

//// Flag icon instance closure (one per window) ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function newIconInstance(window)
{
    var loaded = false;
    if (!window) return;

    // Init UI
    // Get the anchor for "overlaying" but make sure the UI is loaded
    let urlbaricons = window.document.getElementById("urlbar-icons");
    if (!urlbaricons)
    {
        logErrorMessage("Sixornot warning: attempted to load into an invalid window");
        return;
    }

    // By this point we will need uninit
    loaded = true;

    let starbutton = window.document.getElementById("star-button");

    // Place the new button after the last button in the top set
    let anchor = urlbaricons.nextSibling;

    var box = window.document.createElement("box");
    box.setAttribute("id", "sixornot-button");
    box.setAttribute("width", "16");
    box.setAttribute("height", "16");
    box.setAttribute("align", "center");
    box.setAttribute("pack", "center");

    var icon = window.document.createElement("image");
    icon.setAttribute("id", "sixornot-icon");
    icon.setAttribute("tooltip", "sixornot-tooltip");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    icon.setAttribute("src", "resource://sixornot/skin/icons/sixornot_button_none_16.png");

    var tooltip = window.document.createElement("tooltip");
    tooltip.setAttribute("id", "sixornot-tooltip");

    box.appendChild(icon);
    box.appendChild(tooltip);
    // If star icon visible, insert before it, otherwise just append to urlbaricons
    if (!starbutton)
    {
        urlbaricons.appendChild(box);
    }
    else
    {
        urlbaricons.insertBefore(box, starbutton);
    }

//    let toolbarpalette = window.document.getElementById("BrowserToolbarPalette");
/*    let navbar = window.document.getElementById("urlbar-container");

    var toolbarbutton = window.document.createElement("toolbarbutton");
    toolbarbutton.setAttribute("id", "sixornot-toolbarbutton");
    toolbarbutton.setAttribute("label", "Sixornot");
    toolbarbutton.setAttribute("tooltiptext", "test tooltip");
//    toolbarbutton.setAttribute("style", "list-style-image: url('resource://sixornot/skin/icons/sixornot_button_none_16.png');");
    toolbarbutton.style.listStyleImage = "url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAo0lEQVR42u3VMQrCMBSA4Q7uOnsNB4%2FR0cM6ZPYyyRRIGhAzly5CNQrfD49Alhe%2BJdMkSZIk6d1ijMdSyryelNJp710hhMPWrpzzeRjAsiyX1tpzPf3%2B%2BgnsrV211hsAAAAAAAAAAAAAAAAAAAAAAACA0QDfHAAAAPweQH%2FUo5%2F3PafvCn4BAAAAAAAAAAAAAAAAAAAAAAAAAADGAkiSJOmPewEpGDS2TaImnAAAAABJRU5ErkJggg%3D%3D)";

//    toolbarpalette.appendChild(toolbarbutton);
    navbar.parentNode.appendChild(toolbarbutton); */


    // Taken from: http://blog.fpmurphy.com/2011/02/firefox-4-restartless-add-ons.html

   let doc = window.document;
   // add iconized button
   let (toggleButton = doc.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "toolbarbutton")) {
      toggleButton.setAttribute("id", "sixornot-toolbarbutton");
      toggleButton.setAttribute("label", "sixornot-label");
      toggleButton.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional");
     toggleButton.style.listStyleImage = "url('resource://sixornot/skin/icons/sixornot_button_none_16.png')";
/*      if (value) {
         toggleButton.setAttribute("tooltiptext", getLocalizedStr("onString"));
         toggleButton.style.listStyleImage = "url('" + logo16on + "')";
      } else {
         toggleButton.setAttribute("tooltiptext", getLocalizedStr("offString"));
         toggleButton.style.listStyleImage = "url('" + logo16off + "')";
      } */
//      toggleButton.addEventListener("command", toggle, true);
      $(doc, "navigator-toolbox").palette.appendChild(toggleButton);

/*      // move to location specified in prefs
      let toolbarId = PREF_BRANCH_HTML5TOGGLE.getCharPref(PREF_TOOLBAR);
      let toolbar = toolbarId && $(doc, toolbarId);
      if (toolbar) {
         let nextItem = $(doc, PREF_BRANCH_HTML5TOGGLE.getCharPref(PREF_NEXTITEM));
         toolbar.insertItem(BUTTON_ID, nextItem &&
            nextItem.parentNode.id == toolbarId && nextItem);
      } */

//      win.addEventListener("aftercustomization", toggleCustomize, false);
   }



    // UI init success, init variables
    var contentDoc = null;     // Reference to the current page document object
    var url = "";              // The URL of the current page
    var urlIsPortable = true;  // Is the URL not on this computer?
    var host = "";             // The host name of the current URL
    var ipv4s = [];               // The IP addresses of the current host
    var ipv6s = [];               // The IP addresses of the current host
    var localipv6s = [];         // Local IPv6 addresses
    var localipv4s = [];         // Local IPv4 addresses
    var usingv6 = null;         // True if we can connect to the site using IPv6, false otherwise

//    var icon = window.document.getElementById("sixornot-icon");
//    var menu = window.document.getElementById("sixornot-menu");
//    var tooltip = window.document.getElementById("sixornot-tooltip");
//    if (!icon || !menu || !tooltip)
/*    if (!icon || !tooltip)
    {
        logErrorMessage("Sixornot warning: attempted to load into an invalid window");
        return;
    } */
    consoleService.logStringMessage("Sixornot - loading into valid window");

//    var menuContentAge = 0;
    var specialLocation = null;
    var DNSrequest = null;
    var prefListener = new PrefListener("sixornot.",onPrefChange);
    var pollLoopID = window.setInterval(pollForContentChange,250);

    // Go-go gadget events
//    icon.addEventListener("click",onIconClick,false);
//    icon.addEventListener("mousedown",onIconMouseDown,false);
//    icon.addEventListener("mouseover",onIconHover,false);
//    menu.addEventListener("command",onMenuCommand,false);
//    menu.addEventListener("popupshowing",onMenuShowing,false);
    tooltip.addEventListener("popupshowing",updateTooltipContent,false);
//    window.addEventListener("keypress",onKeyPressed,false);
    window.addEventListener("online",onChangedOnlineStatus,false);
    window.addEventListener("offline",onChangedOnlineStatus,false);
    window.addEventListener("unload",unload,false);

    // Return unload method which is then used during extension shutdown
    return unload;

    function unload()
    {
        // Unload method marks this icon as unloaded and useless
        if (loaded)
        {
            consoleService.logStringMessage("Sixornot - unload method called while loaded");
            window.removeEventListener("unload",unload,false);
            window.removeEventListener("offline",onChangedOnlineStatus,false);
            window.removeEventListener("online",onChangedOnlineStatus,false);
//            window.removeEventListener("keypress",onKeyPressed,false);
            tooltip.removeEventListener("popupshowing",updateTooltipContent,false);
//            menu.removeEventListener("popupshowing",onMenuShowing,false);
//            menu.removeEventListener("command",onMenuCommand,false);
//            icon.removeEventListener("mouseover",onIconHover,false);
//            icon.removeEventListener("mousedown",onIconMouseDown,false);
//            icon.removeEventListener("click",onIconClick,false);
            window.clearInterval(pollLoopID);
            //DnsHandler.cancelRequest(DNSrequest);
            prefListener.unregister();

            // Remove UI
            tooltip.parentNode.removeChild(tooltip);
            icon.parentNode.removeChild(icon);
            box.parentNode.removeChild(box);

            tooltip = null;
//            menu = null;
            icon = null;
            box = null;
//            metaTags = null;
            contentDoc = null;

            loaded = false;
        }
        else
        {
            consoleService.logStringMessage("Sixornot - unload method called while not loaded");
        }

    }

    function pollForContentChange()  // Polling instead of event based to make sure it updates on every page (including error pages)
    {
        try
        {
            if (contentDoc != window.content.document)
                updateState();
        }
        catch (e)
        {
            Components.utils.reportError("Sixornot EXCEPTION: " + parseException(e));
        }
    }

    function updateState()
    {
        if (!ready)  // Startup not finished; wait...
        {
            if (ready === null)  // If aborted, unload
                unload();
            return;
        }

        contentDoc = window.content.document;
        url = contentDoc.location.href;
        urlIsPortable = true;
        host = "";
        ipv6s = [];
        ipv4s = [];
        localipv6s = [];
        localipv4s = [];

        // If we've changed pages before completing a lookup, then abort the old request first
//        DnsHandler.cancelRequest(DNSrequest);
        DNSrequest = null;

        // Tries to update icon based on protocol type (e.g. for local pages which don't need to be looked up)
        // If this fails returns false and we need to do lookup
        if (updateIcon())
            return;

        // Need to look up host
        try { host = contentDoc.location.hostname.cropTrailingChar("."); } catch (e) {}
        if (host == "")
        {
            icon.src = getIconPath("sixornot_button_none_16");
            specialLocation = ["unknownsite"];
            logErrorMessage("Sixornot warning: no host returned for \"" + url + "\"");
            return;
        }

        if (!window.navigator.onLine)
        {
            icon.src = getIconPath("sixornot_button_none_16");
            specialLocation = ["offlinemode"];
            consoleService.logStringMessage("Sixornot is in offline mode");
            return;  // Offline mode or otherwise not connected
        }

        if (DnsHandler.isProxiedDNS(url))
        {
            icon.src = getIconPath("sixornot_button_none_16");
            specialLocation = ["nodnserror"];
            consoleService.logStringMessage("Sixornot is in proxied mode");
            Sixornot.warning(window, "sixornot.warn.proxy", strings.GetStringFromName("proxywarnmessage"));
            return;  // Proxy in use for DNS; can't do a DNS lookup
        }

        // Ideally just hitting the DNS cache here
//        DNSrequest = DnsHandler.resolveHost(host, onReturnedIPs);
        onReturnedIPs(DnsHandler.resolveHostNative(host));

        // Test run the garbage collector
//        window.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils).garbageCollect()
//        window.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils).garbageCollect()

//        Components.utils.forceGC()
//        Components.utils.forceGC()

        function onReturnedIPs(remoteips)
        {
            DNSrequest = null;  // Request complete

            // Test run the garbage collector
//            window.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils).garbageCollect()
//            window.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils).garbageCollect()

//            Components.utils.forceGC()
//            Components.utils.forceGC()

            // This needs to iterate over the set of IP addresses to check whether each one is IPv4 or IPv6
            // Icon colour depends only on whether the site has:
            // a) IPv4 only - Red
            // b) IPv4 and IPv6 - Green
            // c) IPv6 only - Blue
            // Additionally, if we are connecting over IPv6 to the end site (need some way to determine this!)
            // then case b is split:
            // b.1) IPv4 and IPv6, connecting over IPv6 - Green
            // b.2) IPv4 and IPv6, connecting over IPv4 - Orange 
            // Everything else will display a grey icon of some kind to indicate no IP addresses are involved

            if (remoteips[0] == "FAIL")
            {
                icon.src = getIconPath("sixornot_button_none_16");
                specialLocation = ["lookuperror"];
                return;  // DNS lookup failed (ip/countryCode/tldCountryCode stay empty)
            }

            let i = 0;

            // Update our local IP addresses (need these for the updateIcon phase, and they ought to be up-to-date)
            // Should do this via an async process to avoid blocking (but getting local IPs should be really quick!)
            let localips = DnsHandler.resolveLocal();

            // Parse list of local IPs for IPv4/IPv6
            for (i=0; i<localips.length; i++)
            {
                if (localips[i].indexOf(":") != -1)
                {
                    localipv6s.push(localips[i]);
                }
                else
                {
                    localipv4s.push(localips[i]);
                }
            }

            // Parse list of IPs for IPv4/IPv6
            for (i=0; i<remoteips.length; i++)
            {
                if (remoteips[i].indexOf(":") != -1)
                {
                    ipv6s.push(remoteips[i]);
                }
                else
                {
                    ipv4s.push(remoteips[i]);
                }
            }

            consoleService.logStringMessage("Sixornot - found IP addresses");

            // This must now work as we have a valid IP address
            updateIcon();
        }
    }

    /* Update the status icon state (icon & tooltip)
       Returns true if it's done and false if unknown */
    function updateIcon()
    {
        switch (contentDoc.location.protocol)
        {
            case "file:":
                urlIsPortable = false;
                icon.src = getIconPath("sixornot_button_none_16");
                specialLocation = ["localfile"];
                return true;

            case "data:":
                icon.src = getIconPath("sixornot_button_none_16");
                specialLocation = ["datauri", url.truncateBeforeFirstChar(",")];
                return true;

            case "about:":
                urlIsPortable = false;
                if (url == "about:blank")  // Blank page gets its own icon and tooltip
                {
                    icon.src = getIconPath("sixornot_button_none_16");
                    specialLocation = ["blankpage"];
                }
                else
                {
                    icon.src = getIconPath("sixornot_button_none_16");
                    specialLocation = ["internalfile", url.truncateBeforeFirstChar("?")];
                }
                return true;

            case "chrome:":  case "resource:":
                urlIsPortable = false;
                icon.src = getIconPath("sizornot_button_none_16");
                specialLocation = ["internalfile", contentDoc.location.protocol + "//"];
                return true;

            case "view-source:":  // TODO: handle better
                urlIsPortable = false;
            default:
                if (host == "")
                    return false;  // Unknown host -> still need to look up
                
                if (ipv6s.length == 0)
                {
                    // We only have IPv4 addresses for the website
                    if (ipv4s.length == 0)
                    {
                        // No addresses at all, question mark icon
                        icon.src = getIconPath("sixornot_button_none_16");
                    }
                    else
                    {
                        // v4 only icon
                        icon.src = getIconPath("sixornot_button_ipv4_16");
                    }
                }
                else
                {
                    // We have at least one IPv6 address
                    if (ipv4s.length == 0)
                    {
                        // We only have IPv6 addresses, v6 only icon
                        icon.src = getIconPath("sixornot_button_v6only_16");
                    }
                    else
                    {
                        // v6 and v4 addresses, depending on possibility of v6 connection display green or yellow
                        if (localipv6s.length == 0)
                        {
                            // Site has a v6 address, but we do not, so we're probably not using v6 to connect
                            icon.src = getIconPath("sixornot_button_6avail_16");
                        }
                        else
                        {
                            // Site has a v6 address as do we, so hopefully we're using v6 to connect
                            icon.src = getIconPath("sixornot_button_using6_16");
                        }
                    }
                }
                specialLocation = null;
                return true;
        }
    }

    function updateTooltipContent()
    {
        // Clear previously generated tooltip, if one exists
        while (tooltip.firstChild)
        {
            tooltip.removeChild(tooltip.firstChild);
        }

        var grid = window.document.createElement("grid");
        var rows = window.document.createElement("rows");

        var first = true;
        var i = null;

        function addSpacerLine()
        {
            var row = window.document.createElement("row");
            var label = window.document.createElement("label");
            label.setAttribute("value", " ");
            var value = window.document.createElement("label");
            row.appendChild(value);
            row.appendChild(label);
            rows.appendChild(row);
        }

        function addTitleLine(labelName)
        {
            var row = window.document.createElement("row");
            var label = window.document.createElement("label");
            label.setAttribute("value", labelName);
            label.setAttribute("style", "font-weight: bold; text-align: right;");
            var value = window.document.createElement("label");
            row.appendChild(value);
            row.appendChild(label);
            rows.appendChild(row);
        }

        function addLabeledLine(labelName, lineValue)
        {
            var row = window.document.createElement("row");
            var label = window.document.createElement("label");
            label.setAttribute("value", labelName);
            label.setAttribute("style", "font-weight: bold;");
            var value = window.document.createElement("label");
            value.setAttribute("value", lineValue);
            row.appendChild(label);
            row.appendChild(value);
            rows.appendChild(row);
        }

        function addUnLabeledLine(lineValue)
        {
            var row = window.document.createElement("row");
            var label = window.document.createElement("label");
            var value = window.document.createElement("label");
            value.setAttribute("value", lineValue);
            row.appendChild(label);
            row.appendChild(value);
            rows.appendChild(row);
        }

        if (ipv4s.length != 0 || ipv6s.length != 0 | host != "")
        {
            addTitleLine("Remote", "");
        }

        if (host != "")
        {
            addLabeledLine("Domain name:", host);
        }

        first = true;
        if (ipv4s.length != 0)
        {
            for (i=0; i<ipv4s.length; i++)
            {
                if (first)
                {
                    if (ipv4s.length == 1)
                    {
                        addLabeledLine("IPv4 address:", ipv4s[i]);
                    }
                    else
                    {
                        addLabeledLine("IPv4 addresses:", ipv4s[i]);
                    }
                    first = false;
                }
                else
                {
                    addUnLabeledLine(ipv4s[i]);
                }
            }
        }
        first = true;
        if (ipv6s.length != 0)
        {
            for (i=0; i<ipv6s.length; i++)
            {
                if (first)
                {
                    if (ipv6s.length == 1)
                    {
                        addLabeledLine("IPv6 address:", ipv6s[i]);
                    }
                    else
                    {
                        addLabeledLine("IPv6 addresses:", ipv6s[i]);
                    }
                    first = false;
                }
                else
                {
                    addUnLabeledLine(ipv6s[i]);
                }
            }
        }

        if (specialLocation)
        {
            var extraString
            switch (specialLocation[0])
            {
                case "unknownsite":
                    extraString = "Unknown site"
                case "blankpage":
                    extraString = "Blank page"
                case "internalfile":
                    extraString = "Internal file"
                case "localfile":
                    extraString = "Local file"
                case "datauri":
                    extraString = "Data URI"
                case "lookuperror":
                    extraString = "Lookup error"
                case "nodnserror":
                    extraString = "No local DNS access"
                case "offlinemode":
                    extraString = "Offline mode"
            }

            if (specialLocation[1])
                extraString += " (" + specialLocation[1] + ")";
            var extraLine = window.document.createElement("label");
            extraLine.setAttribute("value", extraString);
            if (["unknownsite","lookuperror","nodnserror","offlinemode"].indexOf(specialLocation[0]) != -1)
                extraLine.setAttribute("style", "font-style: italic;");
            rows.appendChild(extraLine);
        }

        if (localipv4s.length != 0 || localipv6s.length != 0)
        {
            addSpacerLine();
            addTitleLine("Local");
        }

        // Append local IP address information
        // TODO - If address is link-local (or otherwise not globally routeable) then render it in italics
        // TODO - Display local DNS name as well
        first = true;
        if (localipv4s.length != 0)
        {
            for (i=0; i<localipv4s.length; i++)
            {
                if (first)
                {
                    if (localipv4s.length == 1)
                    {
                        addLabeledLine("IPv4 address:", localipv4s[i]);
                    }
                    else
                    {
                        addLabeledLine("IPv4 addresses:", localipv4s[i]);
                    }
                    first = false;
                }
                else
                {
                    addUnLabeledLine(localipv4s[i]);
                }
            }
        }
        first = true;
        if (localipv6s.length != 0)
        {
            for (i=0; i<localipv6s.length; i++)
            {
                if (first)
                {
                    if (localipv6s.length == 1)
                    {
                        addLabeledLine("IPv6 address:", localipv6s[i]);
                    }
                    else
                    {
                        addLabeledLine("IPv6 addresses:", localipv6s[i]);
                    }
                    first = false;
                }
                else
                {
                    addUnLabeledLine(localipv6s[i]);
                }
            }
        }

        grid.appendChild(rows);
        tooltip.appendChild(grid);
    }

/*    function updateMenuContent()  // Update actions in context menu based on current prefs
    {
        if (menuContentAge == actionsListAge)  // Only generate if this window's menu is stale
            return;

        Flagfox.actions.assertLoaded();

        var showAllItems = (menuContentAge == -1);  // Set menu age to -1 to show everything at once, regardless of show setting

        var showFavicons = safeGetBoolPref("flagfox.showfavicons");

        while (menu.firstChild)  // Clear previously generated menu, if one exists
            menu.removeChild(menu.firstChild);

        function newMenuItem(value,label)
        {
            var newElement = window.document.createElement("menuitem");
            newElement.setAttribute("value", value);
            newElement.setAttribute("label", label);
            menu.appendChild(newElement);
            return newElement;
        }

        function newMenuItemForAction(action,id)
        {
            if ( !(action.show || showAllItems) )
                return;

            var newElement = newMenuItem(id, Flagfox.actions.getLocalizedName(action));

            if (showFavicons)
            {
                newElement.setAttribute("class", "menuitem-iconic");  // Allow icon
                newElement.setAttribute("validate", "never");  // Force usage of cache
                newElement.setAttribute("onerror", "this.image='chrome://mozapps/skin/places/defaultFavicon.png';");
                newElement.setAttribute("image", Flagfox.getFaviconForTemplate(action.template));
            }
        }

        // Generate actions list
        for (var i in actionsList)
            newMenuItemForAction(actionsList[i], i);

        menu.appendChild(window.document.createElement("menuseparator"));

        // Add "Options"
        newMenuItem("options", strings.GetStringFromName("options"));

        if (showAllItems)
            menuContentAge = 0;  // All were shown; reset for next open
        else
            menuContentAge = actionsListAge;  // Menu content synced to actions list
    } */

/*    function isActionAllowed(id)  // Is the given action allowed for this current state?
    {
        if (id === undefined || id === null)  // The id may be 0
            return false;

        if (id == "options")
            return true;

        if (!contentDoc)
            return false;

        var action = actionsList[id];
        Flagfox.actions.assertValid(action);
        var template = action.template;

        function needs(placeholder) { return RegExp(placeholder,"i").test(template); }  // Case-insensitive regexp search for placeholder in template

        switch (template.truncateBeforeFirstChar(":"))
        {
            default:
                if (!window.navigator.onLine)
                    return false;
                if (!urlIsPortable)
                {
                    if ( needs("{fullURL}") )  // Don't send local URLs to remote lookups
                        return false;
                    if ( (host == ip || host == "localhost") && needs("{(IPaddress|(base)?domainName|TLD)}") )  // Don't send local IPs without hostnames to remote lookups
                        return false;
                }
                break;

            case "copystring":
                break;  // Nothing special needed (as apposed to "default:")

            case "javascript":
                if (!contentDoc.defaultView)
                    return false;
                break;
        }

        if ( host == "" && needs("{((base)?domainName|TLD)}") )
            return false;
        if ( ip == "" && needs("{IPaddress}") && !needs("{((base)?domainName|TLD)}") )  // Allow optional IP when also using host (i.e. Geotool behind a proxy)
            return false;
        if ( !countryCode && needs("{country(Code|Name)}") )
            return false;

        return true;
    } */

/*    function doAction(id)
    {
        if (!isActionAllowed(id))
            return;

        if (id == "options")
        {
            // Flags from Add-ons Manager + resizable; focus() after open to refocus already open window, if needed
            window.openDialog("chrome://flagfox/content/options.xul", "FlagfoxOptions", "chrome,titlebar,toolbar,centerscreen,resizable").focus();
            return;
        }

        var action = actionsList[id];

        switch (action.template.truncateBeforeFirstChar(":"))
        {
            default:  // Lookup URL action
                if (action.template.substr(0,23) == "http://geo.flagfox.net/")  // Identify this Flagfox version to Geotool for abuse prevention purposes
                    setGeotoolCookie();
                var parsedTemplate = parseTemplate(action.template, "url");  // Parse template as URL
                Flagfox.openURL(window, parsedTemplate);
                return;

            case "copystring":  // Copy to clipboard action uses an ad hoc pseudo-protocol
                var parsedTemplate = parseTemplate(action.template.slice(11), "none");  // Parse template after "copystring:"
                clipboardHelper.copyString(parsedTemplate);
                return;

            case "javascript":  // Javascript action; evaluate in sandbox instead of evaluating as a URL
                var parsedTemplate = parseTemplate(action.template.slice(11), "escapequotes");  // Parse template after "javascript:" and escape any quotes

                var contentWindow = contentDoc.defaultView;
                var sandbox = Components.utils.Sandbox(contentWindow);
                sandbox.window = contentWindow;  // Sandbox has access to content window object (not chrome window!)

                // Override window object prompts using this action's name in the title (linked to content window)
                const actionName = Flagfox.actions.getLocalizedName(action);
                const dialogTitle = actionName + " - Flagfox";
                sandbox.prompts = {
                    alert : function(msg) { promptService.alert(contentWindow,dialogTitle,msg); },
                    confirm : function(msg) { return promptService.confirm(contentWindow,dialogTitle,msg); },
                    prompt : function(msg,val) { return promptService.prompt(contentWindow,dialogTitle,msg,val); }
                };

                sandbox.importFunction(function(newurl) { Flagfox.openURL(window,newurl); }, "openURL");         // API to open a URL via method set by user pref
                sandbox.importFunction(function(string) { clipboardHelper.copyString(string); }, "copystring");  // API to copy a string to the clipboard
                sandbox.importFunction(function(logmsg) { consoleService.logStringMessage(logmsg); }, "log");    // API to log a string message to the Error Console

                try
                {
                    // Allow direct access to content window methods/properties as if this action were running in the content
                    // prompts' methods override window's locally (e.g. alert=prompts.alert but window.alert still exists)
                    const JStoEval = "with (window) with (prompts) {\n" + parsedTemplate + "\n}";
                    Components.utils.evalInSandbox(JStoEval, sandbox);
                }
                catch (e)  // Handle exceptions in JavaScript actions with a user friendly error popup and Error Console message
                {
                    var errorMsg = e.toString();
                    if (e.stack)
                    {
                        var cleanStack = e.stack.replace(/@.*\n/g,"\n").trimRight();
                        if (/\n/.test(cleanStack))  // Only show if more than one line
                            errorMsg += "\n\nstack trace:\n" + cleanStack;
                    }
                    errorMsg += "\n\naction source:\n" + parsedTemplate;
                    var errorTitle = "Flagfox JavaScript Action \"" + actionName + "\" ERROR";
                    logErrorMessage(errorTitle + ":\n\n" + errorMsg);
                    promptService.alert(contentWindow, errorTitle, errorMsg);
                }
                return;
        }
    } */

/*    function parseTemplate(template,encoding)  // Placeholders in templates are case-insensitive and may be used multiple times
    {
        function getReplacement(token) { return getParameterValue(token,template,encoding); }

        if (encoding == "url")
        {
            // Both the full template and parameters need encoding but I can't do encodeURI() with the parameters as that
            // ignores certain characters that might cause problems with searches. The parameters need encodeURIComponent().
            // To prevent double encoding I do encodeURI() first and simply search using encoded placeholders. 
            return encodeURI(template).replace(/%7B[^%\s]+%7D/g, getReplacement);
        }
        else
        {
            return template.replace(/\{[^{}\s]+\}/g, getReplacement);
        }
    } */

    function onPrefChange(branch,prefName)
    {
        switch (prefName)
        {
            case "usealticons":
                updateState();
                return;
        }
    }

    function onIconClick(event)
    {
        function doClickAction()
        {
            if (event.button == 1 || (event.button == 0 && event.ctrlKey))  // Middle or Left+Ctrl
                var binding = "middleclick";
            else if (event.button == 0)  // Left
                var binding = "click";
            else
                return;
            // Button 2 (Right) shows popup menu via context attribute

            // event.detail for click events is the number of successive clicks thus far
            if (event.detail == 2)
                binding = "double" + binding;
            else if (event.detail == 3)
                binding = "triple" + binding;

            doAction(hotClicks[binding]);
        }

    }

    function onIconMouseDown(event)  // Handle keyboard modifiers when right-clicking on the icon
    {
        if (event.button == 2 && event.ctrlKey)  // Right+Ctrl
            menuContentAge = -1;  // Show all items at once
    }

/*    function onMenuCommand(event)
    {
        var actionID = event.target.value;
        doAction(actionID);
    }

    function onMenuShowing(event)
    {
        updateMenuContent();  // Update menu, if need be

        var menuItems = menu.getElementsByTagName("menuitem");
        for (var i=0; i < menuItems.length; i++)  // Decide which menu items to grey out if they aren't available
            menuItems[i].setAttribute("disabled", !isActionAllowed( menuItems[i].getAttribute("value") ));  // Need to use attributes here
    } */

    /* The "online" and "offline" events fire many times at once on the window object.
       To avoid redundant updates I just reset things and let it update on the next poll.
       In case the menu was opened offline it's reset too to make sure favicons are loaded. */
    function onChangedOnlineStatus(event)
    {
        contentDoc = null;
        menuContentAge = 0;
    }
}

//// DNS handler (does lookups for IP addresses) ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var DnsHandler =
{
    AF_INET: null,
    AF_INET6: null,
    library: null,
//    in_addr: null,
//    sockaddr_in: null,
//    in6_addr: null,
//    sockaddr_in6: null,
    sockaddr: null,
    addrinfo: null,
//    freeaddrinfo: null,
    getaddrinfo: null,
//    inet_ntop: null,
//    inet_pton: null,

    init : function ()
    {
        // Try each of these until one works, this will also determine our platform
        try
        {
            this.library = ctypes.open("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation");
            consoleService.logStringMessage("Sixornot - Running on OSX, opened library: '/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation'");
            // Address family
            this.AF_UNSPEC = 0;
            this.AF_INET = 2;
            this.AF_INET6 = 30;
            // Socket type
            this.SOCK_STREAM = 1;
            // Protocol
            this.IPPROTO_UNSPEC = 0;
        }
        catch(e)
        {
            consoleService.logStringMessage("Sixornot - Not running on OSX");
            try
            {
                this.library = ctypes.open("Ws2_32.dll");
                consoleService.logStringMessage("Sixornot - Running on Windows XP+, opened library: 'Ws2_32.dll'");
                // Flags
                this.AI_PASSIVE = 0x01;
                this.AI_CANONNAME = 0x02;
                this.AI_NUMERICHOST = 0x04;
                this.AI_ALL = 0x0100;
                this.AI_ADDRCONFIG = 0x0400;
                this.AI_NON_AUTHORITATIVE = 0x04000;
                this.AI_SECURE = 0x08000;
                this.AI_RETURN_PREFERRED_NAMES = 0x10000;
                // Address family
                this.AF_UNSPEC = 0;
                this.AF_INET = 2;
                this.AF_INET6 = 23;
                // Socket type
                this.SOCK_STREAM = 1;
//                this.SOCK_DGRAM = 2;
//                this.SOCK_RAW = 3;
//                this.SOCK_RDM = 4;
//                this.SOCK_SEQPACKET = 5;
                // Protocol
                this.IPPROTO_UNSPEC = 0;
                this.IPPROTO_TCP = 6;
                this.IPPROTO_UDP = 17;
//                this.IPPROTO_RM = 113;
            }
            catch(e)
            {
                consoleService.logStringMessage("Sixornot - Not running on Windows XP+");
                // Here we should degrade down to using Firefox's builtin methods
                return false;
            }
        }
        // Set up all the structs we need
/*        this.in_addr = ctypes.StructType("in_addr", [
                            {s_addr : ctypes.unsigned_char.array(4)}]);
        this.sockaddr_in = ctypes.StructType("sockaddr_in", [
                            {sin_family : ctypes.short}, 
                            {sin_port : ctypes.unsigned_short}, 
                            {sin_addr : this.in_addr}, 
                            {sin_zero : ctypes.char.array(8)}]);
        this.in6_addr = ctypes.StructType("in6_addr", [
                            {s6_addr : ctypes.unsigned_char.array(16)}]);
        this.sockaddr_in6 = ctypes.StructType("sockaddr_in6", [
                            {sin6_family : ctypes.uint16_t},
                            {sin6_port : ctypes.uint16_t}, 
                            {sin6_flowinfo : ctypes.uint32_t}, 
                            {sin6_addr : this.in6_addr}, 
                            {sin6_scope_id : ctypes.uint32_t}]); */
        this.sockaddr = ctypes.StructType("sockaddr", [
                            {sa_family : ctypes.unsigned_short},
                            {sa_data : ctypes.unsigned_char.array(28)}]);
        this.addrinfo = ctypes.StructType("addrinfo");
        this.addrinfo.define([
                            {ai_flags : ctypes.int}, 
                            {ai_family : ctypes.int}, 
                            {ai_socktype : ctypes.int}, 
                            {ai_protocol : ctypes.int}, 
                            {ai_addrlen : ctypes.int}, 
                            {ai_cannonname : ctypes.char.ptr}, 
                            {ai_addr : this.sockaddr.ptr}, 
                            {ai_next : this.addrinfo.ptr}]);
        // Set up all the ctypes functions we need
//        this.freeaddrinfo = this.library.declare("freeaddrinfo", ctypes.default_abi, ctypes.void_t, addrinfo.ptr);
        this.getaddrinfo = this.library.declare("getaddrinfo", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.char.ptr, this.addrinfo.ptr, this.addrinfo.ptr.ptr);
//        this.inet_ntop = this.library.declare("inet_ntop", ctypes.default_abi, ctypes.char.ptr, ctypes.int, ctypes.voidptr_t, ctypes.char.ptr, ctypes.int);
//        this.inet_pton = this.library.declare("inet_pton", ctypes.default_abi, ctypes.int, ctypes.int, ctypes.char.ptr, ctypes.voidptr_t);
    },

    shutdown : function()
    {
        this.library.close();
    },

    typeof_ip4 : function (ip_address)
    {
        // For IPv4 addresses types are:
        /*
            local           127.0.0.0/24
            rfc1918         10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
            linklocal       169.254.0.0/16
            reserved        192.0.0.0/24, 240.0.0.0/4
            documentation   192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
            6to4relay       192.88.99.0/24
            benchmark       198.18.0.0/15
            multicast       224.0.0.0/4
        */
    },

    // Return the type of an IPv6 address
    typeof_ip6 : function (ip_address)
    {
        // Incoming IPv6 address must be normalised to fully-expanded format in lowercase
        // Then run patterns against it to determine its type
        // For IPv6 addresses types are:
        /*
            unspecified     ::/128                                      All zeros
            local           ::1/128         0000:0000:0000:0000:0000:0000:0000:0001
            linklocal       fe80::/10                                   Starts with fe8, fe9, fea, feb
            sitelocal       fec0::/10   (deprecated)
            uniquelocal     fc00::/7    (similar to RFC1918 addresses)  Starts with: fc or fd
            pdmulticast     ff00::/8                                    Starts with ff
            v4transition    ::ffff:0:0/96 (IPv4-mapped)                     Starts with 0000:0000:0000:0000:0000:ffff
                            ::ffff:0:0:0/96 (Stateless IP/ICMP Translation) Starts with 0000:0000:0000:0000:ffff:0000
                            0064:ff9b::/96 ("Well-Known" prefix)            Starts with 0064:ff9b:0000:0000:0000:0000
            6to4            2002::/16                                       Starts with 2002
            teredo          2001::/32                                       Starts with 2001:0000
            benchmark       2001:2::/48                                     Starts with 2001:0002:0000
            documentation   2001:db8::/32                                   Starts with 2001:0db8
        */
    },

    // Convert a base10 representation of a number into a base16 one (zero-padded to two characters, input number less than 256)
    to_hex : function (int_string)
    {
        let hex = Number(int_string).toString(16);
        if (hex.length < 2)
        {
            hex = "0" + hex;
        }
        return hex;
    },

    // Ensure decimal number has no spaces etc.
    to_decimal : function (int_string)
    {
        return Number(int_string).toString(10);
    },

    // Convert IP object into a Javascript string
    get_ip_str : function (address, address_family)
    {
        // Find everything between square brackets
        consoleService.logStringMessage("Sixornot - get_ip_str");
        let r = RegExp(/\[(.*?)\]/);
        let ip_array = r.exec(address.sa_data.toString())[0].split(",");

        consoleService.logStringMessage("Sixornot - get_ip_str - ip_array is: " + ip_array);
        if (address_family === this.AF_INET)
        {
            // IPv4 address
            // Stored in bytes 2-5 (zero-index)
            // [0, 0, 82, 113, 152, 84, 0, 0, 0, 0, 0, 0, 0, 0, 228, 92, 46, 126, 0, 0, 0, 128, 65, 0, 0, 0, 136, 52]
            let ip4_array = ip_array.slice(2,6);
            return [Number(ip4_array[0]), Number(ip4_array[1]), Number(ip4_array[2]), Number(ip4_array[3])].join(".");
        }
        if (address_family === this.AF_INET6)
        {
            // IPv6 address
            // Stored in bytes 6-21 (zero-index)
            // [0, 0, 0, 0, 0, 0, ||32, 1, 4, 112, 31, 9, 3, 152, 0, 0, 0, 0, 0, 0, 0, 2||, 0, 0, 0, 0, 56, 52]
            let ip6_array = ip_array.slice(6,22);

            // This code adapted from this example: http://phpjs.org/functions/inet_ntop:882
            let i = 0, m = "", c = [];
            for (i = 0; i < 16; i++) {
                c.push(((Number(ip6_array[i++]) << 8) + Number(ip6_array[i])).toString(16));
            }
            return c.join(':').replace(/((^|:)0(?=:|$))+:?/g, function (t) {
                m = (t.length > m.length) ? t : m;
                return t;
            }).replace(m || ' ', '::');
        }
    },

    // Proxy to native getaddrinfo functionality
    resolveHostNative : function (host)
    {
        consoleService.logStringMessage("Sixornot - resolveHostNative - resolving host: " + host);

        let hints = this.addrinfo();
        //        this.AI_PASSIVE = 0x01;
        //        this.AI_CANONNAME = 0x02;
        //        this.AI_NUMERICHOST = 0x04;
        //        this.AI_ALL = 0x0100;
        //        this.AI_ADDRCONFIG = 0x0400;  - must be off
        hints.ai_flags = 0x010 | 0x020 | 0x040 | 0x0100 | 0x0200;
        //        this.AF_INET = 2;
        //        this.AF_INET6 = 23;
        //        this.AF_UNSPEC = 0;
        hints.ai_family = this.AF_UNSPEC;
        //        this.SOCK_STREAM = 1;
        hints.ai_socktype = 0;
        //        this.IPPROTO_UNSPEC = 0;
        //        this.IPPROTO_TCP = 6;
        //        this.IPPROTO_UDP = 17;
        hints.ai_protocol = this.IPPROTO_UNSPEC;
        hints.ai_addrlen = 0;
//        hints.ai_addr = ctypes.voidptr_t();
//        hints.ai_next = ctypes.voidptr_t(); */

        let retValue = this.addrinfo();
        let retVal = retValue.address();
        let ret = this.getaddrinfo(host, null, hints.address(), retVal.address());
//        let ret = this.getaddrinfo(host, null, null, retVal.address());
        let addresses = [];
        let notdone = true;
        if (retVal.isNull())
        {
            consoleService.logStringMessage("Sixornot - resolveHostNative - Unable to resolve host, got no results from getaddrinfo");
            return [];
        }
        let i = retVal.contents;

        // Loop over the addresses retrieved by ctypes calls and transfer all of them into a javascript array
        while (notdone)
        {
            consoleService.logStringMessage("Sixornot - loop");

            let new_addr = this.get_ip_str(i.ai_addr.contents, i.ai_family);

            // Add to addresses array, strip duplicates as we go
            if (addresses.indexOf(new_addr) === -1)
            {
                addresses.push(new_addr);
            }
            if (i.ai_next.isNull())
            {
                i = null;
                notdone = false;
            }
            else
            {
                i = i.ai_next.contents;
            }
        }

        consoleService.logStringMessage("Sixornot - Found the following addresses: " + addresses);
        return addresses.slice();

    },

    isProxiedDNS : function(url)  // Returns true if the URL is set to have its DNS lookup proxied via SOCKS
    {
        var uri = ioService.newURI(url, null, null);
        var proxyinfo = proxyService.resolve(uri, 0);  // Finds proxy (shouldn't block thread; we already did this lookup to load the page)
        return (proxyinfo != null) && (proxyinfo.flags & proxyinfo.TRANSPARENT_PROXY_RESOLVES_HOST);
        // "network.proxy.socks_remote_dns" pref must be set to true for Firefox to set TRANSPARENT_PROXY_RESOLVES_HOST flag when applicable
    },

    cancelRequest : function(request)
    {
        try { request.cancel(Components.results.NS_ERROR_ABORT); } catch(e) {}  // calls onLookupComplete() with status=Components.results.NS_ERROR_ABORT
    },

    // Return the IP addresses of the local host
    resolveLocal : function()
    {
        let dnsresponse = dnsService.resolve(dnsService.myHostName, true);
        var IPAddresses = [];
        while (dnsresponse.hasMore())
        {
            IPAddresses.push(dnsresponse.getNextAddrAsString());
        }
        return IPAddresses;
    },

    resolveHost : function(host,returnIP)  // Returns request object
    {
        function fail(reason)
        {
            logErrorMessage("Sixornot warning: DNS lookup failure for \"" + host + "\": " + reason);
            returnIP(["FAIL"]);
        }

        var callback =
        {
            onLookupComplete : function(nsrequest, nsrecord, status)
            {
                if (status == Components.results.NS_ERROR_ABORT)
                    return;  // Ignore cancel

                if (status != 0 || !nsrecord || !nsrecord.hasMore())
                {
                    fail( (status==Components.results.NS_ERROR_UNKNOWN_HOST) ? ("Unknown host") : ("status " + status) );
                    return;  // IP not found in DNS
                }

                var IPAddresses = [];
                while (nsrecord.hasMore())
                {
                    IPAddresses.push(nsrecord.getNextAddrAsString());
                }

                // Return array of all IP addresses found for this domain
                returnIP(IPAddresses)
            }
        };

        try
        {
            return dnsService.asyncResolve(host, 0, callback, threadManager.currentThread);
        }
        catch (e)
        {
            fail( "exception " + ((e.name && e.name.length) ? e.name : e) );
            return null;
        }
    }
};

//// Utility functions //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function $(node, childId) {
   if (node.getElementById) {
      return node.getElementById(childId);
   } else {
      return node.querySelector("#" + childId);
   }
}


function getIconPath(filename)
{
    return "resource://sixornot/skin/icons/" + filename + ".png";
}

/* Generic pref listener class
    Usage:
        function onPrefChange(branch,prefname)
        {
            switch (prefname)
            {
                case "prefname1":
                    break;
                case "prefname2":
                    break;
            }
        }
        var listener = new PrefListener("branchname.",onPrefChange);
*/
function PrefListener(branchName, onChanged)
{
    var branch = prefService.getBranch(branchName);
    branch.QueryInterface(Components.interfaces.nsIPrefBranch2);
    branch.addObserver("", this, false);

    this.unregister = function()
    {
        if (branch)
            branch.removeObserver("", this);
        branch = null;
    };

    this.observe = function(subject, topic, data)
    {
        if (topic == "nsPref:changed")
            onChanged(branch, data);
    };
}

function doOnShutdown(onShutdown)
{
    var observerService = Components.classes["@mozilla.org/observer-service;1"]
                                    .getService(Components.interfaces.nsIObserverService);
    var quitEventObserver =
    {
        observe : function(subject, topic, data)
        {
            if (topic != "quit-application")
                return;
            try { onShutdown(); }
            finally { observerService.removeObserver(quitEventObserver, "quit-application"); }
        }
    };
    observerService.addObserver(quitEventObserver, "quit-application", false);
}

// Used for slide-down info bar
function hashString(string)  // Returns a base-64 encoded MD5 hash of a Unicode string
{
    var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                              .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    var bytes = converter.convertToByteArray(string,{});
    var cryptoHash = Components.classes["@mozilla.org/security/hash;1"]
                               .createInstance(Components.interfaces.nsICryptoHash);
    cryptoHash.init(cryptoHash.MD5);
    cryptoHash.update(bytes,bytes.length);
    return cryptoHash.finish(true);
}

// Needed for actions code
/* function getModsCode(ctrl,alt,meta)  // Convert boolean triplet into an integer
{
    var code = 0;
    if (ctrl)
        code |= 1;
    if (alt)
        code |= 2;
    if (meta)
        code |= 4;
    return code;
} */

/* function getCurrentWindow()
{
    return Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator)
                     .getMostRecentWindow("navigator:browser");
} */

function logErrorMessage(message)  // Logs a string message to the error console with no file link, similar to consoleService.logStringMessage(), but with "error" status
{
    var scriptError = Components.classes["@mozilla.org/scripterror;1"]
                                .createInstance(Components.interfaces.nsIScriptError);
    scriptError.init(message,null,null,null,null,0,null);
    consoleService.logMessage(scriptError);
}

function parseException(e)  // Returns a string version of an exception object with its stack trace
{
    if (!e)
        return "";
    else if (!e.stack)
        return String(e);
    else
        return String(e) + " \n" + cleanExceptionStack(e.stack);
}

/* For some stupid reason any resource:// URLs are converted into full file:// URL paths in exception stacks.
   This function converts them back to make the stack shorter and more readable.
   TODO: Someday use chrome:// loaded JSM and not need this (Gecko 2.0+ only) */
function cleanExceptionStack(stack)
{
    try
    {
        const shortPath = "resource://sixornot/";
        const longPath = ioService.newChannel(shortPath,null,null).URI.spec;
        return stack.replace(new RegExp(longPath,"ig"), shortPath);
    }
    catch (e)
    {
        return stack;
    }
}

function cleanLocaleCode(code)  // Cleans a locale code to use a consistent format (lowercase is needed in a few places)
{
    return String(code).replace('_','-').toLowerCase();
}
/*
function showPageOnceEver(url,pref)  // Will show the given URL in a new tab, only once ever, and use the given pref to remember
{
    if (!safeGetBoolPref(pref))
    {
        getCurrentWindow().setTimeout(function(){
            Flagfox.addTabInCurrentBrowser(url);
            prefService.setBoolPref(pref,true);
        }, 1000);  // Need a delay to make sure it's shown after an update under Firefox 3.6+ for some reason
    }
}
*/
function getPrefsDump(branchname)
{
    var branch = prefService.getBranch(branchname);
    var prefList = branch.getChildList("",{});
    prefList.sort();
    var output = [];
    for (var i in prefList)
        output.push(branchname + prefList[i] + "=" + getGenericPref(branch,prefList[i]));
    if (!output.length)
        throw "Prefs list is EMPTY!"
    return output.join("\n");
}

function getGenericPref(branch,prefName)  // Get any pref from a branch, even if you don't know its type
{
    switch (branch.getPrefType(prefName))
    {
        case 0:   return "(INVALID!)";                   // PREF_INVALID
        case 32:  return getUCharPref(branch,prefName);  // PREF_STRING
        case 64:  return branch.getIntPref(prefName);    // PREF_INT
        case 128: return branch.getBoolPref(prefName);   // PREF_BOOL
    }
    throw Error("Bad pref type for: " + prefName);
}

function getUCharPref(branch,prefName)  // Unicode getCharPref
{
    return branch.getComplexValue(prefName, Components.interfaces.nsISupportsString).data;
}

function setUCharPref(branch,prefName,text)  // Unicode setCharPref
{
    var string = Components.classes["@mozilla.org/supports-string;1"]
                           .createInstance(Components.interfaces.nsISupportsString);
    string.data = text;
    branch.setComplexValue(prefName, Components.interfaces.nsISupportsString, string);
}

function safeGetBoolPref(pref)  // Returns bool pref value, or false if there's an error or it does not exist
{
    try { return prefService.getBoolPref(pref); }
    catch (e) { return false; }
}

String.prototype.cropTrailingChar = function(character)  // This does NOT get exposed out of the scope of this JSM file
{
    return (this.charAt(this.length-1)==character) ? this.slice(0,this.length-1) : this.valueOf();
};

String.prototype.truncateAfterLastChar = function(character)  // This does NOT get exposed out of the scope of this JSM file
{
    let pos = this.lastIndexOf(character);
    return (pos != -1) ? this.substring(pos+1) : this.valueOf();
};

String.prototype.truncateBeforeFirstChar = function(character)  // This does NOT get exposed out of the scope of this JSM file
{
    let pos = this.indexOf(character);
    return (pos != -1) ? this.substring(0,pos) : this.valueOf();
};

//// Services & Strings (each fetched once on first use) ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function defineLazyGetter(getterName, getterFunction)
{
    this.__defineGetter__(getterName, function() {
        delete this[getterName];
        return this[getterName] = getterFunction.apply(this);
    });
}

defineLazyGetter("prefService", function() {
    return Components.classes["@mozilla.org/preferences-service;1"]
                     .getService(Components.interfaces.nsIPrefBranch)
                     .QueryInterface(Components.interfaces.nsIPrefService);
});
defineLazyGetter("ioService", function() {
    return Components.classes["@mozilla.org/network/io-service;1"]
                     .getService(Components.interfaces.nsIIOService);
});
defineLazyGetter("threadManager", function() {
    return Components.classes["@mozilla.org/thread-manager;1"]
                     .getService(Components.interfaces.nsIThreadManager);
});
defineLazyGetter("dnsService", function() {
    return Components.classes["@mozilla.org/network/dns-service;1"].getService(Components.interfaces.nsIDNSService);
});
defineLazyGetter("proxyService", function() {
    return Components.classes["@mozilla.org/network/protocol-proxy-service;1"]
                     .getService(Components.interfaces.nsIProtocolProxyService);
});
//defineLazyGetter("tldService", function() {
//    return Components.classes["@mozilla.org/network/effective-tld-service;1"]
//                     .getService(Components.interfaces.nsIEffectiveTLDService);
//});
defineLazyGetter("consoleService", function() {
    return Components.classes["@mozilla.org/consoleservice;1"]
                     .getService(Components.interfaces.nsIConsoleService);
});
defineLazyGetter("promptService", function() {
    return Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                     .getService(Components.interfaces.nsIPromptService);
});
//defineLazyGetter("clipboardHelper", function() {
//    return Components.classes["@mozilla.org/widget/clipboardhelper;1"]
//                     .getService(Components.interfaces.nsIClipboardHelper);
//});
//defineLazyGetter("cookieManager", function() {
//    return Components.classes["@mozilla.org/cookiemanager;1"]
//                     .getService(Components.interfaces.nsICookieManager2);
//});
defineLazyGetter("httpService", function() {
    return Components.classes["@mozilla.org/network/protocol;1?name=http"]
                     .getService(Components.interfaces.nsIHttpProtocolHandler);
});
defineLazyGetter("appInfo", function() {
    return Components.classes["@mozilla.org/xre/app-info;1"]
                     .getService(Components.interfaces.nsIXULAppInfo)
                     .QueryInterface(Components.interfaces.nsIXULRuntime);
});
defineLazyGetter("versionComparator", function() {
    return Components.classes["@mozilla.org/xpcom/version-comparator;1"]
                     .getService(Components.interfaces.nsIVersionComparator);
});

function loadPropertiesFile(path)
{
    var bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                           .getService(Components.interfaces.nsIStringBundleService)
                           .createBundle(path);
    if (!bundle || !bundle.getSimpleEnumeration().hasMoreElements())
        throw Error("Could not load string bundle: " + path);
    return bundle;
}

defineLazyGetter("strings", function() {
    return loadPropertiesFile("resource://sixornot/locale/sixornot.properties");
});
defineLazyGetter("helpstrings", function() {
    return loadPropertiesFile("resource://sixornot/locale/help.properties");
});
//defineLazyGetter("countrynames", function() {
//    return loadPropertiesFile("chrome://sixornot/locale/countrynames.properties");
//});
