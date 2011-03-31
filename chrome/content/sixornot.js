/* This is a JavaScript module (JSM) to be imported via Components.utils.import() and acts as a singleton.
   Only the following listed symbols will exposed on import, and only when and where imported. */

/* This library is heavily based on the excellent Flagfox addon */

const EXPORTED_SYMBOLS = ["Sixornot"];

/* Components.utils.import("resource://flagfox/ipdb.jsm");  // Access IPDB here */

var SixornotVersion = "4.1.x";  // Fetched on startup; value here is a fallback

var mainPrefListener = null;
var warningsThisSession = [];

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
        if (checkForAbsoluteIncompatability())  // Check if compatibility checking is overridden past its known breaking point
        {
            ready = null;
            return;  // No-go
        }

        const id = "sixornot@entropy.me.uk";  // Sixornot ID
//        const IPv4DBfilename = "ip4.db";                      // IPv4 DB filename
//        const IPv6DBfilename = "ip6.db";                      // IPv6 DB filename

        if ("@mozilla.org/extensions/manager;1" in Components.classes)  // Gecko 1.9.x
        {
            var ExtensionManager = Components.classes["@mozilla.org/extensions/manager;1"]
                                             .getService(Components.interfaces.nsIExtensionManager);
            SixornotVersion = ExtensionManager.getItemForID(id)
                                             .version;
//            var ip4db = ExtensionManager.getInstallLocation(id)
//                                        .getItemLocation(id);
//            var ip6db = ip4db.clone();
//            ip4db.append(IPv4DBfilename);
//            ip6db.append(IPv6DBfilename);
//            ipdb.init(ip4db,ip6db);
//            checkIPDBage();
            ready = true;
        }
        else  // Gecko 2.0+
        {
            Components.utils.import("resource://gre/modules/AddonManager.jsm");
            AddonManager.getAddonByID(id, function(addon) {
                try {
                    SixornotVersion = addon.version;
//                    var ip4db = addon.getResourceURI(IPv4DBfilename)
//                                     .QueryInterface(Components.interfaces.nsIFileURL)
//                                     .file;
//                    var ip6db = addon.getResourceURI(IPv6DBfilename)
//                                     .QueryInterface(Components.interfaces.nsIFileURL)
//                                     .file;
//                    ipdb.init(ip4db,ip6db);
//                    checkIPDBage();
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
//    ipdb.close();
    if (mainPrefListener)
        mainPrefListener.unregister();
}

/* function checkIPDBage()  // Check if the IPDB version is getting old and results are beginning to get particularly stale (3 months or more old)
{
    if (ipdb.lastModifiedTime && Date.now() - ipdb.lastModifiedTime >= 7776000000)
        Flagfox.warning(getCurrentWindow(), "flagfox.warn.stale", strings.GetStringFromName("stalewarnmessage"));
} */

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
        if (ready === undefined)  // Startup if not done yet
            startup();

        if (ready === null)  // Halt if startup was aborted
            return;

        // Load the flag icon for this window
        try { newIconInstance(window); }
        catch (e) { Sixornot.error("Error loading icon for window",e); }
    },

/*    actions :
    {
        load : function()
        {
            actionsList = JSON.parse(getUCharPref(prefService, "flagfox.actions"));
            consoleService.logStringMessage("Flagfox actions loaded from JSON pref");

            this.refresh();
        },

        save : function()
        {
            this.refresh();  // Apply any new bindings and resync IDs if any have changed

            actionsSaveIsInProgress = true;
            try
            {
                setUCharPref(prefService, "flagfox.actions", JSON.stringify(actionsList));
                consoleService.logStringMessage("Flagfox actions saved to JSON pref");
            }
            catch (e) { Flagfox.error("Error saving actions",e); }
            actionsSaveIsInProgress = false;
        },

        refresh : function()  // Makes changes to actions list take effect; must Flagfox.actions.save() to make changes persist after application close
        {
            actionsListAge = Date.now();  // Make context menus refresh on next open

            hotKeys = {};
            hotClicks = {};

            this.assertLoaded();

            for (var i in actionsList)  // Refresh all keyboard and icon click shortcuts
            {
                var hotkey = actionsList[i].hotkey;
                if (hotkey)
                {
                    function hasMod(mod) { return hotkey.mods.indexOf(mod)!=-1; }
                    var charCode = (hasMod("shift") ? hotkey.key.toUpperCase() : hotkey.key.toLowerCase()).charCodeAt(0);
                    if (!hotKeys[charCode])
                        hotKeys[charCode] = {};
                    hotKeys[charCode][getModsCode(hasMod("ctrl"),hasMod("alt"),hasMod("meta"))] = i;
                }
                var hotclick = actionsList[i].iconclick;
                if (hotclick)
                {
                    hotClicks[hotclick] = i;
                }
            }
        },

        setBindings : function(id,newclick,newhotkey)  // Must actions.save() after setting (which will also actions.refresh() to make them active)
        {
            this.assertLoaded();

            var action = actionsList[id];
            this.assertValid(action);

            if (newclick == "")
                newclick = undefined;

            // Unset existing bindings first, if needed
            if (newclick)
                for (var i in actionsList)
                    if (actionsList[i].iconclick == newclick)
                        actionsList[i].iconclick = undefined;
            if (newhotkey)
                for (var i in actionsList)
                    if (actionsList[i].hotkey && actionsList[i].hotkey.key == newhotkey.key && actionsList[i].hotkey.mods == newhotkey.mods)
                        actionsList[i].hotkey = undefined;

            // Set new bindings (undefined clears; null leaves alone)
            if (newclick !== null)
                action.iconclick = newclick;
            if (newhotkey !== null)
                action.hotkey = newhotkey;
        },

        getLocalizedName : function(action)
        {
            try {
                if (!action.custom)  // Must be a default to have a localization
                    return strings.GetStringFromName( "action." + action.name.replace(/[ :]/g,"_").toLowerCase() );
            } catch (e) {}
            return action.name;
        },

        assertLoaded : function()
        {
            if (!actionsList || !actionsList.length)
                throw Error("Actions not loaded!");
        },

        assertValid : function(action)
        {
            if (!action || !action.name || !action.template)
                throw Error("Invalid action: " + JSON.stringify(action));
        },

        getByID : function(id) { return actionsList[id]; },  // Get an action by its current ID (position in array); IDs will change if an action is reordered

        create : function() { return actionsList.push({custom:true})-1; },                // Create a new custom action at the end of the array and return its ID
        remove : function(id) { return actionsList.splice(id,1)[0]; },                    // Remove an action from the array and return the removed action
        insert : function(id,action) { actionsList.splice(id,0,action); },                // Insert an action into the array at a specific ID
        append : function(newactions) { actionsList = actionsList.concat(newactions); },  // Append an array of new actions onto the end of the existing array

        get length() { return actionsList.length; }
    }, */ // End Actions

/*    getFaviconForTemplate : function(template)
    {
        try
        {
            switch (template.truncateBeforeFirstChar(":"))
            {
                case "copystring":
                    return getIconPath("copy");  // Copy to clipboard ad hoc pseudo-protocol
                case "javascript": case "data":
                    return getIconPath("special/script");
                case "about":
                    return getIconPath("special/about");
                case "chrome":  case "resource":
                    return getIconPath("special/resource");
                case "file":
                    return getIconPath("special/localfile");
            }

            if (template.indexOf("://")==-1)
                template = "http://" + template;
            var uri = ioService.newURI(template, null, null);
            uri.host = uri.host.replace(/\{[^{}\s]+\}\.?/gi,"");  // Clear out any placeholders in the domain name
            uri.path = "favicon.ico";

            if (uri.host == "geo.flagfox.net")  // May as well cheat here to avoid hitting the server a few million times
                return "chrome://flagfox/content/logo-small.png";

            return uri.spec;  // nsIFaviconService doesn't seem to want to work without a bookmark, but the main cache seems to work fine with it
        }
        catch (e)
        {
            return "";  // Given template probably isn't a valid URL
        }
    }, */

    warning : function(window,pref,message)  // Shows a slide-down info bar (max once per session for each unique message)
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

/*    openURL : function(window,url)  // Open URL in a window based on the user's pref
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

/*    addTabInCurrentBrowser : function(url)  // Add tab to most recent window, regardless of where this function was called from
    {
        var currentWindow = getCurrentWindow();
        currentWindow.focus();
        var currentBrowser = currentWindow.getBrowser();
        currentBrowser.selectedTab = currentBrowser.addTab(url,null,null);
    }, */

/*    getIPDBversion : function()  // Returns current Flagfox IPDB file modification date as YYYY-M
    {
        if (!ipdb.lastModifiedTime)
            return "missing IPDB!";
        var date = new Date(ipdb.lastModifiedTime);
        return date.getUTCFullYear() + "-" + (date.getUTCMonth()+1);  // JS months are 0-11, just to be confusing
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
    var contentDoc = null;     // Reference to the current page document object
    var url = "";              // The URL of the current page
    var urlIsPortable = true;  // Is the URL not on this computer?
    var host = "";             // The host name of the current URL
    var ip = "";               // The IP address of the current host
//    var countryCode = null;    // The country code of the current IP address
//    var tldCountryCode = null; // The country code of the current domain name
//    var metaTags = null;       // The meta tags in the current page

    var icon = window.document.getElementById("sixornot-icon");
//    var menu = window.document.getElementById("sixornot-menu");
    var tooltip = window.document.getElementById("sixornot-tooltip");
//    if (!icon || !menu || !tooltip)
    if (!icon || !tooltip)
    {
        logErrorMessage("Sixornot warning: attempted to load into an invalid window");
        return;
    }

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

    function unload()
    {
        window.removeEventListener("unload",unload,false);
        window.removeEventListener("offline",onChangedOnlineStatus,false);
        window.removeEventListener("online",onChangedOnlineStatus,false);
//        window.removeEventListener("keypress",onKeyPressed,false);
        tooltip.removeEventListener("popupshowing",updateTooltipContent,false);
//        menu.removeEventListener("popupshowing",onMenuShowing,false);
//        menu.removeEventListener("command",onMenuCommand,false);
//        icon.removeEventListener("mouseover",onIconHover,false);
//        icon.removeEventListener("mousedown",onIconMouseDown,false);
//        icon.removeEventListener("click",onIconClick,false);
        window.clearInterval(pollLoopID);
        DnsHandler.cancelRequest(DNSrequest);
        prefListener.unregister();
        tooltip = null;
//        menu = null;
        icon = null;
//        metaTags = null;
        contentDoc = null;
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
            //Sixornot.error("Error during poll loop!",e);
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
        ip = "";
//        countryCode = null;
//        tldCountryCode = null;
//        metaTags = null;

        // If we've changed pages before completing a lookup, then abort the old request first
        DnsHandler.cancelRequest(DNSrequest);
        DNSrequest = null;

        // Tries to update icon based on protocol type (e.g. for local pages which don't need to be looked up)
        // If this fails returns false and we need to do lookup
        if (updateIcon())
            return;

        // Need to look up host
        try { host = contentDoc.location.hostname.cropTrailingChar("."); } catch (e) {}
        if (host == "")
        {
            icon.src = getIconPath("green");
            specialLocation = ["unknownsite"];
            logErrorMessage("Sixornot warning: no host returned for \"" + url + "\"");
            return;
        }

        if (!window.navigator.onLine)
        {
            icon.src = getIconPath("green");
            specialLocation = ["offlinemode"];
            consoleService.logStringMessage("Sixornot is in offline mode");
            return;  // Offline mode or otherwise not connected
        }

        if (DnsHandler.isProxiedDNS(url))
        {
            icon.src = getIconPath("green");
            specialLocation = ["nodnserror"];
            consoleService.logStringMessage("Sixornot is in proxied mode");
            Sixornot.warning(window, "sixornot.warn.proxy", strings.GetStringFromName("proxywarnmessage"));
            return;  // Proxy in use for DNS; can't do a DNS lookup
        }

        // Ideally just hitting the DNS cache here
//        DNSrequest = DnsHandler.resolveHost(host, onReturnedIP);
        DNSrequest = DnsHandler.resolveHost(host, onReturnedIPs);

//        function onReturnedIP(returnedIP)
        function onReturnedIPs(returnedIPs)
        {
            DNSrequest = null;  // Request complete

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

            if (returnedIPs[0] == "FAIL")
            {
                icon.src = getIconPath("blue");
                specialLocation = ["lookuperror"];
                return;  // DNS lookup failed (ip/countryCode/tldCountryCode stay empty)
            }

            ip = returnedIPs[0];
//            countryCode = ipdb.lookupIP(ip);
//            tldCountryCode = lookupTLD();
            consoleService.logStringMessage("Sixornot - found IP addresses");

            // This must now work as we have a valid IP address
            updateIcon();
        }
    }

/*    function lookupTLD()
    {
        if (!countryCode)
            return null;  // If no country code then no host and no TLD

        var tld = host.truncateAfterLastChar(".");
        if (tld.length != 2)
            return null;
        var tldCode = tld.toUpperCase();  // Country code for this TLD

        // The nationality of the server location and the domain registration are not necissarily the same.
        // This case is checked for and a notificaion is sent up for the user to attempt to reduce user confusion on the matter.
        var doCheck = true;
        switch (tldCode)         // Special TLD cases:
        {
            case "UK":
                tldCode = "GB";  // List uses country code for Great Britan instead of United Kingdom
                break;
            case "EU":           // Don't tell users European Union TLDs aren't in European countries
                doCheck = false;
                break;
            case "FM":           // Some countries have TLDs that are frequently sold for other uses as abbreviations or words
            case "TV":
            case "TO":
            case "ME":
            case "LY":
                doCheck = false;
                break;
        }
        switch (countryCode)     // Special IP range cases:
        {
            case "EU":           // Don't tell users European Union IPs aren't in European countries
            case "AP":           // Don't tell users Asia/Pacific IPs aren't in Asian countries
                doCheck = false;
                break;
        }

        if (doCheck)  // Do the check if the TLD and country codes aren't in the exception lists
        {
            try {
                var tldCountry = countrynames.GetStringFromName(tldCode);  // Throws an exception if not found
                if (tldCountry.length && countryCode != tldCode)
                {
                    var ipCountry = countrynames.GetStringFromName(countryCode);
                    Sixornot.warning(window, "sixornot.warn.tld", strings.formatStringFromName("tldwarnmessage", [ipCountry, "."+tld, tldCountry], 3));
                }
            } catch (e) {
                return null;  // If the code isn't in the list then it's not a country (or not one we have the code for)
            }
        }

        return tldCode;  // Return the country code for the domain registration
    } */

    /* Update the flag icon state (icon & tooltip)
       Returns true if it's done and false if unknown */
    function updateIcon()
    {
        switch (contentDoc.location.protocol)
        {
            case "file:":
                urlIsPortable = false;
                icon.src = getIconPath("orange");
                specialLocation = ["localfile"];
                return true;  // Done

            case "data:":
                icon.src = getIconPath("orange");
                specialLocation = ["datauri", url.truncateBeforeFirstChar(",")];
                return true;  // Done

            case "about:":
                urlIsPortable = false;
                if (url == "about:blank")  // Blank page gets its own icon and tooltip
                {
                    icon.src = getIconPath("orange");
                    specialLocation = ["blankpage"];
                }
                else  // Note: about:addons gets the normal about icon, not the puzzle piece, because it already has that as its own icon
                {
                    icon.src = getIconPath("orange");
                    specialLocation = ["internalfile", url.truncateBeforeFirstChar("?")];
                }
                return true;  // Done

            case "chrome:":  case "resource:":
                urlIsPortable = false;
                icon.src = getIconPath("orange");
                specialLocation = ["internalfile", contentDoc.location.protocol + "//"];
                return true;  // Done

            case "view-source:":  // TODO: handle better
                urlIsPortable = false;
            default:
                if (host == "")
                    return false;  // Unknown host -> still need to look up
                
                icon.src = getIconPath("sixornot_button_ipv4_256");
/*                if (!countryCode)
                {
                    icon.src = getIconPath("special/unknown");  // Have a host (and ip) but no country -> unknown site
                    specialLocation = ["unknownsite"];
                    return true;  // Done
                } 
                switch (countryCode)  // IP has been looked up
                {
                    case "-A":  case "-B":  case "-C":
                        urlIsPortable = false;
                        icon.src = getIconPath("special/privateip");
                        break;
                    case "-L":
                        urlIsPortable = false;
                        icon.src = getIconPath("special/localhost");
                        break;
                    case "A1":  case "A2":
                        icon.src = getIconPath("special/anonymous");
                        break;
                    default:
                        icon.src = getIconPath((safeGetBoolPref("sixornot.usealticons") ? "flagset2/" : "flagset1/") + countryCode.toLowerCase());
                        break;
                } */
                specialLocation = null;
                return true;  // Done
        }
    }

    function updateTooltipContent()
    {
        while (tooltip.firstChild)  // Clear previously generated tooltip, if one exists
            tooltip.removeChild(tooltip.firstChild);

        var grid = window.document.createElement("grid");
        var rows = window.document.createElement("rows");

        function addLabeledLine(labelID,lineValue)
        {
            var row = window.document.createElement("row");
            var label = window.document.createElement("label");
            label.setAttribute("value", strings.GetStringFromName(labelID));
            label.setAttribute("style", "font-weight: bold;");
            var value = window.document.createElement("label");
            value.setAttribute("value", lineValue);
            row.appendChild(label);
            row.appendChild(value);
            rows.appendChild(row);
        }

/*        function safeGetCountryName(code)
        {
            try { return countrynames.GetStringFromName(code); }
            catch (e) { return "?????"; }
        } */

        if (host != "" && host != ip)
            addLabeledLine("domainname", host);
        if (ip != "")
            addLabeledLine("ipaddress", ip);
//        if (countryCode)
//            addLabeledLine("serverlocation", safeGetCountryName(countryCode));
//        if (tldCountryCode && tldCountryCode != countryCode)
//            addLabeledLine("domainnationality", safeGetCountryName(tldCountryCode));

        if (specialLocation)
        {
            var extraString = strings.GetStringFromName(specialLocation[0]);
            if (specialLocation[1])
                extraString += " (" + specialLocation[1] + ")";
            var extraLine = window.document.createElement("label");
            extraLine.setAttribute("value", extraString);
            if (["unknownsite","lookuperror","nodnserror","offlinemode"].indexOf(specialLocation[0]) != -1)
                extraLine.setAttribute("style", "font-style: italic;");
            rows.appendChild(extraLine);
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

/*    function getParameterValue(token,template,encoding)
    {
        var parameter, maybeEncode;
        switch (encoding)
        {
            default:
            case "none":
                parameter = token.slice(1,-1);  // Cut off { & }
                maybeEncode = function(a) { return a; };
                break;

            case "url":
                parameter = token.slice(3,-3);  // Cut off %7B & %7D
                maybeEncode = encodeURIComponent;
                break;

            case "escapequotes":
                parameter = token.slice(1,-1);
                maybeEncode = function(str) { return String(str).replace(/\\/g,"\\\\").replace(/\'/g,"\\\'").replace(/\"/g,"\\\""); };
                break;
        }
        parameter = parameter.toLowerCase().split('-');  // Split into components if available (left/right side of '-')
        switch (parameter[0])
        {
            case "fullurl":
                if (encoding == "url")  // Some templates will need the URL variable to be encoded and others will need it to not be
                {
                    var charBeforeURL = template[ template.search(/\{fullURL\}/i) - 1 ];
                    if (charBeforeURL == '=' || charBeforeURL == ':')
                        return encodeURIComponent(url);
                }
                return url;

            case "basedomainname":
                try { return maybeEncode(tldService.getBaseDomainFromHost(host)); }
                catch (e) {}  // Throws if something is wrong with host name or is IP address; fall-through and use full host name

            case "domainname":
                return maybeEncode(host);

            case "tld":
                try { return maybeEncode(tldService.getPublicSuffixFromHost(host)); }
                catch (e) { return maybeEncode(host.truncateAfterLastChar(".")); }

            case "ipaddress":
                return maybeEncode(ip);

            case "countrycode":
                return countryCode;  // Always two ASCII characters; never needs encoding

            case "countryname":
                return maybeEncode(countrynames.GetStringFromName(countryCode));

            case "title":
                return maybeEncode(contentDoc.title);

            case "baselocale":
                var base = true;  // language-dialect -> language
            case "locale":
                var locale;
                switch (parameter[1])
                {
                    default:      locale = Flagfox.locale.content;           break;  // {locale}      -> primary user requested content locale
                    case "ui":    locale = Flagfox.locale.UI;                break;  // {locale-ui}   -> Flagfox UI strings locale (e.g. country names)
                    case "os":    locale = Flagfox.locale.OS;                break;  // {locale-os}   -> native operating system locale
                    case "page":  locale = contentDoc.documentElement.lang;  break;  // {locale-page} -> locale stated for the current page (empty string if none)
                }
                return maybeEncode( base ? locale.split('-')[0] : locale );  // Shouldn't need encoding, but do so if needed just in case of a bogus value in content

            case "meta":
                // Unfortunately contentDoc.querySelector is case-sensitive and HTML in the wild is messy, so search manually
                if (!metaTags)  // Cached?
                    metaTags = contentDoc.getElementsByTagName("meta");  // case-insensitive tag search
                for (var i=0; i < metaTags.length; i++)
                    if (parameter[1] == metaTags[i].name.toLowerCase())  // case-insensitive name search
                        return maybeEncode(metaTags[i].content);
                return "";  // Meta tags are optional and vary, thus they're always allowed placeholders; return empty string if no matched name

            default:
                return token;  // Don't know what it is; leave it alone
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

        /* There is a dblclick event, but I can't use that because it's sent out in addition to two click events,
           not instead of. As a result, I just use the click event and detect multiple clicks within a short timeframe.
           (which also allows for triple click detection) The time has to be very short, otherwise when a user does a
           single click action it will still have to wait a while to see if there's going to be a second click. */
        window.clearTimeout(this.clicktimer);
        this.clicktimer = window.setTimeout(doClickAction, 250);
        // Double click = two clicks within 250ms; Triple click = three clicks within 500ms
    }

    function onIconMouseDown(event)  // Handle keyboard modifiers when right-clicking on the icon
    {
        if (event.button == 2 && event.ctrlKey)  // Right+Ctrl
            menuContentAge = -1;  // Show all items at once
    }

    function onIconHover(event)  // Changes mouseover cursor to a hand when there is a click action
    {
        icon.style.cursor = isActionAllowed(hotClicks["click"]) ? "pointer" : "default" ;
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

    /* Listening to every keypress here because dynamically adding to a <keyset> with <keys> being listened to doesn't seem to work well.
       This function only takes around a microsecond or less to run so it shouldn't affect performance.
       event.charCode is case-sensitive so I don't need to check for shift separately. */
    function onKeyPressed(event)
    {
        if (event.ctrlKey || event.altKey || event.metaKey)
        {
            var boundKey = hotKeys[event.charCode];
            if (boundKey)
                doAction( boundKey[getModsCode(event.ctrlKey,event.altKey,event.metaKey)] );
        }
    }

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

                // Needs to be changed to return all the IPs, not just one of them (as an array? how does that affect returnIP?)
//                returnIP(nsrecord.getNextAddrAsString());
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

//// Update handling functions //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/* Migration from old Flagfox versions:
     1) Imports old custom action from Flagfox 3.3.x
     2) Imports old middle click option
     3) Wipes all obsolete Flagfox preferences (prefs that don't have defaults) */
/*function migrateOldPrefs()
{
    Flagfox.actions.assertLoaded();

    try  // Import flagfox.customlookup.* from Flagfox 3.3.x
    {
        var oldCustomAction = new Object();
        oldCustomAction.name = getUCharPref(prefService, "flagfox.customlookup.name");
        oldCustomAction.template = getUCharPref(prefService, "flagfox.customlookup.url");
        oldCustomAction.show = safeGetBoolPref("flagfox.customlookup.enabled") ? true : undefined;
        oldCustomAction.custom = true;
        actionsList.push(oldCustomAction);
        Flagfox.actions.save();
        consoleService.logStringMessage("Flagfox 3 custom action imported");
    }
    catch (e) {}  // Throw -> pref doesn't exist (was default or already imported)

    try  // Import flagfox.middleclick
    {
        var oldClickPref = prefService.getCharPref("flagfox.middleclick");
        if (oldClickPref == "CopyIP")
            oldClickPref = "Copy IP";
        else if (oldClickPref == "Custom")
            oldClickPref = oldCustomAction.name;
        for (var i in actionsList)
            if (actionsList[i].name == oldClickPref)
            {
                Flagfox.actions.setBindings(i, "middleclick", null);
                Flagfox.actions.save();
                consoleService.logStringMessage("Flagfox 3 middleclick option imported");
                break;
            }
    }
    catch (e) {}  // Throw -> pref doesn't exist (was default or already imported)

    // Both the user and default branches contain the exact same list of pref names,
    // even if any default values don't exist or any user values equal the default.
    var defaultBranch = prefService.getDefaultBranch("flagfox.");
    var userBranch = prefService.getBranch("flagfox.");
    var prefsList = userBranch.getChildList("",{});
    if (!prefsList.length)
        throw "Could not load Flagfox preferences list";
    for (var i in prefsList)
    {   // Exception means no default exists and this pref is not in use
        try { getGenericPref(defaultBranch,prefsList[i]); }
        catch (e) { userBranch.clearUserPref(prefsList[i]); }
    }
} */

/* If the default actions list was updated recently, then those changes should be applied to the users' settings.
   There are three possibilities:
      a) Default action changed -> update it
      b) Default action removed -> delete it
      c) Default action added   -> add it */
/*function mergeDefaultActionUpdates()
{
    try
    {
        Flagfox.actions.assertLoaded();

        if (!prefService.prefHasUserValue("flagfox.actions"))  // If already using defaults then the new defaults will be used automatically
            return;

        var updatesDone = [];
        var defaultActionsList = JSON.parse(getUCharPref(prefService.getDefaultBranch(""), "flagfox.actions"));

        function findDefaultActionByName(actionsListToSearch,name)
        {
            for (var i in actionsListToSearch)
                if (!actionsListToSearch[i].custom && actionsListToSearch[i].name == name)
                    return actionsListToSearch[i];
            return null;
        }

        for (var i=actionsList.length-1; i>=0; i--)  // Need to scan backwards in case of deletion and index change
            if (!actionsList[i].custom)
            {
                if (actionsList[i].show && actionsList[i].name == "tr.im URL")  // tr.im died; replace with bit.ly as new default
                {
                    updatesDone.push("default action \"bit.ly URL\" replaces now defunct \"tr.im URL\" in default menu");
                    try { findDefaultActionByName(actionsList,"bit.ly URL").show = true; } catch (e) {}
                }  // tr.im will be deleted down below

                var action = findDefaultActionByName(defaultActionsList, actionsList[i].name);
                if (action)
                {
                    if (actionsList[i].template != action.template)  // Update to template
                    {
                        updatesDone.push("default action template update: " + actionsList[i].name);
                        actionsList[i].template = action.template;
                    }
                }
                else  // Old default action
                {
                    updatesDone.push("action is no longer a default: " + actionsList[i].name);
                    Flagfox.actions.remove(i);
                }
            }

        for (var i in defaultActionsList)
            if (!findDefaultActionByName(actionsList, defaultActionsList[i].name))  // New default action
            {
                updatesDone.push("new default action added: " + defaultActionsList[i].name);
                Flagfox.actions.insert(i,defaultActionsList[i]);  // TODO: Check existing shortcuts if I ever add a new default with a shortcut
            }

        if (updatesDone.length)
        {
            consoleService.logStringMessage("Flagfox default action list updates applied for version " + Flagfox.version + ":\n" + updatesDone.join("\n"));
            Flagfox.actions.save();
        }
    }
    catch (e)
    {
        Flagfox.error("Error applying default actions list updates",e);
    }
} */

/* The install.rdf file contains the listed application compatibility ranges which each addon supports. Remote support version bumps can be done via AMO.
   As newly developed versions of applications get released, some users disable compatibility checking and force installation before the support is updated.
   Often that works fine; sometimes it'll cause errors. Sadly, not all users can figure this out anymore, even many Minefield users.
   This function checks to make sure we're running inside the hard known compatibility range and tells the user essentially
   "I told you so" if it's completely incompatible. This is preferable to an error message that they won't understand. */
function checkForAbsoluteIncompatability()
{
    const MAJOR_SIXORNOT_VER = "4.1+";
    const MIN_GECKO_VER = "1.9.1";  // Hard minimum for Flagfox 4.1+; dropped all Gecko 1.9.0 support -> would error on lack of native JSON on startup
    const MAX_GECKO_VER = null;     // No hard max; if compatibility breaks, errors will ensue

    var tooOLD = (MIN_GECKO_VER && versionComparator.compare(appInfo.platformVersion,MIN_GECKO_VER) < 0);
    var tooNEW = (MAX_GECKO_VER && versionComparator.compare(appInfo.platformVersion,MAX_GECKO_VER) > 0);

    if ( tooOLD || tooNEW )
    {
        logErrorMessage("Sixornot INCOMPATIBILITY ERROR: Gecko version " + appInfo.platformVersion + " NOT supported!");

        var title = "Sixornot " + MAJOR_SIXORNOT_VER + " is NOT compatible with " + appInfo.vendor + " " + appInfo.name + " " + appInfo.version + "!";
        var msg = "You have forced the installation/running of Sixornot " + MAJOR_SIXORNOT_VER + " by overriding normal compatibility checking. " +
                  "This doesn't always work well and this time it didn't. Sixornot " + MAJOR_SIXORNOT_VER + " is NOT compatible with the Mozilla code-base " +
                  "this application is running: Gecko " + appInfo.platformVersion + "\n\n" +
                  "You would have a probably confusing error message right here if it weren't for this dialog. Instead, I'm going to point you in the right " +
                  "direction. You need to install " + (tooOLD?"an OLDER":"a NEWER") + " Sixornot version that supports your application.\n\n";
        if (tooNEW)
            msg += "If you're running a development (alpha, beta, or Minefield/Trunk) version of your application, " +
                   "you should probably check for development versions of your other addons too.\n\n";
        else if (tooOLD)
            msg += "If you're running a version of your application old enough that Mozilla has dropped support for it, " +
                   "that means you probably should have upgraded by now. Please do so as soon as possible for security reasons, if not addon support.\n\n";
        msg += "Close this dialog to go to the Sixornot versions list page on Mozilla's Add-ons site and install the applicable Sixornot version.";

        promptService.alert(null,title,msg);
        Sixornot.addTabInCurrentBrowser("https://addons.mozilla.org/addon/5791/versions/");  // URL redirects to application and locale specific version
        if (tooOLD)
            Sixornot.addTabInCurrentBrowser("http://www.mozilla.com/en-US/firefox/3.0/firstrun/");  // Too old -> Firefox 3.0.x (only en-US page has warning)
        return true;  // Ain't gonna work
    }

    return false;  // Normal compatibility checking will be used; proceed as normal
}

//// Utility functions //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getIconPath(filename)
{
    return "chrome://sixornot/skin/icons/" + filename + ".png";
}

// Automatically generate and cache IPDB hash on-demand
/* defineLazyGetter("IPDBhash", function() {
    return ipdb.generateQuickHash(3);
}); */

/* Set secret decoder ring for Geotool to try to reduce crippling server abuse from other sources.
   This gives up-to-date Flagfox users an all-access pass and restricts everyone else via a captcha at certain times.
   This does not, however, allow for infinite requests. Geotool will still auto-block after many excessive requests.
   This only identifies the Flagfox version. All users on all systems will get the same cookie for the same Flagfox version.
   No information that would identify this computer, profile, or user is sent and it is only sent to the Geotool server. */
/* function setGeotoolCookie()
{
    const expiry = (Date.now()/1000) + 600;  // Set 10 minute expiration time (automatically reset as needed on each call)
    const values = [
        ["Flagfox-version", FlagfoxVersion],                // Flagfox extension version string
        ["Flagfox-IPDBversion", Flagfox.getIPDBversion()],  // Flagfox IP location database version string (year and month)
        ["Flagfox-IPDBhash", IPDBhash]                      // 6 char base-36 quick hash of this version's IP location database file (used to verify versions)
    ];
    values.forEach(function(value) {
        cookieManager.add("geo.flagfox.net","/",value[0],value[1],false,true,false,expiry);  // HttpOnly mode on: only accessible by Geotool server, not client scripts
    });
} */

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

function getModsCode(ctrl,alt,meta)  // Convert boolean triplet into an integer
{
    var code = 0;
    if (ctrl)
        code |= 1;
    if (alt)
        code |= 2;
    if (meta)
        code |= 4;
    return code;
}

function getCurrentWindow()
{
    return Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator)
                     .getMostRecentWindow("navigator:browser");
}

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
    return Components.classes["@mozilla.org/network/dns-service;1"]
                     .getService(Components.interfaces.nsIDNSService);
});
defineLazyGetter("proxyService", function() {
    return Components.classes["@mozilla.org/network/protocol-proxy-service;1"]
                     .getService(Components.interfaces.nsIProtocolProxyService);
});
defineLazyGetter("tldService", function() {
    return Components.classes["@mozilla.org/network/effective-tld-service;1"]
                     .getService(Components.interfaces.nsIEffectiveTLDService);
});
defineLazyGetter("consoleService", function() {
    return Components.classes["@mozilla.org/consoleservice;1"]
                     .getService(Components.interfaces.nsIConsoleService);
});
defineLazyGetter("promptService", function() {
    return Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                     .getService(Components.interfaces.nsIPromptService);
});
defineLazyGetter("clipboardHelper", function() {
    return Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                     .getService(Components.interfaces.nsIClipboardHelper);
});
defineLazyGetter("cookieManager", function() {
    return Components.classes["@mozilla.org/cookiemanager;1"]
                     .getService(Components.interfaces.nsICookieManager2);
});
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
    return loadPropertiesFile("chrome://sixornot/locale/sixornot.properties");
});
defineLazyGetter("helpstrings", function() {
    return loadPropertiesFile("chrome://sixornot/locale/help.properties");
});
defineLazyGetter("countrynames", function() {
    return loadPropertiesFile("chrome://sixornot/locale/countrynames.properties");
});
