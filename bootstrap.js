/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2008-2011 Timothy Baldock. All Rights Reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * 
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * 
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * 
 * 3. The name of the author may not be used to endorse or promote products derived from this software without specific prior written permission from the author.
 * 
 * 4. Products derived from this software may not be called "SixOrNot" nor may "SixOrNot" appear in their names without specific prior written permission from the author.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. 
 * 
 * ***** END LICENSE BLOCK ***** */

/* Portions of this code are based on the Flagfox extension by Dave Garrett.
 * Please see flagfox.net for more information on this extension.
 * */

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MIT/X11 License
 * 
 * Copyright (c) 2011 Finnbarr P. Murphy
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * ***** END LICENSE BLOCK ***** */

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MIT/X11 License
 * 
 * Copyright (c) 2010 Erik Vold
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * Contributor(s):
 *   Erik Vold <erikvvold@gmail.com> (Original Author)
 *   Greg Parris <greg.parris@gmail.com>
 *   Nils Maier <maierman@web.de>
 *
 * ***** END LICENSE BLOCK ***** */

// Provided by Firefox:
/*global Components, Services, APP_SHUTDOWN, AddonManager */

// Provided in included modules:
/*global gt, unload, watchWindows, initLocalisation */

// Provided in lazy getters
/*global consoleService, ioService, proxyService, dnsService, clipboardHelper,
         workerFactory, threadManager */

/*
    Constants and global variables
*/
// Import needed code modules
/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");
/*jslint es5: false */

// Define all used globals
// Note: Due to execution as a bootstrapless addon these aren't really global
// but are within the scope of this extension
var NS_XUL,
    // ID constants
    BUTTON_ID,
    ADDRESS_BOX_ID,
    ADDRESS_IMG_ID,
    TOOLTIP_ID,
    ADDRESS_MENU_ID,
    TOOLBAR_MENU_ID,
    PREF_TOOLBAR,
    PREF_NEXTITEM,
    // Prefs branch constant
    PREF_BRANCH_SIXORNOT,
    PREF_BRANCH_DNS,
    // Preferences object (stores defaults)
    PREFS,
    // Prefs observer object - TODO - move into function where it is used? no need to be global?
    PREF_OBSERVER,
    PREF_OBSERVER_DNS,
    HTTP_REQUEST_OBSERVER,
    /*
        ipv6 only                   6only_16.png, 6only_24.png
        ipv4+ipv6 w/ local ipv6     6and4_16.png, 6and4_24.png
        ipv4+ipv6 w/o local ipv6    4pot6_16.png, 4pot6_24.png
        ipv4 only                   4only_16.png, 4only_24.png
        Unknown                     other_16.png, other_24.png
    */
    // Colour icons - TODO - find a way to have less variables (maybe an object)
    s6only_16_c, s6and4_16_c, s4pot6_16_c, s4only_16_c, sother_16_c,
    s6only_24_c, s6and4_24_c, s4pot6_24_c, s4only_24_c, sother_24_c,
    // Greyscale icons
    s6only_16_g, s6and4_16_g, s4pot6_16_g, s4only_16_g, sother_16_g,
    s6only_24_g, s6and4_24_g, s4pot6_24_g, s4only_24_g, sother_24_g,
    // Current icons
    s6only_16,   s6and4_16,   s4pot6_16,   s4only_16,   sother_16,
    s6only_24,   s6and4_24,   s4pot6_24,   s4only_24,   sother_24,
    // dns_handler
    dns_handler,
    // Global functions
    // Main functionality
    main,
    startup,
    shutdown,
    install,
    uninstall,
    reload,
    // Utility functions
    include,
    log,
    set_iconset,
    toggle_customise,
    get_bool_pref,
    get_current_window,
    gbi,set_initial_prefs,
    parse_exception,
    crop_trailing_char,
    defineLazyGetter,
    // Global objects
    xulRuntime;


var localipv4s = [];
var localipv6s = [];


/*

Cache

Request Cache - keyed by ID, list of all hosts contacted per page

Data should be cached at time of retrieval
Cached http responses don't get IPs, so in these cases the DNS results
would need to be used instead
DNS is cached itself, so no need to have a second cache for it
And the DNS results ought to all be cached since we've been visiting the pages

DNS callbacks should update the arrays which have already been added to the cache
They should also emit an event for the icons to listen for and update themselves

Deleting an item from the cache should cancel any DNS callbacks currently running

Icons updated when:
Current tab changes
New page loaded in etc.
DNS lookup callback returns
Show an icon/display tooltip text to indicate that a request for a host was served entirely from the local cache and thus no IP addresses come into play

Bold text/icon to indicate the active connection

Menu should contain submenus for each component of the page to permit copying to clipboard

Replace this all later with a panel which will do both tooltip+menu functionality?
Or use panel for info + copy addresses, menu for settings?
Or use the new settings functionality which is available for restartless now?

*/



var RequestCache = [];
var RequestWaitingList = [];

// TODO - periodic refresh of local addresses + store these globally


xulRuntime = Components.classes["@mozilla.org/xre/app-info;1"].getService( Components.interfaces.nsIXULRuntime );

NS_XUL          = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

BUTTON_ID       = "sixornot-buttonid";
ADDRESS_BOX_ID  = "sixornot-addressboxid";
ADDRESS_IMG_ID  = "sixornot-addressimageid";
TOOLTIP_ID      = "sixornot-tooltipid";
ADDRESS_MENU_ID = "sixornot-addressmenuid";
TOOLBAR_MENU_ID = "sixornot-toolbarmenuid";
PREF_TOOLBAR    = "toolbar";
PREF_NEXTITEM   = "nextitem";

PREF_BRANCH_SIXORNOT = Services.prefs.getBranch("extensions.sixornot.");
PREF_BRANCH_DNS      = Services.prefs.getBranch("network.dns.");

PREFS = {
    nextitem:           "bookmarks-menu-button-container",
    toolbar:            "nav-bar",
    showaddressicon:    false,
    greyscaleicons:     false,
    loglevel:           0,
    overridelocale:     "",
    showallips:         false
};

// http://erikvold.com/blog/index.cfm/2011/1/2/restartless-firefox-addons-part-2-includes
// https://developer.mozilla.org/en/XUL_School/Appendix_D:_Loading_Scripts

// Function to permit the including of other scripts into this one
(function (scope)
{
    scope.include = function (src)
    {
        // This triggers a warning on AMO validation
        // This method is only used to import utils.js and locale.js
        // Which are local to this addon (under include directory)
        Services.scriptloader.loadSubScript(src, scope);
    };
}
)(this);

// Log a message to error console, but only if it is important enough
log = (function ()
{
    var get_loglevel = function ()
    {
        try
        {
            return PREF_BRANCH_SIXORNOT.getIntPref("loglevel");
        }
        catch (e)
        {
        }
        // Fallback hard-coded default
        return PREFS["loglevel"];
    };
    return function (message, level)
    {
        // Three log levels, 0 = critical, 1 = normal, 2 = verbose
        // Default level is 1
        level = level || 1;
        // If preference unset, default to 1 (normal) level
        if (level <= get_loglevel())
        {
            consoleService.logStringMessage(message);
        }
    };
}());

PREF_OBSERVER = {
    observe: function (aSubject, aTopic, aData) {
        log("Sixornot - PREF_OBSERVER - aSubject: " + aSubject + ", aTopic: " + aTopic.valueOf() + ", aData: " + aData, 2);
        if (aTopic.valueOf() !== "nsPref:changed")
        {
            log("Sixornot - PREF_OBSERVER - not a pref change event 1", 2);
            return;
        }
        if (!PREFS.hasOwnProperty(aData))
        {
            log("Sixornot - PREF_OBSERVER - not a pref change event 2", 2);
            return;
        }

        if (aData === "showaddressicon")
        {
            log("Sixornot - PREF_OBSERVER - addressicon has changed", 1);
            reload();
        }
        if (aData === "greyscaleicons")
        {
            log("Sixornot - PREF_OBSERVER - greyscaleicons has changed", 1);
            set_iconset();
            reload();
        }
        // TODO Update worker process to use new log level?
        if (aData === "loglevel")
        {
            log("Sixornot - PREF_OBSERVER - loglevel has changed", 1);
            // Ensure dns_worker is at the same loglevel
            dns_handler.set_worker_loglevel(PREF_BRANCH_SIXORNOT.getIntPref("loglevel"))
        }
        if (aData === "overridelocale")
        {
            log("Sixornot - PREF_OBSERVER - overridelocale has changed", 1);
            reload();
        }
        if (aData === "showallips")
        {
            log("Sixornot - PREF_OBSERVER - showallips has changed", 1);
        }
    },

    get nsIPB2() {
        return PREF_BRANCH_SIXORNOT.QueryInterface(Components.interfaces.nsIPrefBranch2);
    },

    register: function () {
        log("Sixornot - PREF_OBSERVER - register", 2);
        this.nsIPB2.addObserver("", PREF_OBSERVER, false);
    },
   
    unregister: function () {
        log("Sixornot - PREF_OBSERVER - unregister", 2);
        this.nsIPB2.removeObserver("", PREF_OBSERVER);
    }
};

PREF_OBSERVER_DNS = {
    observe: function (aSubject, aTopic, aData) {
        log("Sixornot - PREF_OBSERVER_DNS - aSubject: " + aSubject + ", aTopic: " + aTopic.valueOf() + ", aData: " + aData, 2);
        if (aTopic.valueOf() !== "nsPref:changed")
        {
            log("Sixornot - PREF_OBSERVER_DNS - not a pref change event 1", 2);
            return;
        }

        if (aData === "disableIPv6")
        {
            log("Sixornot - PREF_OBSERVER_DNS - disableIPv6 has changed", 1);
            reload();
        }
        if (aData === "ipv4OnlyDomains")
        {
            log("Sixornot - PREF_OBSERVER_DNS - ipv4OnlyDomains has changed", 1);
            reload();
        }
    },

    get nsIPB2() {
        return PREF_BRANCH_DNS.QueryInterface(Components.interfaces.nsIPrefBranch2);
    },

    register: function () {
        log("Sixornot - PREF_OBSERVER_DNS - register", 2);
        this.nsIPB2.addObserver("", PREF_OBSERVER_DNS, false);
    },
   
    unregister: function () {
        log("Sixornot - PREF_OBSERVER_DNS - unregister", 2);
        this.nsIPB2.removeObserver("", PREF_OBSERVER_DNS);
    }
};


/* Observes HTTP requests to determine the details of all browser connections */
var HTTP_REQUEST_OBSERVER = {
    observe: function (aSubject, aTopic, aData) {
        var notifcationCallbacks, domWindow, domWindowUtils, domWindowInner,
            domWindowOuter, original_window, new_page, remoteAddress,
            lookupIPs;
        log("Sixornot - HTTP_REQUEST_OBSERVER - (" + aTopic + ")", 1);
        if (aTopic === "http-on-examine-response" || aTopic === "http-on-examine-cached-response") {
            log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response", 1);
            http_channel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
            http_channel_internal = aSubject.QueryInterface(Components.interfaces.nsIHttpChannelInternal);
            try {
                // TODO in case this fails we should add it, but with a blank address/address_family
                // And still perform DNS lookup!
                remoteAddress = http_channel_internal.remoteAddress;
            }
            catch (e) {
                log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response: remoteAddress was not accessible for: " + http_channel.URI.spec, 1);
                remoteAddress = "";
            }

            log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response: Processing " + http_channel.URI.host + " (" + (remoteAddress ? remoteAddress : "FROM_CACHE") + ")", 1);

            // Create new entry for this domain in the current window's cache (if not already present)
            // If already present update the connection IP(s) list (strip duplicates)
            // Trigger DNS lookup with callback to update DNS records upon completion

            // Fetch DOM window associated with this request
            var nC = http_channel.notificationCallbacks;
            if (!nC) {
                nC = http_channel.loadGroup.notificationCallbacks;
            }
            if (!nC) {
                // Unable to determine which window intiated this http request
                log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response: Unable to determine notificationCallbacks for this http_channel", 1);
                return;
            }

            try {
                domWindow = nC.getInterface(Components.interfaces.nsIDOMWindow).top;
                domWindowUtils = domWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);
                domWindowInner = domWindowUtils.currentInnerWindowID;
                domWindowOuter = domWindowUtils.outerWindowID;

                original_window = nC.getInterface(Components.interfaces.nsIDOMWindow);
            }
            catch (e) {
                // HTTP response is in response to a non-DOM source - ignore these
                log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response: non-DOM request", 1);
                return;
            }

            // Detect new page loads by checking if flag LOAD_INITIAL_DOCUMENT_URI is set
            if (http_channel.loadFlags & Components.interfaces.nsIChannel.LOAD_INITIAL_DOCUMENT_URI) {
                // What does this identity assignment do in practice? How does this detect new windows?
                new_page = original_window === original_window.top;
            }

            // Create a new host entry for this host to add to the cache array
            new_entry = {
                // TODO Should this be hostPort? Since we could connect using v4/v6 on different ports?
                host: http_channel.URI.host,
                address: remoteAddress,
                address_family: (remoteAddress !== "" ? (remoteAddress.indexOf(":") === -1 ? 4 : 6) : 0),
                mainhost: false,
                ipv6s: [],
                ipv4s: [],
                dns_status: "ready",
                dns_cancel: function () {}
            };

            /* Create closure containing reference to element and trigger async lookup with callback */
            lookupIPs = function (entry) {
                var onReturnedIPs;
                /* When DNS lookup is completed for a cache entry, update its IP address information */
                onReturnedIPs = function (remoteips) {
                    entry.dns_cancel = null;
                    if (remoteips[0] === "FAIL")
                    {
                        entry.ipv6s = [];
                        entry.ipv4s = [];
                        entry.dns_status = "failure";
                    } else {
                        entry.ipv6s = remoteips.filter(dns_handler.is_ip6);
                        entry.ipv4s = remoteips.filter(dns_handler.is_ip4);
                        entry.dns_status = "complete";
                    }
                    // Also trigger page change event here to refresh display of IP tooltip TODO
                };
                if (entry.dns_cancel) {
                    entry.dns_cancel();
                }
                entry.dns_cancel = dns_handler.resolve_remote_async(entry.host, onReturnedIPs);
            };

            if (new_page) {
                // New page, since inner window ID hasn't been set yet we need to store any
                // new connections until such a time as it is, these get stored in the RequestWaitingList
                // which is keyed by the outer window ID
                var hosts = [];
                if (RequestWaitingList[domWindowOuter]) {
                    hosts = RequestWaitingList[domWindowOuter];
                }
                // If host already in list update IP address if needed
                hosts.filter(function (element, index, thearray) {
                    if (element.host === new_entry.host) {
                        if (element.address !== new_entry.address && new_entry.address !== "") {
                            log("Sixornot - HTTP_REQUEST_OBSERVER - New page load, updated IP address for entry: " + new_entry.address + ", ID: " + domWindowOuter, 1);
                            element.address = new_entry.address;
                            element.address_family = new_entry.address_family;
                            // TODO - maybe have lookupIPs be a method of the entry object?
                            lookupIPs(element);
                            //element.lookupIPs();
                        }
                    }
                });
                // If host not already in list add it
                if (!hosts.some(function (element, index, thearray) {
                    return element.host === new_entry.host;
                })) {
                    log("Sixornot - HTTP_REQUEST_OBSERVER - New page load, adding new entry: " + new_entry.address + ", ID: " + domWindowOuter, 1);
                    hosts.push(new_entry);
                    // Trigger new DNS lookup for the new host entry
                    lookupIPs(new_entry);
                    //new_entry.lookupIPs();
                }
                RequestWaitingList[domWindowOuter] = hosts;
                log("Sixornot - HTTP_REQUEST_OBSERVER - New page load complete, Outer ID: " + domWindowOuter + ", Inner ID: " + domWindowInner, 1);
            } else {
                // Not new, inner window ID will be correct by now so add entries to RequestCache
                var hosts = [];
                if (RequestCache[domWindowInner]) {
                    hosts = RequestCache[domWindowInner];
                }
                // If host already in list update IP address if needed
                hosts.filter(function (element, index, thearray) {
                    if (element.host === new_entry.host) {
                        if (element.address !== new_entry.address && new_entry.address !== "") {
                            log("Sixornot - HTTP_REQUEST_OBSERVER - Secondary load, updated IP address for entry: " + new_entry.address + ", ID: " + domWindowInner, 1);
                            element.address = new_entry.address;
                            element.address_family = new_entry.address_family;
                            // TODO - maybe have lookupIPs be a method of the entry object?
                            lookupIPs(element);
                            //element.lookupIPs();
                        }
                    }
                });
                // If host not already in list add it
                if (!hosts.some(function (element, index, thearray) {
                    return element.host === new_entry.host;
                })) {
                    log("Sixornot - HTTP_REQUEST_OBSERVER - Secondary load, adding new entry: " + new_entry.address + ", ID: " + domWindowInner, 1);
                    hosts.push(new_entry);
                    // Trigger new DNS lookup for the new host entry
                    lookupIPs(new_entry);
                    //new_entry.lookupIPs();
                };
                RequestCache[domWindowInner] = hosts;

                // Create a page change event
                var evt = domWindow.document.createEvent("CustomEvent");
                evt.initCustomEvent("sixornot-page-change-event", true, true, null);
                evt.outer_id = domWindowOuter;
                evt.inner_id = domWindowInner;
                // Dispatch the event
                var cancelled = domWindow.dispatchEvent(evt)

                log("Sixornot - HTTP_REQUEST_OBSERVER - Secondary load complete, Outer ID: " + domWindowOuter + ", Inner ID: " + domWindowInner, 1);
            }

        } else if (aTopic === "content-document-global-created") {
            log("Sixornot - HTTP_REQUEST_OBSERVER - content-document-global-created", 1);
            // This signals that the document has been created, initial load completed
            // This is where entries on the RequestWaitingList get moved to the RequestCache
            domWindow = aSubject;
            domWindowUtils = domWindow.top.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);
            domWindowInner = domWindowUtils.currentInnerWindowID;
            domWindowOuter = domWindowUtils.outerWindowID;

            log("Sixornot - HTTP_REQUEST_OBSERVER - content-document-global-created: Inner Window ID: " + domWindowInner + ", Outer Window ID: " + domWindowOuter + ", Location: " + domWindow.location, 1);

            if (!RequestWaitingList[domWindowOuter]) {
                log("RequestWaitingList[domWindowOuter] is null", 1);
                return;
            }

            if (RequestCache[domWindowInner]) {
                throw "Sixornot = HTTP_REQUEST_OBSERVER - content-document-global-created: RequestCache already contains content entries."
            }

            // Move item(s) from waiting list to cache
            RequestCache[domWindowInner] = RequestWaitingList.splice(domWindowOuter, 1)[0];

            // Create a page change event
            var evt = domWindow.top.document.createEvent("CustomEvent");
            evt.initCustomEvent("sixornot-page-change-event", true, true, null);
            evt.outer_id = domWindowOuter;
            evt.inner_id = domWindowInner;
            // Dispatch the event
            var cancelled = domWindow.top.dispatchEvent(evt)

        } else if (aTopic === "inner-window-destroyed") {
            domWindowInner = aSubject.QueryInterface(Components.interfaces.nsISupportsPRUint64).data;
            delete RequestCache[domWindowInner];
            log("Sixornot - HTTP_REQUEST_OBSERVER - inner-window-destroyed: " + domWindowInner, 1);
        } else if (aTopic === "outer-window-destroyed") {
            domWindowOuter = aSubject.QueryInterface(Components.interfaces.nsISupportsPRUint64).data;
            delete RequestWaitingList[domWindowOuter];
            log("Sixornot - HTTP_REQUEST_OBSERVER - outer-window-destroyed: " + domWindowOuter, 1);
        } else {
            log("Sixornot - HTTP_REQUEST_OBSERVER - other, ignored (" + aTopic + ")", 1);
        }
    },

    get observer_service() {
        return Components.classes["@mozilla.org/observer-service;1"]
                         .getService(Components.interfaces.nsIObserverService);
    },

    register: function () {
        log("Sixornot - HTTP_REQUEST_OBSERVER - register", 2);
        this.observer_service.addObserver(this, "http-on-examine-response", false);
        this.observer_service.addObserver(this, "content-document-global-created", false);
        this.observer_service.addObserver(this, "inner-window-destroyed", false);
        this.observer_service.addObserver(this, "outer-window-destroyed", false);

        this.observer_service.addObserver(this, "http-on-modify-request", false);
        this.observer_service.addObserver(this, "http-on-examine-cached-response", false);
        this.observer_service.addObserver(this, "dom-window-destroyed", false);
    },

    unregister: function () {
        log("Sixornot - HTTP_REQUEST_OBSERVER - unregister", 2);
        this.observer_service.removeObserver(this, "http-on-examine-response");
        this.observer_service.removeObserver(this, "content-document-global-created");
        this.observer_service.removeObserver(this, "inner-window-destroyed");
        this.observer_service.removeObserver(this, "outer-window-destroyed");

        this.observer_service.removeObserver(this, "http-on-modify-request");
        this.observer_service.removeObserver(this, "http-on-examine-cached-response");
        this.observer_service.removeObserver(this, "dom-window-destroyed");
    }
};


/*
    Core functionality
*/

// main called for each new window via watchWindows
// inserts code into browser
// Listeners which trigger events should occur at the global level above this (e.g. httpeventlistener etc.)



// TODO
/*
    https://addons.mozilla.org/en-US/firefox/files/browse/129684/file/bootstrap.js#L127
    Refactor all main() code into event-driven model
    Make DNS lookups occur at correct time for correct entries returned by request observer
    Handle all the same edge cases as before
    Find nice structure for organising the functions
    Consider changing to use of a panel instead of a tooltip??
*/


/* void initCustomEvent(
    in DOMString type,
    in boolean canBubble,
    in boolean cancelable,
    in any detail
); */

/* // Create a page change event
var evt = document.createEvent("CustomEvent");
evt.initCustomEvent("sixornot-page-change-event", true, true, {"outer_id": ID, "inner_id: ID});
// Dispatch the event
var bool = element.dispatchEvent(evt)
// Return indicates if it was cancelled or not

// Listen for page change events
element.addEventListener("sixornot-page-change-event", function (), false);
element.removeEventListener("sixornot-page-change-event", function (), false); */


/* Should be called once for each window of the browser */
insert_code = function (win) {
    var doc, onMenuCommand,
        add_mainui, add_addressicon, get_icon_source,
        update_menu_content, update_tooltip_content,
        currentTabInnerID, currentTabOuterID, setCurrentTabIDs,
        getCurrentHost;

    doc = win.document;

    // TODO move this up a level to allow other functions to use it
    setCurrentTabIDs = function () {
        log("Sixornot - insert_code:setCurrentTabIDs", 1);
        var domWindow  = win.gBrowser.mCurrentBrowser.contentWindow;
        domWindowUtils = domWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                            .getInterface(Components.interfaces.nsIDOMWindowUtils);

        currentTabInnerID = domWindowUtils.currentInnerWindowID;
        currentTabOuterID = domWindowUtils.outerWindowID;
        log("Sixornot - insert_code:setCurrentTabIDs, outer: " + currentTabOuterID + ", inner: " + currentTabInnerID, 1);
    };

    // Called whenever an item on the menu is clicked and bound to each menu item as an event handler
    // Look up appropriate action by ID and perform that action
    onMenuCommand = function (evt) {
        var commandID, commandString, currentWindow, currentBrowser, toggle;
        log("Sixornot - main:onMenuCommand");

        commandID = evt.target.value.substring(0,5);
        commandString = evt.target.value.substring(5);
        // Actions
        // "prefs" - Open preferences
        // "copyc" - Copy text to clipboard
        // "gotow" - Go to SixOrNot website
        // "taddr" - Show or hide the address bar icon
        if (commandID === "copyc") {
            log("Sixornot - main:onMenuCommand - copy to clipboard", 2);
            clipboardHelper.copyString(commandString);
        } else if (commandID === "gotow") {
            log("Sixornot - main:onMenuCommand - goto web page", 2);
            // Add tab to most recent window, regardless of where this function was called from
            currentWindow = get_current_window();
            currentWindow.focus();
            currentBrowser = currentWindow.getBrowser();
            currentBrowser.selectedTab = currentBrowser.addTab(commandString);
        } else if (commandID === "tbool") {
            // Toggle address bar icon visibility
            toggle = (evt.target.hasAttribute("checked") && evt.target.getAttribute("checked") === "true");
            log("Sixornot - main:onMenuCommand - set boolean pref value: " + commandString + " to " + toggle, 2);
            PREF_BRANCH_SIXORNOT.setBoolPref(commandString, toggle);
        }
    };

    /* Return the host part of the current window's location */
    getCurrentHost = function () {
        return win.content.document.location.hostname;
    };

    /* Loads the button and tooltip/menu into the current window
       and registers unload() callbacks to remove them again */
    add_mainui = function () {
        var tooltip, toolbarPopupMenu, toolbarButton, toolbarId, toolbar,
            nextItem,
            domWindow, domWindowUtils, domWindowInner, domWindowOuter,
            page_change_handler, tabselect_handler, update_icon;
        log("Sixornot - insert_code:add_mainui", 2);

        tooltip = doc.createElementNS(NS_XUL, "tooltip");
        toolbarPopupMenu = doc.createElementNS(NS_XUL, "menupopup");
        toolbarButton = doc.createElementNS(NS_XUL, "toolbarbutton");

        // Tooltip setup
        tooltip.setAttribute("id", TOOLTIP_ID);
        // Add event listener for tooltip showing (to update tooltip contents dynamically)
        tooltip.addEventListener("popupshowing", update_tooltip_content, false);

        // Menu setup
        toolbarPopupMenu.setAttribute("id", TOOLBAR_MENU_ID);
        toolbarPopupMenu.setAttribute("position", "after_start");
        // Add event listener for popupMenu opening (to update popupMenu contents dynamically)
        toolbarPopupMenu.addEventListener("popupshowing", update_menu_content, false);
        toolbarPopupMenu.addEventListener("command", onMenuCommand, false);

        // Iconized button setup
        toolbarButton.setAttribute("id", BUTTON_ID);
        toolbarButton.setAttribute("label", gt("label"));
        toolbarButton.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional");
        toolbarButton.setAttribute("tooltip", TOOLTIP_ID);
        toolbarButton.setAttribute("type", "menu");
        toolbarButton.setAttribute("orient", "horizontal");

        toolbarButton.style.listStyleImage = "url('" + sother_16 + "')";

        // Menu which the button should open
        toolbarButton.appendChild(toolbarPopupMenu);

        gbi(doc, "navigator-toolbox").palette.appendChild(toolbarButton);

        // Add tooltip to urlbar (has to be added to something)
        gbi(doc, "urlbar-icons").appendChild(tooltip);
 
        // Move to location specified in prefs
        toolbarId = PREF_BRANCH_SIXORNOT.getCharPref(PREF_TOOLBAR);
        toolbar = toolbarId && gbi(doc, toolbarId);
        if (toolbar) {
            nextItem = gbi(doc, PREF_BRANCH_SIXORNOT.getCharPref(PREF_NEXTITEM));
            toolbar.insertItem(BUTTON_ID, nextItem && nextItem.parentNode.id === toolbarId && nextItem);
        }

        // Add event listeners
        // win.addEventListener("online", onChangedOnlineStatus, false); TODO
        // win.addEventListener("offline", onChangedOnlineStatus, false); TODO
        win.addEventListener("aftercustomization", toggle_customise, false);

        /* Updates the icon to reflect state of the currently displayed page */
        update_icon = function () {
            log("Sixornot - insert_code:add_mainui:update_icon", 1);
            /* Change icon to reflect status of current tab */
            var hosts = RequestCache[currentTabInnerID];
             
            if (!hosts) {
                // Analyse current location, see if it's not a valid page
                // TODO - fallback to DNS lookup of current name
                //      - store this in the cache
                log("Sixornot - main:add_mainui - callback: update_state - typeof(hosts) is undefined!", 1);
                set_icon(s_other_16);
                return;
            }
             
            /* Parse array searching for the main host (which matches the current location) */
            hosts.forEach(function (element, index, thearray) {
                if (element.host === getCurrentHost()) {
                    log("Sixornot - main:add_mainui - callback: update_state - updating icon!", 1);
                    toolbarButton.style.listStyleImage = "url('" + get_icon_source(element) + "')";
                }
            });
        };

        /* Called whenever the current window's active tab is changed
           Calls the update method for the icon */
        tabselect_handler = function (evt) {
            log("Sixornot - insert_code:add_mainui:tabselect_handler", 2);
            setCurrentTabIDs();
             
            /* Set state appropriately for the new tab. */
            var hosts = RequestCache[currentTabInnerID];

            update_icon();
        };

        /* Called whenever a Sixornot page change event is emitted
           Calls the update method for the icon, but only if the event applies to us */
        // TODO bind event to outer window such that we only ever hear events intended for us
        page_change_handler = function (evt) {
            log("Sixornot - insert_code:add_mainui:page_change_handler - evt.outer_id: " + evt.outer_id + ", evt.inner_id: " + evt.inner_id + ", currentTabOuterID: " + currentTabOuterID + ", currentTabInnerID: " + currentTabInnerID, 1);
            // Set current tab ID before comparison to ensure we match event properties
            setCurrentTabIDs();

            // Ignore updates for windows other than this one
            if (evt.outer_id !== currentTabOuterID) {
                log("Sixornot - insert_code:add_mainui - callback: update_state - Callback ID mismatch: evt.outer_id is: " + evt.outer_id + ", currentTabOuterID is: " + currentTabOuterID, 1);
                return;
            }

            update_icon();
        };

        /* We need the current outer tab ID to be set before
           the user has switched tabs for the first time. */
        log("Sixornot - insert_code:add_mainui - calling setCurrentTabIDs", 2);
        setCurrentTabIDs();

        // Register for page change events
        log("Sixornot - insert_code:add_mainui - registering listeners", 2);
        win.addEventListener("sixornot-page-change-event", page_change_handler, false);
        win.gBrowser.tabContainer.addEventListener("TabSelect", tabselect_handler, false);

        // Add a callback to our unload list to remove the UI when addon is disabled
        unload(function () {
            log("Sixornot - Unload main UI for a window...", 2);
            // Cancel any active DNS lookups for this window
            dns_handler.cancel_request(dns_request);

            // Clear event handlers
            win.removeEventListener("aftercustomization", toggle_customise, false);
            // win.removeEventListener("offline", onChangedOnlineStatus, false); TODO
            // win.removeEventListener("online", onChangedOnlineStatus, false); TODO
            tooltip.removeEventListener("popupshowing", update_tooltip_content, false);
            toolbarPopupMenu.removeEventListener("popupshowing", update_menu_content, false);
            toolbarPopupMenu.removeEventListener("command", onMenuCommand, false);
            // Clear change event handlers
            win.removeEventListener("sixornot-page-change-event", page_change_handler, false);
            win.gBrowser.tabContainer.removeEventListener("TabSelect", tabselect_handler, false);

            // Remove UI
            tooltip.parentNode.removeChild(tooltip);
            toolbarPopupMenu.parentNode.removeChild(toolbarPopupMenu);
            toolbarButton.parentNode.removeChild(toolbarButton);
        }, win);
    };

    add_addressicon = function () {
        var addressPopupMenu, addressIcon, addressButton, urlbaricons, starbutton,
            domWindow, domWindowUtils, domWindowInner, domWindowOuter,
            page_change_handler, tabselect_handler, update_icon;
        log("Sixornot - insert_code:add_addressicon", 2);

        addressPopupMenu = doc.createElementNS(NS_XUL, "menupopup");
        addressIcon = doc.createElementNS(NS_XUL, "image");
        addressButton = doc.createElementNS(NS_XUL, "box");

        log("Sixornot - insert_code:add_addressicon1", 2);
        // Menu setup
        addressPopupMenu.setAttribute("id", ADDRESS_MENU_ID);
        log("Sixornot - insert_code:add_addressicon1a", 2);
        addressPopupMenu.setAttribute("position", "after_start");
        log("Sixornot - insert_code:add_addressicon1b", 2);
        // Add event listener for popupMenu opening (to update popupMenu contents dynamically)
        addressPopupMenu.addEventListener("popupshowing", update_menu_content, false);
        log("Sixornot - insert_code:add_addressicon1c", 2);
        addressPopupMenu.addEventListener("command", onMenuCommand, false);

        log("Sixornot - insert_code:add_addressicon2", 2);
        // Address bar icon setup
        addressButton.setAttribute("id", ADDRESS_BOX_ID);
        addressButton.setAttribute("width", "16");
        addressButton.setAttribute("height", "16");
        addressButton.setAttribute("align", "center");
        addressButton.setAttribute("pack", "center");

        addressIcon.setAttribute("id", ADDRESS_IMG_ID);
        addressIcon.setAttribute("tooltip", TOOLTIP_ID);
        addressIcon.setAttribute("popup", ADDRESS_MENU_ID);
        addressIcon.setAttribute("width", "16");
        addressIcon.setAttribute("height", "16");
        addressIcon.setAttribute("src", sother_16);

        log("Sixornot - insert_code:add_addressicon3", 2);
        // Position the icon
        urlbaricons = gbi(doc, "urlbar-icons");
        starbutton = gbi(doc, "star-button");
        addressButton.appendChild(addressIcon);
        addressButton.appendChild(addressPopupMenu);

        log("Sixornot - insert_code:add_addressicon4", 2);
        // If star icon visible, insert before it, otherwise just append to urlbaricons
        if (!starbutton) {
            urlbaricons.appendChild(addressButton);
        } else {
            urlbaricons.insertBefore(addressButton, starbutton);
        }

        set_icon = function (source) {
            log("Sixornot - insert_code:add_addressicon:set_icon", 2);
        };


        /* Updates the icon to reflect state of the currently displayed page */
        update_icon = function () {
            log("Sixornot - insert_code:add_addressicon:update_icon", 1);
            /* Change icon to reflect status of current tab */
            var hosts = RequestCache[currentTabInnerID];
             
            if (!hosts) {
                // Analyse current location, see if it's not a valid page
                // TODO - fallback to DNS lookup of current name
                //      - store this in the cache
                log("Sixornot - main:add_addressicon - callback: update_state - typeof(hosts) is undefined!", 1);
                set_icon(s_other_16);
                return;
            }
             
            /* Parse array searching for the main host (which matches the current location) */
            hosts.forEach(function (element, index, thearray) {
                if (element.host === getCurrentHost()) {
                    log("Sixornot - main:add_addressicon - callback: update_state - updating icon!", 1);
                    addressIcon.src = get_icon_source(element);
                }
            });
        };

        /* Called whenever the current window's active tab is changed
           Calls the update method for the icon */
        tabselect_handler = function (evt) {
            log("Sixornot - insert_code:add_addressicon:tabselect_handler", 2);
            setCurrentTabIDs();
             
            /* Set state appropriately for the new tab. */
            var hosts = RequestCache[currentTabInnerID];

            update_icon();
        };

        /* Called whenever a Sixornot page change event is emitted
           Calls the update method for the icon, but only if the event applies to us */
        // TODO bind event to outer window such that we only ever hear events intended for us
        page_change_handler = function (evt) {
            log("Sixornot - insert_code:add_addressicon:page_change_handler - evt.outer_id: " + evt.outer_id + ", evt.inner_id: " + evt.inner_id + ", currentTabOuterID: " + currentTabOuterID + ", currentTabInnerID: " + currentTabInnerID, 1);
            // Set current tab ID before comparison to ensure we match event properties
            setCurrentTabIDs();

            // Ignore updates for windows other than this one
            if (evt.outer_id !== currentTabOuterID) {
                log("Sixornot - insert_code:add_addressicon - callback: update_state - Callback ID mismatch: evt.outer_id is: " + evt.outer_id + ", currentTabOuterID is: " + currentTabOuterID, 1);
                return;
            }

            update_icon();
        };

        /* We need the current outer tab ID to be set before
           the user has switched tabs for the first time. */
        log("Sixornot - insert_code:add_addressicon - calling setCurrentTabIDs", 2);
        setCurrentTabIDs();

        // Register for page change events
        log("Sixornot - insert_code:add_addressicon - registering listeners", 2);
        win.addEventListener("sixornot-page-change-event", page_change_handler, false);
        win.gBrowser.tabContainer.addEventListener("TabSelect", tabselect_handler, false);

        // Add a callback to unload to remove this icon
        unload(function () {
            log("Sixornot - address bar unload function", 2);

            // Clear event handlers
            addressPopupMenu.removeEventListener("popupshowing", update_menu_content, false);
            addressPopupMenu.removeEventListener("command", onMenuCommand, false);
            // Clear change event handlers
            win.removeEventListener("sixornot-page-change-event", page_change_handler, false);
            win.gBrowser.tabContainer.removeEventListener("TabSelect", tabselect_handler, false);

            // Remove UI
            addressPopupMenu.parentNode.removeChild(addressPopupMenu);
            addressIcon.parentNode.removeChild(addressIcon);
            addressButton.parentNode.removeChild(addressButton);
        }, win);
    };

    /* Returns the correct icon source entry for a given record */
    get_icon_source = function (record) {
        if (record.address_family === 4) {
            if (record.ipv6s.length !== 0) {
                // Actual is v4, DNS is v4 + v6 -> Orange
                return s4pot6_16;
            } else {
                // Actual is v4, DNS is v4 -> Red
                return s4only_16;
            }
        } else if (record.address_family === 6) {
            if (record.ipv4s.length === 0) {
                // Actual is v6, DNS is v6 -> Blue
                return s6only_16;
            } else {
                // Actual is v6, DNS is v4 + v6 -> Green
                return s6and4_16;
            }
        } else {
            if (record.ipv6s.length === 0) {
                if (record.ipv4s.length === 0) {
                    // No addresses at all!
                    return sother_16;
                } else {
                    // Actual is unknown, DNS is v4 -> Red
                    return s4only_16;
                }
            } else {
                if (record.ipv4s.length === 0) {
                    // Actual is unknown, DNS is v6, Local is any -> Blue
                    return s6only_16;
                } else {
                    if (localipv6s.length === 0) {
                        // Actual is unknown, DNS is v4 + v6, Local is v4 -> Orange
                        return s4pot6_16;
                    } else if (dns_handler.is_ip4only_domain(host)) {
                        // Always Orange if ip4only set + we have a local v6
                        return s4pot6_16;
                    } else {
                        if (localipv6s.map(dns_handler.typeof_ip6).indexOf("global") !== -1) {
                            // Actual is unknown, DNS is v4 + v6, Local is v4 + v6 -> Green
                            return s6and4_16;
                        } else {
                            // Actual is unknown, DNS is v4 + v6, Local is v4 -> Orange
                            return s4pot6_16;
                        }
                    }
                }
            }
        }
    };


    // Update the contents of the popupMenu whenever it is opened
    // Value of "this" will be the menu (since this is an event handler)
    update_menu_content = function (evt) {
        var i, popupMenu, add_menu_item, add_toggle_menu_item, add_disabled_menu_item, add_menu_separator, remotestring, localstring, test_global4, test_global6;
        log("Sixornot - main:update_menu_content", 2);
        // log("Sixornot - ipv4s: " + ipv4s + ", ipv6s: " + ipv6s + ", localipv4s: " + localipv4s + ", localipv6s: " + localipv6s + ", ", 2);
        // Set value so that functions within this one can still access correct value of "this"
        popupMenu = this;

        // Clear previously generated popupMenu, if one exists
        while (popupMenu.firstChild) {
            popupMenu.removeChild(popupMenu.firstChild);
        }

        // labelName - displayed on menu item
        // ttText - tooltip for menu item
        // commandID - string of arbitrary data
        //  first 5 characters determine function call
        //  rest of string (if any) is data to use for function call
        add_menu_item = function (labelName, ttText, commandID) {
            var menuitem;
            log("Sixornot - main:update_menu_content:add_menu_item: " + labelName + ", " + ttText + ", " + commandID, 2);
            menuitem = doc.createElementNS(NS_XUL, "menuitem");
            menuitem.setAttribute("label", labelName);
            menuitem.setAttribute("tooltiptext", ttText);
            menuitem.setAttribute("value", commandID);
            popupMenu.appendChild(menuitem);
        };
        add_toggle_menu_item = function (labelName, ttText, commandID, initialState) {
            var menuitem;
            log("Sixornot - main:update_menu_content:add_toggle_menu_item: " + labelName + ", " + ttText + ", " + commandID + ", " + initialState, 2);
            menuitem = doc.createElementNS(NS_XUL, "menuitem");
            menuitem.setAttribute("label", labelName);
            menuitem.setAttribute("tooltiptext", ttText);
            menuitem.setAttribute("value", commandID);
            menuitem.setAttribute("type", "checkbox");
            menuitem.setAttribute("checked", initialState);
            popupMenu.appendChild(menuitem);
        };
        add_disabled_menu_item = function (labelName) {
            var menuitem;
            log("Sixornot - main:update_menu_content:add_disabled_menu_item: " + labelName, 2);
            menuitem = doc.createElementNS(NS_XUL, "menuitem");
            menuitem.setAttribute("label", labelName);
            menuitem.setAttribute("disabled", true);
            popupMenu.appendChild(menuitem);
        };
        add_menu_separator = function () {
            var menuseparator;
            log("Sixornot - main:update_menu_content:add_menu_separator", 2);
            menuseparator = doc.createElementNS(NS_XUL, "menuseparator");
            popupMenu.appendChild(menuseparator);
        };

        test_global4 = function (item) {
            return ["global", "rfc1918"].indexOf(dns_handler.typeof_ip4(item)) !== -1;
        };
        test_global6 = function (item) {
            return dns_handler.typeof_ip6(item) === "global";
        };

        if (ipv4s.length !== 0 || ipv6s.length !== 0 || host !== "") {
            if (host !== "") {
                // If host is an IP address and appears in either array of addresses do not display as hostname
                // (This would occur if the URL contains an IP address rather than a hostname)
                if (ipv4s.indexOf(host) === -1 && ipv6s.indexOf(host) === -1) {
                    // Build string containing list of all IP addresses (for copying to clipboard)
                    remotestring = Array.concat([host], ipv6s, ipv4s).join(", ");
                    add_menu_item(host, gt("tt_copydomclip"), "copyc" + remotestring);
                } else {
                    // In this case there will only ever be one IP address record
                    add_disabled_menu_item(gt("hostnameisip"));
                }
            } else {
                add_disabled_menu_item(gt("nohostnamefound"));
            }

            for (i = 0; i < ipv6s.length; i += 1) {
                add_menu_item(ipv6s[i], gt("tt_copyip6clip"), "copyc" + ipv6s[i]);
            }
            for (i = 0; i < ipv4s.length; i += 1) {
                add_menu_item(ipv4s[i], gt("tt_copyip4clip"), "copyc" + ipv4s[i]);
            }
        } else {
            add_disabled_menu_item(gt("noremoteloaded"));
        }

        add_menu_separator();

        // Produce string containing all IP data for copy
        // TODO - check showallips, only build array of global IPs here
        if (get_bool_pref("showallips")) {
            l6_filtered = localipv6s;
            l4_filtered = localipv4s;
        } else {
            l6_filtered = localipv6s.filter(test_global6);
            l4_filtered = localipv4s.filter(test_global4);
        }
        localstring = Array.concat([dnsService.myHostName],
                                   l6_filtered, l4_filtered).join(", ");
        add_menu_item(dnsService.myHostName + " (localhost)",
                      gt("tt_copylocalclip"),
                      "copyc" + localstring);

        for (i = 0; i < l6_filtered.length; i += 1) {
            add_menu_item(l6_filtered[i], gt("tt_copyip6clip"), "copyc" + l6_filtered[i]);
        }
        for (i = 0; i < l4_filtered.length; i += 1) {
            add_menu_item(l4_filtered[i], gt("tt_copyip4clip"), "copyc" + l4_filtered[i]);
        }

        add_menu_separator();

        // Preferences toggle menu items
        add_toggle_menu_item(gt("showaddressicon"),
                             gt("tt_showaddressicon"),
                             "tbool" + "showaddressicon",
                             PREF_BRANCH_SIXORNOT.getBoolPref("showaddressicon"));
        add_toggle_menu_item(gt("greyscaleicons"),
                             gt("tt_usegreyscale"),
                             "tbool" + "greyscaleicons",
                             PREF_BRANCH_SIXORNOT.getBoolPref("greyscaleicons"));
        add_toggle_menu_item(gt("showallips"),
                             gt("tt_showallips"),
                             "tbool" + "showallips",
                             PREF_BRANCH_SIXORNOT.getBoolPref("showallips"));

        add_menu_separator();
        add_menu_item(gt("gotowebsite"),
                      gt("tt_gotowebsite"),
                      "gotow" + "http://entropy.me.uk/sixornot/");
    };

    // Update the contents of the tooltip whenever it is shown
    // Value of "this" will be the tooltip (since this is an event handler)
    update_tooltip_content = function (evt) {
        var tooltip, grid, rows, i, add_title_line, add_labeled_line, extraString,
            extraLine, test_global4, test_global6, domWindow, domWindowUtils,
            domWindowInner, domWindowOuter, hosts, add_v6_line, add_v4_line, add_host_line,
            add_line;
        log("Sixornot - main:update_tooltip_content", 2);
        // log("Sixornot - ipv4s: " + ipv4s + ", ipv6s: " + ipv6s + ", localipv4s: " + localipv4s + ", localipv6s: " + localipv6s + ", ", 2);
        tooltip = this;

        add_line = function (labelName, labelStyle, valueName, valueStyle) {
            var row, label, value;
            log("Sixornot - main:update_tooltip_content:add_line - labelName: " + labelName + ", labelStyle: " + labelStyle + ", valueName: " + valueName + ", valueStyle: " + valueStyle, 2);
            row = doc.createElementNS(NS_XUL, "row");
            label = doc.createElementNS(NS_XUL, "label");
            value = doc.createElementNS(NS_XUL, "label");

            label.setAttribute("value", labelName);
            label.setAttribute("style", labelStyle);
            value.setAttribute("value", valueName);
            value.setAttribute("style", valueStyle);

            row.appendChild(label);
            row.appendChild(value);
            rows.appendChild(row);
        };
        add_v6_line = function (address) {
            add_line(" ", "", address, "color: #0F0;");
        };
        add_v4_line = function (address) {
            add_line(" ", "", address, "color: #F00;");
        };
        add_host_line = function (host, address, address_family) {
            if (address_family === 4) {
                add_line(host, "", address, "color: #F00;");
            } else if (address_family === 6) {
                add_line(host, "", address, "color: #0F0;");
            } else {
                // Error invalid family
                add_line(host, "", "No address", "color: #00F;");
            }
        };
        add_bold_host_line = function (host, address, address_family) {
            if (address_family === 4) {
                add_line(host, "font-weight: bold;", address, "color: #F00;");
            } else if (address_family === 6) {
                add_line(host, "font-weight: bold;", address, "color: #0F0;");
            } else {
                // Invalid family or no address
                add_line(host, "font-weight: bold;", "No address", "color: #00F;");
            }
        };

        add_title_line = function (labelName) {
            var label, value;
            log("Sixornot - main:update_tooltip_content:add_title_line - labelName: " + labelName, 2);
            label = doc.createElementNS(NS_XUL, "label");

            label.setAttribute("value", labelName);
            label.setAttribute("style", "font-weight: bold; text-align: right;");
            rows.appendChild(label);
        };

        add_warning_line = function (labelName) {
            var label, value;
            log("Sixornot - main:update_tooltip_content:add_warning_line - labelName: " + labelName, 2);
            label = doc.createElementNS(NS_XUL, "label");

            label.setAttribute("value", labelName);
            label.setAttribute("style", "font-weight: bold; text-align: left; color: #F00;");
            rows.appendChild(label);
        };

        add_labeled_line = function (labelName, lineValue, italic) {
            var row, label, value;
            log("Sixornot - main:update_tooltip_content:add_labeled_line - labelName: " + labelName + ", lineValue: " + lineValue + ", italic: " + italic, 2);
            row = doc.createElementNS(NS_XUL, "row");
            label = doc.createElementNS(NS_XUL, "label");
            value = doc.createElementNS(NS_XUL, "label");
            // Set defaults
            labelName = labelName || " ";
            lineValue = lineValue || " ";

            label.setAttribute("value", labelName);
            label.setAttribute("style", "font-weight: bold;");
            value.setAttribute("value", lineValue);
            if (italic) {
                value.setAttribute("style", "font-style: italic;");
            }
            row.appendChild(label);
            row.appendChild(value);
            rows.appendChild(row);
        };

        test_global4 = function (item) {
            return ["global", "rfc1918"].indexOf(dns_handler.typeof_ip4(item)) !== -1;
        };
        test_global6 = function (item) {
            return dns_handler.typeof_ip6(item) === "global";
        };
        // Clear previously generated tooltip, if one exists
        while (tooltip.firstChild) {
            tooltip.removeChild(tooltip.firstChild);
        }

        grid = doc.createElement("grid");
        rows = doc.createElement("rows");

        // New functionality, get IDs for lookup
        domWindow = win.gBrowser.mCurrentBrowser.contentWindow;
        domWindowUtils = domWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);
        domWindowInner = domWindowUtils.currentInnerWindowID;
        domWindowOuter = domWindowUtils.outerWindowID;

        hosts = RequestCache[domWindowInner];

        add_host = function (host, index, myarray) {
            if (true || host.host === getCurrentHost()) {
                // Full details
                add_bold_host_line(host.host, host.address, host.address_family);
                host.ipv6s.forEach(function (address, index, addresses) {
                    add_v6_line(address);
                });
                host.ipv4s.forEach(function (address, index, addresses) {
                    add_v4_line(address);
                });
            } else {
                // Summary
                add_host_line(host.host, host.address, host.address_family);
            }
        };


        // Warnings
        if (dns_handler.is_ip6_disabled()) {
            add_warning_line(gt("warn_ip6_disabled"));
        }

        /* if (dns_handler.is_ip4only_domain(host)) {       TODO
            add_warning_line(gt("warn_ip4only_domain"));
        } */

        // New functionality
        if (!hosts) {
            add_title_line(gt("header_remote"), "");
            add_warning_line("no hosts found, inner ID: " + domWindowInner + ", outer ID: " + domWindowOuter, "");
        } else {
            hosts.forEach(add_host);
        }

        /* Add local IP addresses, only show proper addresses unless setting set */
        if (get_bool_pref("showallips")) {
            l6_filtered = localipv6s;
            l4_filtered = localipv4s;
        } else {
            l6_filtered = localipv6s.filter(test_global6);
            l4_filtered = localipv4s.filter(test_global4);
        }
        // Add local IP address information if available
        if (l4_filtered.length !== 0 || l6_filtered.length !== 0) {
            add_labeled_line();
            add_title_line(gt("header_local"));
            add_labeled_line(gt("prefix_host"), dnsService.myHostName);
        }

        // Add local IPv6 address(es) to tooltip with special case if only one
        if (l6_filtered.length === 1) {
            add_labeled_line(gt("prefix_v6_single"), l6_filtered[0], test_global6(!l6_filtered[0]));
        } else if (l6_filtered.length > 1) {
            add_labeled_line(gt("prefix_v6_multi"), l6_filtered[0], test_global6(!l6_filtered[0]));
            for (i = 1; i < l6_filtered.length; i += 1) {
                add_labeled_line(" ", l6_filtered[i], test_global6(!l6_filtered[i]));
            }
        }

        // Add local IPv4 address(es) to tooltip with special case if only one
        if (l4_filtered.length === 1) {
            add_labeled_line(gt("prefix_v4_single"), l4_filtered[0], test_global4(!l4_filtered[0]));
        } else if (l4_filtered.length > 1) {
            add_labeled_line(gt("prefix_v4_multi"), l4_filtered[0], test_global4(!l4_filtered[0]));
            for (i = 1; i < l4_filtered.length; i += 1) {
                add_labeled_line(" ", l4_filtered[i], test_global4(!l4_filtered[i]));
            }
        }

        // TODO - Replace this with an array mapping/lookup table
        // TODO - If a special location is set no need to do any of the IP address stuff!
/*        if (specialLocation) {
            if (specialLocation[0] === "localfile") {
                extraString = gt("other_localfile");
            } else if (specialLocation[0] === "lookuperror") {
                extraString = gt("other_lookuperror");
            } else if (specialLocation[0] === "nodnserror") {
                extraString = gt("other_nodnserror");
            } else if (specialLocation[0] === "offlinemode") {
                extraString = gt("other_offlinemode");
            }

            if (specialLocation[1]) {
                extraString += " (" + specialLocation[1] + ")";
            }
            extraLine = doc.createElement("label");
            extraLine.setAttribute("value", extraString);
            if (["unknownsite", "lookuperror", "nodnserror", "offlinemode"].indexOf(specialLocation[0]) !== -1) {
                extraLine.setAttribute("style", "font-style: italic;");
            }
            rows.appendChild(extraLine);
        } */

        grid.appendChild(rows);
        tooltip.appendChild(grid);
    };


    // Create address bar icon
    // Add address bar icon only if desired by preferences
    if (get_bool_pref("showaddressicon")) {
        log("Sixornot - insert_code: add addressicon", 1);
        add_addressicon();
    }

    // Create button
    log("Sixornot - insert_code: add mainui", 1);
    add_mainui();

};






main = function (win)
{
    var contentDoc, url, host, ipv4s, ipv6s, localipv4s, localipv6s,
        specialLocation, dns_request, pollLoopID, doc,
        add_mainui, add_addressicon, pollForContentChange, updateState,
        update_icon, onMenuCommand, update_menu_content, update_tooltip_content,
        onChangedOnlineStatus;
    log("Sixornot - main", 1);
    // Set up initial value of variables for this instance
    contentDoc = null;      // Reference to the current page document object
    url = "";               // The URL of the current page
    host = "";              // The host name of the current URL
    ipv4s = [];             // The IP addresses of the current host
    ipv6s = [];             // The IP addresses of the current host
    localipv6s = [];        // Local IPv6 addresses
    localipv4s = [];        // Local IPv4 addresses
    specialLocation = null;
    dns_request = null;     // Reference to this window's active DNS lookup request
                            // There can be only one at a time per window
    doc = win.document;

    // Add tooltip, iconized button and address bar icon to browser window
    // These are created in their own scope, they need to be found again
    // using their IDs for the current window

    // Updates icon/tooltip etc. state if needed - called by the polling loop
    // TODO - This whole process needs a rethink - needs a better workflow
    updateState = function (newentry)
    {
        var addressIcon, toolbarButton, set_icon, onReturnedIPs ;
        log("Sixornot - main:updateState", 2);

        addressIcon = gbi(doc, ADDRESS_IMG_ID);
        toolbarButton = gbi(doc, BUTTON_ID) || gbi(gbi(doc, "navigator-toolbox").palette, BUTTON_ID);

        contentDoc = win.content.document;
        url = contentDoc.location.href;
        host = "";
        ipv6s = [];
        ipv4s = [];
        localipv6s = [];
        localipv4s = [];

        // If we've changed pages before completing a lookup, then abort the old request first
        dns_handler.cancel_request(dns_request);
        dns_request = null;

        // Need to look up host
        try
        {
            host = crop_trailing_char(contentDoc.location.hostname, ".");
        } 
        catch (e)
        {
            log("Sixornot - Unable to determine host from page URL");
        }
        if (host === "")
        {
            set_icon(sother_16);
            specialLocation = ["unknownsite"];
            log("Sixornot warning: no host returned for \"" + url + "\"");
            return;
        }

        // Offline mode or otherwise not connected
        if (!win.navigator.onLine)
        {
            set_icon(sother_16);
            specialLocation = ["offlinemode"];
            log("Sixornot is in offline mode");
            return;
        }

        // Proxy in use for DNS; can't do a DNS lookup
        if (dns_handler.is_proxied_dns(url))
        {
            set_icon(sother_16);
            specialLocation = ["nodnserror"];
            log("Sixornot is in proxied mode");
            return;
        }

        onReturnedIPs = function (remoteips)
        {
            var onReturnedLocalIPs;
            log("Sixornot - main:updateState:onReturnedIPs", 2);
            dns_request = null;

            // DNS lookup failed
            // TODO - we should still perform local lookup at this point?
            if (remoteips[0] === "FAIL")
            {
                set_icon(sother_16);
                specialLocation = ["lookuperror"];
                return;
            }

            log("Sixornot - main:updateState:onReturnedIPs - remoteips is: " + remoteips + "; typeof remoteips is: " + typeof remoteips, 2);

            // Parse list of IPs for IPv4/IPv6
            ipv6s = remoteips.filter(dns_handler.is_ip6);
            ipv4s = remoteips.filter(dns_handler.is_ip4);

            // Parse list of local IPs for IPv6
            ipv6s.sort(function (a, b) {
                return dns_handler.sort_ip6.call(dns_handler, a, b);
            });

            // Parse list of local IPs for IPv4
            ipv4s.sort(function (a, b) {
                return dns_handler.sort_ip4.call(dns_handler, a, b);
            });

            log("Sixornot - main:updateState:onReturnedIPs - found remote IP addresses, trying local next", 2);

            // Update our local IP addresses (need these for the update_icon phase, and they ought to be up-to-date)
            // Should do this via an async process to avoid blocking (but getting local IPs should be really quick!)

            onReturnedLocalIPs = function (localips)
            {
                log("Sixornot - main:updateState:onReturnedIPs:onReturnedLocalIPs", 2);
                dns_request = null;

                log("Sixornot - main:updateState:onReturnedIPs:onReturnedLocalIPs - localips is: " + localips + "; typeof localips is: " + typeof localips);
                log("Sixornot - main:updateState:onReturnedIPs:onReturnedLocalIPs - performing filter", 2);

                localipv6s = localips.filter(function (a) {
                    return dns_handler.is_ip6(a) && dns_handler.typeof_ip6(a) !== "localhost"; });
                localipv4s = localips.filter(function (a) {
                    return dns_handler.is_ip4(a) && dns_handler.typeof_ip4(a) !== "localhost"; });

                log("Sixornot - main:updateState:onReturnedIPs:onReturnedLocalIPs - localipv4s: " + localipv4s + ", localipv6s: " + localipv6s, 2);
                log("Sixornot - main:updateState:onReturnedIPs:onReturnedLocalIPs - performing sort", 2);
                // Parse list of local IPs for IPv6
                localipv6s.sort(function (a, b) {
                    return dns_handler.sort_ip6.call(dns_handler, a, b);
                });

                // Parse list of local IPs for IPv4
                localipv4s.sort(function (a, b) {
                    return dns_handler.sort_ip4.call(dns_handler, a, b);
                });

                log("Sixornot - main:updateState:onReturnedIPs:onReturnedLocalIPs - localipv4s: " + localipv4s + ", localipv6s: " + localipv6s, 2);

                log("Sixornot - main:updateState:onReturnedIPs:onReturnedLocalIPs - found local IP addresses");

                // This must now work as we have a valid IP address
                update_icon();
            };

            dns_request = dns_handler.resolve_local_async(onReturnedLocalIPs);
        };

        // Ideally just hitting the DNS cache here
        dns_request = dns_handler.resolve_remote_async(host, onReturnedIPs);
    };

    // Update the status icon state (icon & tooltip)
    // Returns true if it's done and false if unknown
    update_icon = function () {
        var addressIcon, toolbarButton, loc_options;
        log("Sixornot - main:update_icon", 2);
        addressIcon = gbi(doc, ADDRESS_IMG_ID);
        toolbarButton = gbi(doc, BUTTON_ID) || gbi(gbi(doc, "navigator-toolbox").palette, BUTTON_ID);

        loc_options = ["file:", "data:", "about:", "chrome:", "resource:"];

        log("Sixornot - ipv4s: " + ipv4s + ", ipv6s: " + ipv6s + ", localipv4s: " + localipv4s + ", localipv6s: " + localipv6s + ", ", 2);

        function set_icon (icon)
        {
            log("Sixornot - main:update_icon:set_icon - icon: " + icon, 2);
            // If this is null, address icon isn't showing
            if (addressIcon !== null)
            {
                addressIcon.src = icon;
            }
            toolbarButton.style.listStyleImage = "url('" + icon + "')";
        }

        // For any of these protocols, display "other" icon
        if (loc_options.indexOf(contentDoc.location.protocol) !== -1)
        {
            set_icon(sother_16);
            specialLocation = ["localfile"];
            return true;
        }

        // Unknown host -> still need to look up
        if (host === "")
        {
            return false;
        }


        // If the current domain is specified in the list:
        // network.dns.ipv4OnlyDomains
        // Then always display red or orange icon, even if we get IPv6 records back and have a local globally routeable v6 address

        // If network.dns.disableIPv6 is set, display warning message in tooltip and always show red/orange

        // If a proxy is detected, use special proxy icon + display warning in tooltip


        // Valid URL, valid host etc., ready to update the icon
        if (ipv6s.length === 0)
        {
            // We only have IPv4 addresses for the website
            if (ipv4s.length === 0)
            {
                // No addresses at all, question mark icon
                set_icon(sother_16);
            }
            else
            {
                // v4 only icon
                set_icon(s4only_16);
            }
        }
        else
        {
            // They have at least one IPv6 address
            if (ipv4s.length === 0)
            {
                // They only have IPv6 addresses, v6 only icon
                set_icon(s6only_16);
            }
            else
            {
                // v6 and v4 addresses, depending on possibility of v6 connection display green or yellow
                if (localipv6s.length === 0)
                {
                    // Site has a v6 address, but we do not, so we're probably not using v6 to connect
                    set_icon(s4pot6_16);
                }
                else if (dns_handler.is_ip4only_domain(host))
                {
                    // Site has v6, but is in the list of sites to connect to via v4, so display orange icon
                    // Tooltip should show warning about this!
                    set_icon(s4pot6_16);
                }
                else
                {
                    // If at least one of the IPv6 addresses we have is of the global type show green icon
                    if (localipv6s.map(dns_handler.typeof_ip6).indexOf("global") !== -1)
                    {
                        set_icon(s6and4_16);
                    }
                    // Otherwise show only yellow icon, we may have an IPv6 address but it may not be globally routeable
                    else
                    {
                        set_icon(s4pot6_16);
                    }
                }
            }
        }
        specialLocation = null;
        return true;
    };


;


    // Online/Offline events can trigger multiple times
    // reset contentDoc so that the next time the timer fires it'll be updated
    onChangedOnlineStatus = function (evt)
    {
        contentDoc = null;
    };

    // Start polling loop responsible for refreshing icon(s)
    // pollLoopID = win.setInterval(pollForContentChange, 250);

    // Add main UI
    add_mainui();

    // Add address bar icon only if desired by preferences
    if (get_bool_pref("showaddressicon"))
    {
        add_addressicon();
    }

};


// Image set is either colour or greyscale
set_iconset = function ()
{
    log("Sixornot - set_iconset", 2);
    // If greyscaleicons is set to true, load grey icons, otherwise load default set
    if (get_bool_pref("greyscaleicons"))
    {
        s6only_16 = s6only_16_g;
        s6and4_16 = s6and4_16_g;
        s4pot6_16 = s4pot6_16_g;
        s4only_16 = s4only_16_g;
        sother_16 = sother_16_g;
        s6only_24 = s6only_24_g;
        s6and4_24 = s6and4_24_g;
        s4pot6_24 = s4pot6_24_g;
        s4only_24 = s4only_24_g;
        sother_24 = sother_24_g;
    }
    else
    {
        s6only_16 = s6only_16_c;
        s6and4_16 = s6and4_16_c;
        s4pot6_16 = s4pot6_16_c;
        s4only_16 = s4only_16_c;
        sother_16 = sother_16_c;
        s6only_24 = s6only_24_c;
        s6and4_24 = s6and4_24_c;
        s4pot6_24 = s4pot6_24_c;
        s4only_24 = s4only_24_c;
        sother_24 = sother_24_c;
    }
};

/*
    bootstrap.js API
*/
startup = function (aData, aReason)
{
    var resource, alias;
    log("Sixornot - startup - reason: " + aReason, 0);
    // Set up resource URI alias
    resource = Services.io.getProtocolHandler("resource").QueryInterface(Components.interfaces.nsIResProtocolHandler);
    alias = Services.io.newFileURI(aData.installPath);
    if (!aData.installPath.isDirectory())
    {
        alias = Services.io.newURI("jar:" + alias.spec + "!/", null, null);
    }
    // This triggers a warning on AMO validation
    // The resource substitution is cleaned up by the addon's shutdown method
    // Search for "resource.setSubstitution("sixornot", null);"
    resource.setSubstitution("sixornot", alias);

    AddonManager.getAddonByID(aData.id, function (addon, data)
    {
        var prefs;

        // Include libraries
        log("Sixornot - main - including: " + addon.getResourceURI("includes/utils.js").spec, 2);
        include(addon.getResourceURI("includes/utils.js").spec);
        log("Sixornot - main - including: " + addon.getResourceURI("includes/locale.js").spec, 2);
        include(addon.getResourceURI("includes/locale.js").spec);

        // Init dns_handler
        dns_handler.init();

        // Run dns_handler tests
        // Only run these if debug level is set to 2 or higher
        if (get_int_pref("loglevel") >= 2)
        {
            dns_handler.test_normalise_ip6();
            dns_handler.test_typeof_ip6();
            dns_handler.test_is_ip6();
        }

        log("Sixornot - startup - initLocalisation...", 2);
        initLocalisation(addon, "sixornot.properties",
                         PREF_BRANCH_SIXORNOT.getCharPref("overridelocale"));

        // Load image sets
        // TODO - Split this all off into a seperate script and include it
        // TODO - Pre-load images into memory to reduce flicker when switching to one for first time
        log("Sixornot - startup - loading image sets...");
        // Greyscale
        s6only_16_g = addon.getResourceURI("images/6only_g_16.png").spec;
        s6and4_16_g = addon.getResourceURI("images/6and4_g_16.png").spec;
        s4pot6_16_g = addon.getResourceURI("images/4pot6_g_16.png").spec;
        s4only_16_g = addon.getResourceURI("images/4only_g_16.png").spec;
        sother_16_g = addon.getResourceURI("images/other_g_16.png").spec;
        s6only_24_g = addon.getResourceURI("images/6only_g_24.png").spec;
        s6and4_24_g = addon.getResourceURI("images/6and4_g_24.png").spec;
        s4pot6_24_g = addon.getResourceURI("images/4pot6_g_24.png").spec;
        s4only_24_g = addon.getResourceURI("images/4only_g_24.png").spec;
        sother_24_g = addon.getResourceURI("images/other_g_24.png").spec;
        // Colour
        s6only_16_c = addon.getResourceURI("images/6only_c_16.png").spec;
        s6and4_16_c = addon.getResourceURI("images/6and4_c_16.png").spec;
        s4pot6_16_c = addon.getResourceURI("images/4pot6_c_16.png").spec;
        s4only_16_c = addon.getResourceURI("images/4only_c_16.png").spec;
        sother_16_c = addon.getResourceURI("images/other_c_16.png").spec;
        s6only_24_c = addon.getResourceURI("images/6only_c_24.png").spec;
        s6and4_24_c = addon.getResourceURI("images/6and4_c_24.png").spec;
        s4pot6_24_c = addon.getResourceURI("images/4pot6_c_24.png").spec;
        s4only_24_c = addon.getResourceURI("images/4only_c_24.png").spec;
        sother_24_c = addon.getResourceURI("images/other_c_24.png").spec;

        // Set active image set
        log("Sixornot - startup - setting active image set...", 2);
        set_iconset();

        // Load into existing windows and set callback to load into any new ones too
        log("Sixornot - startup - loading into windows...", 2);
        watchWindows(insert_code);

        log("Sixornot - startup - setting up prefs observer...", 2);
        PREF_OBSERVER.register();

        log("Sixornot - startup - setting up dns prefs observer...", 2);
        PREF_OBSERVER_DNS.register();

        log("Sixornot - startup - setting up http observer...", 2);
        HTTP_REQUEST_OBSERVER.register();

    });
};

// Reload addon in all windows, e.g. when preferences change
reload = function ()
{
    log("Sixornot - reload", 1);
    unload();
    watchWindows(insert_code);
};

shutdown = function (aData, aReason)
{
    var prefs, resource;
    log("Sixornot - shutdown - reason: " + aReason, 0);

    if (aReason !== APP_SHUTDOWN)
    {
        // Unload all UI via init-time unload() callbacks
        unload();
        
        // Shutdown dns_handler
        dns_handler.shutdown();

        log("Sixornot - shutdown - removing prefs observer...", 2);
        PREF_OBSERVER.unregister();

        log("Sixornot - shutdown - removing dns prefs observer...", 2);
        PREF_OBSERVER_DNS.unregister();

        log("Sixornot - shutdown - removing http observer...", 2);
        HTTP_REQUEST_OBSERVER.unregister();

        // Remove resource substitution which was set up in startup method
        resource = Services.io.getProtocolHandler("resource").QueryInterface(Components.interfaces.nsIResProtocolHandler);
        resource.setSubstitution("sixornot", null);
    }
};

install = function (aData, aReason)
{
    log("Sixornot - install - reason: " + aReason, 0);
    set_initial_prefs();
};

uninstall = function (aData, aReason)
{
    log("Sixornot - uninstall - reason: " + aReason, 0);
    // TODO If this is due to an upgrade then don't delete preferences?
    // Some kind of upgrade function to potentially upgrade preference settings may be required
    // Upgrade function needs to check each existing setting which is in the current version's list of preferences
    // and determine if the value needs to be upgraded - this should be simple if the prefs are kept simple...
    if (aReason !== ADDON_UPGRADE)
    {
        PREF_BRANCH_SIXORNOT.deleteBranch("");
    }
};


/*
    Utility functions
*/

// Update preference which determines location of button when loading into new windows
// TODO - move into closure
toggle_customise = function (evt)
{
    var toolbox, button, b_parent, nextItem, toolbarId, nextItemId;
    log("Sixornot - toggle_customise");
    button = gbi(evt.target.parentNode, BUTTON_ID);
    if (button)
    {
        b_parent = button.parentNode;
        nextItem = button.nextSibling;
        if (b_parent && b_parent.localName === "toolbar")
        {
            toolbarId = b_parent.id;
            nextItemId = nextItem && nextItem.id;
        }
    }
    PREF_BRANCH_SIXORNOT.setCharPref(PREF_TOOLBAR,  toolbarId || "");
    PREF_BRANCH_SIXORNOT.setCharPref(PREF_NEXTITEM, nextItemId || "");
};

// Return integer preference value, either from prefs branch or internal defaults
// TODO - move into utils.js
get_int_pref = function (name)
{
    log("Sixornot - get_int_pref - name: " + name, 2);
    try
    {
        return PREF_BRANCH_SIXORNOT.getIntPref(name);
    }
    catch (e)
    {
        log("Sixornot - get_int_pref error - " + e, 0);
    }
    if (PREFS.hasOwnProperty(name))
    {
        log("Sixornot - get_int_pref returning PREFS[name] : " + PREFS[name], 2);
        return PREFS[name];
    }
    else
    {
        log("Sixornot - get_int_pref error - No default preference value for requested preference: " + name, 0);
    }
};

// Return boolean preference value, either from prefs branch or internal defaults
// TODO - move into utils.js
get_bool_pref = function (name)
{
    log("Sixornot - get_bool_pref - name: " + name, 2);
    try
    {
        return PREF_BRANCH_SIXORNOT.getBoolPref(name);
    }
    catch (e)
    {
        log("Sixornot - get_bool_pref error - " + e, 0);
    }
    if (PREFS.hasOwnProperty(name))
    {
        log("Sixornot - get_bool_pref returning PREFS[name] : " + PREFS[name], 2);
        return PREFS[name];
    }
    else
    {
        log("Sixornot - get_bool_pref error - No default preference value for requested preference: " + name, 0);
    }
};

// Return the current browser window
// TODO - Move into closure or into utils.js
get_current_window = function ()
{
    return Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator)
                     .getMostRecentWindow("navigator:browser");
};

// Proxy to getElementById
gbi = function (node, child_id)
{
    log("Sixornot - gbi - node: " + node + ", child_id: " + child_id, 2);
    if (node.getElementById)
    {
        return node.getElementById(child_id);
    }
    else
    {
        return node.querySelector("#" + child_id);
    }
};

// Set up initial values for preferences
// TODO - Move into closure
set_initial_prefs = function ()
{
    var key, val;
    log("Sixornot - set_initial_prefs", 2);
//    for ([key, val] in Iterator(PREFS))
    for (key in PREFS)
    {
        if (PREFS.hasOwnProperty(key))
        {
            // Preserve pre-existing values for preferences in case user has modified them
            val = PREFS[key];
            if (typeof val === "boolean")
            {
                if (PREF_BRANCH_SIXORNOT.getPrefType(key) === Services.prefs.PREF_INVALID)
                {
                    PREF_BRANCH_SIXORNOT.setBoolPref(key, val);
                }
            }
            else if (typeof val === "number")
            {
                if (PREF_BRANCH_SIXORNOT.getPrefType(key) === Services.prefs.PREF_INVALID)
                {
                    PREF_BRANCH_SIXORNOT.setIntPref(key, val);
                }
            }
            else if (typeof val === "string")
            {
                if (PREF_BRANCH_SIXORNOT.getPrefType(key) === Services.prefs.PREF_INVALID)
                {
                    PREF_BRANCH_SIXORNOT.setCharPref(key, val);
                }
            }
        }
    }
};

// Returns a string version of an exception object with its stack trace
parse_exception = function (e)
{
    log("Sixornot - parse_exception", 2);
    if (!e)
    {
        return "";
    }
    else if (!e.stack)
    {
        return String(e);
    }
    else
    {
        return String(e) + " \n" + e.stack;
    }
};

// String modification
// TODO - Move into utils.js
crop_trailing_char = function (str, character)
{
    return (str.charAt(str.length - 1) === character) ? str.slice(0, str.length - 1) : str.valueOf();
};


// Lazy getter services
defineLazyGetter = function (getterName, getterFunction)
{
    // The first time this getter is requested it'll decay into the function getterFunction
    /*jslint nomen: false*/
    this.__defineGetter__(getterName, function ()
        {
            /*jslint nomen: true*/
            // Remove stale reference to getterFunction
            delete this[getterName];
            // Produce a fresh copy of getterFunction with the correct this applied
            this[getterName] = getterFunction.apply(this);
            return this[getterName];
        }
    );
};

defineLazyGetter("consoleService", function () {
    return Components.classes["@mozilla.org/consoleservice;1"]
                    .getService(Components.interfaces.nsIConsoleService);
});
defineLazyGetter("ioService", function () {
    return Components.classes["@mozilla.org/network/io-service;1"]
                    .getService(Components.interfaces.nsIIOService);
});
defineLazyGetter("proxyService", function () {
    return Components.classes["@mozilla.org/network/protocol-proxy-service;1"]
                    .getService(Components.interfaces.nsIProtocolProxyService);
});
defineLazyGetter("dnsService", function () {
    return Components.classes["@mozilla.org/network/dns-service;1"]
                    .getService(Components.interfaces.nsIDNSService);
});
defineLazyGetter("clipboardHelper", function () {
    return Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                    .getService(Components.interfaces.nsIClipboardHelper);
});
defineLazyGetter("workerFactory", function () {
    return Components.classes["@mozilla.org/threads/workerfactory;1"]
                    .createInstance(Components.interfaces.nsIWorkerFactory);
});
defineLazyGetter("threadManager", function() {
    return Components.classes["@mozilla.org/thread-manager;1"]
                     .getService(Components.interfaces.nsIThreadManager);
});



// The DNS Handler which does most of the work of the extension
dns_handler =
{
    remote_ctypes: true,
    local_ctypes: true,

    callback_ids: [],
    next_callback_id: 0,

    worker: null,

    reqids: {
        shutdown: 0,        // Shut down DNS resolver, must be last request!
        remotelookup: 1,    // Perform dns.resolve_remote lookup
        locallookup: 2,     // Perform dns.resolve_local lookup
        checkremote: 3,     // Check whether ctypes resolver is in use for remote lookups
        checklocal: 4,      // Check whether ctypes resolver is in use for local lookups
        os: 253,            // Set the operating system
        loglevel: 254,      // Set the logging level of the ctypes resolver
        init: 255           // Initialise dns in the worker
    },

    /*
        Startup/shutdown functions for dns_handler - call init before using!
    */
    init : function ()
    {
        var that;
        log("Sixornot - dns_handler - init", 1);

        // Initialise ChromeWorker which will be used to do DNS lookups either via ctypes or dnsService
        this.worker = workerFactory.newChromeWorker("resource://sixornot/includes/dns_worker.js");

        // Shim to get 'this' to refer to dns_handler, not the
        // worker, when a message is received.
        that = this;
        this.worker.onmessage = function (evt) {
            that.onworkermessage.call(that, evt);
        };

        // Set up request map, which will map async requests to their callbacks
        this.callback_ids = [];
        this.next_callback_id = 0;
        // Every time a request is processed its callback is added to the callback_ids
        // When a request is completed the callback_ids can be queried to find the correct callback to call
        // Any message which doesn't need a callback association should be sent with a callback ID of -1

        // Finally set the logging level appropriately and call init
        this.worker.postMessage([-1, this.reqids.loglevel, PREF_BRANCH_SIXORNOT.getIntPref("loglevel")]);
        this.worker.postMessage([-1, this.reqids.init, xulRuntime.OS.toLowerCase()]);
    },

    set_worker_loglevel : function (newloglevel)
    {
        this.worker.postMessage([-1, this.reqids.loglevel, newloglevel]);
    },

    shutdown : function ()
    {
        log("Sixornot - dns_handler:shutdown", 1);
        // Shutdown async resolver
        this.worker.postMessage([-1, this.reqids.shutdown, null]);
    },


    /*
        IP Address utility functions
    */
    validate_ip4 : function (ip_address)
    {
        log("Sixornot - dns_handler:validate_ip4: " + ip_address, 2);
        // TODO - Write this function if needed, extensive validation of IPv4 address
        return false;
    },

    // Quick check for address family, not a validator (see validate_ip4)
    is_ip4 : function (ip_address)
    {
        log("Sixornot - dns_handler:is_ip4 " + ip_address, 2);
        return ip_address && (ip_address.indexOf(".") !== -1 && ip_address.indexOf(":") === -1);
    },

    // Return the type of an IPv6 address
    /*
        -- For IPv4 addresses types are (from RFC 3330) --

        Address Block             Present Use                       Reference
        ---------------------------------------------------------------------
        0.0.0.0/8            "This" Network                 [RFC1700, page 4]
        10.0.0.0/8           Private-Use Networks                   [RFC1918]
        14.0.0.0/8           Public-Data Networks         [RFC1700, page 181]
        24.0.0.0/8           Cable Television Networks                    --
        39.0.0.0/8           Reserved but subject
                               to allocation                       [RFC1797]
        127.0.0.0/8          Loopback                       [RFC1700, page 5]
        128.0.0.0/16         Reserved but subject
                               to allocation                             --
        169.254.0.0/16       Link Local                                   --
        172.16.0.0/12        Private-Use Networks                   [RFC1918]
        191.255.0.0/16       Reserved but subject
                               to allocation                             --
        192.0.0.0/24         Reserved but subject
                               to allocation                             --
        192.0.2.0/24         Test-Net
        192.88.99.0/24       6to4 Relay Anycast                     [RFC3068]
        192.168.0.0/16       Private-Use Networks                   [RFC1918]
        198.18.0.0/15        Network Interconnect
                               Device Benchmark Testing            [RFC2544]
        223.255.255.0/24     Reserved but subject
                               to allocation                             --
        224.0.0.0/4          Multicast                              [RFC3171]
        240.0.0.0/4          Reserved for Future Use        [RFC1700, page 4]

        route           0.0.0.0/8                                   Starts with 0
        local           127.0.0.0/24                                Starts with 127
        rfc1918         10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16   Starts with 10, 172.16-31, 192.168
        linklocal       169.254.0.0/16                              Starts with 169.254
        reserved        240.0.0.0/4                                 Starts with 240-255
        documentation   192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24   Starts with 192.0.2, 198.51.100, 203.0.113
        6to4relay       192.88.99.0/24                              Starts with 192.88.99
        benchmark       198.18.0.0/15                               Starts with 198.18, 198.19
        multicast       224.0.0.0/4                                 Starts with 224-239
    */

    // Pad an IPv4 address to permit lexicographical sorting
    pad_ip4 : function (ip4_address)
    {
        var pad = function (n)
        {
            return ("00" + n).substr(-3);
        };
        return ip4_address.split(".").map(pad).join(".");
    },
    // Remove leading zeros from IPv4 address
    unpad_ip4 : function (ip4_address)
    {
        var unpad = function (n)
        {
            return parseInt(n, 10);
        };
        return ip4_address.split(".").map(unpad).join(".");
    },

    // Sort IPv4 addresses into logical ordering
    sort_ip4 : function (a, b)
    {
        var typeof_a, typeof_b;
        typeof_a = this.typeof_ip4(a);
        typeof_b = this.typeof_ip4(b);
        // addresses of different types have a distinct precedence order
        // global, rfc1918, [other]
        if (typeof_a === typeof_b)
        {
            // TODO - move padding out of this function so it doesn't happen for every comparison in the sort
            a = this.pad_ip4(a);
            b = this.pad_ip4(b);
            if (a === b)
            {
                return 0;   // Identical
            }
            else if (a > b)
            {
                return 1;   // a > b
            }
            return -1;      // b > a
            // addresses of same type are compared based on their numeric values
            // e.g. 192.168.2.10 comes before 192.168.20.10
            // Compare expanded addresses, e.g. 010.011.002.003 with 010.012.001.019
            // Return -1 if a < b, 0 if a == b, 1 if a > b
        }
        // They are not equal
        else if (typeof_a === "global")
        {
            return -1;  // a comes before b
        }
        else if (typeof_b === "global")
        {
            return 1;   // b comes before a
        }
        // Neither of them are global
        else if (typeof_a === "rfc1918")
        {
            return -1;  // a comes before b
        }
        else if (typeof_b === "rfc1918")
        {
            return 1;   // b comes before a
        }
    },

    typeof_ip4 : function (ip_address)
    {
        var split_address;
        log("Sixornot - dns_handler:typeof_ip4 " + ip_address, 2);
        // TODO - Function in_subnet (network, subnetmask, ip) to check if specified IP is in the specified subnet range
        if (!dns_handler.is_ip4(ip_address))
        {
            return false;
        }
        split_address = ip_address.split(".").map(Number);
        if (split_address[0] === 0)
        {
            return "route";
        }
        else if (split_address[0] === 127)
        {
            return "localhost";
        }
        else if (split_address[0] === 10
             || (split_address[0] === 172 && split_address[1] >= 16 && split_address[1] <= 31)
             || (split_address[0] === 192 && split_address[1] === 168))
        {
            return "rfc1918";
        }
        else if (split_address[0] === 169 && split_address[1] === 254)
        {
            return "linklocal";
        }
        else if (split_address[0] >= 240)
        {
            return "reserved";
        }
        else if ((split_address[0] === 192 && split_address[1] === 0  && split_address[2] === 2)
              || (split_address[0] === 198 && split_address[1] === 51 && split_address[2] === 100)
              || (split_address[0] === 203 && split_address[1] === 0  && split_address[2] === 113))
        {
            return "documentation";
        }
        else if (split_address[0] === 192 && split_address[1] === 88 && split_address[2] === 99)
        {
            return "6to4relay";
        }
        else if (split_address[0] === 198 && [18,19].indexOf(split_address[1]) !== -1)
        {
            return "benchmark";
        }
        else if (split_address[0] >= 224 && split_address[0] <= 239)
        {
            return "multicast";
        }
        else
        {
            return "global";
        }
    },

    test_is_ip6 : function ()
    {
        var overall, tests, i, result;
        overall = true;
        tests = [
                        ["::",                                      true],
                        ["::1",                                     true],
                        ["fe80::fa22:22ff:fee8:2222",               true],
                        ["fc00::",                                  true],
                        ["ff00:1234:5678:9abc:def0:d:ee:fff",       true],
                        ["2:0::1:2",                                true],
                        ["2001:8b1:1fe4:1::2222",                   true],
                        ["2001:08b1:1fe4:0001:0000:0000:0000:2222", true],
                        ["192.168.2.1",                             false],
                        ["blah",                                    false],
                        [":::",                                     false],
                        [":",                                       false],
                        ["1::2::3",                                 false]
                    ];
        for (i = 0; i < tests.length; i += 1)
        {
            result = this.is_ip6(tests[i][0]);
            if (result === tests[i][1])
            {
                log("Sixornot - test_is_ip6, passed test value: " + tests[i][0] + ", result: " + result);
            }
            else
            {
                log("Sixornot - test_is_ip6, failed test value: " + tests[i][0] + ", expected result: " + tests[i][1] + ", actual result: " + result);
                overall = false;
            }
        }
        return overall;
    },

    validate_ip6 : function (ip_address)
    {
        log("Sixornot - dns_handler:validate_ip6: " + ip_address, 2);
        // TODO - Write this function if needed, extensive validation of IPv6 address
        return false;
    },

    // Quick check for address family, not a validator (see validate_ip6)
    is_ip6 : function (ip_address)
    {
        log("Sixornot - dns_handler:is_ip6: " + ip_address, 2);
        return ip_address && (ip_address.indexOf(":") !== -1);
    },

    test_normalise_ip6 : function ()
    {
        var overall, tests, i, result;
        overall = true;
        tests = [
                        ["::",                                      "0000:0000:0000:0000:0000:0000:0000:0000"],
                        ["::1",                                     "0000:0000:0000:0000:0000:0000:0000:0001"],
                        ["fe80::fa22:22ff:fee8:2222",               "fe80:0000:0000:0000:fa22:22ff:fee8:2222"],
                        ["fc00::",                                  "fc00:0000:0000:0000:0000:0000:0000:0000"],
                        ["ff00:1234:5678:9abc:def0:d:ee:fff",       "ff00:1234:5678:9abc:def0:000d:00ee:0fff"],
                        ["2:0::1:2",                                "0002:0000:0000:0000:0000:0000:0001:0002"],
                        ["2001:8b1:1fe4:1::2222",                   "2001:08b1:1fe4:0001:0000:0000:0000:2222"],
                        ["2001:08b1:1fe4:0001:0000:0000:0000:2222", "2001:08b1:1fe4:0001:0000:0000:0000:2222"],
                        ["fe80::fa1e:dfff:fee8:db18%en1",           "fe80:0000:0000:0000:fa1e:dfff:fee8:db18"]
                    ];
        for (i = 0; i < tests.length; i += 1)
        {
            result = this.normalise_ip6(tests[i][0]);
            if (result === tests[i][1])
            {
                log("Sixornot - test_normalise_ip6, passed test value: " + tests[i][0] + ", result: " + result, 1);
            }
            else
            {
                log("Sixornot - test_normalise_ip6, failed test value: " + tests[i][0] + ", expected result: " + tests[i][1] + ", actual result: " + result, 1);
                overall = false;
            }
        }
        return overall;
    },

    // Expand IPv6 address into long version
    normalise_ip6 : function (ip6_address)
    {
        var sides, left_parts, right_parts, middle, outarray, pad_left;
        log("Sixornot - dns_handler:normalise_ip6: " + ip6_address, 2);
        // Split by instances of ::
        sides = ip6_address.split("::");
        // Split remaining sections by instances of :
        left_parts = sides[0].split(":");
        right_parts = (sides[1] && sides[1].split(":")) || [];

        middle = ["0", "0", "0", "0", "0", "0", "0", "0"].slice(0, 8 - left_parts.length - right_parts.length);
        outarray = Array.concat(left_parts, middle, right_parts);

        // Pad each component to 4 char length with zeros to left (and convert to lowercase)
        pad_left = function (str)
        {
            return ("0000" + str).slice(-4);
        };

        return outarray.map(pad_left).join(":").toLowerCase();
    },

    // Unit test suite for typeof_ip6 function, returns false if a test fails
    test_typeof_ip6 : function ()
    {
        var overall, tests, i, result;
        overall = true;
        tests = [
                        ["::", "unspecified"],
                        ["::1", "localhost"],
                        ["fe80::fa22:22ff:fee8:2222", "linklocal"],
                        ["fec0::ffff:fa22:22ff:fee8:2222", "sitelocal"],
                        ["fc00::1", "uniquelocal"],
                        ["ff00::1", "multicast"],
                        ["2002::1", "6to4"],
                        ["2001:0000::1", "teredo"],
                        ["2001:8b1:1fe4:1::2222", "global"],
                        ["192.168.2.1", false],
                        ["blah", false],
                        [":", false],
                        ["...", false]
                    ];
        for (i = 0; i < tests.length; i += 1)
        {
            result = this.typeof_ip6(tests[i][0]);
            if (result === tests[i][1])
            {
                log("Sixornot - test_typeof_ip6, passed test value: " + tests[i][0] + ", result: " + result);
            }
            else
            {
                log("Sixornot - test_typeof_ip6, failed test value: " + tests[i][0] + ", expected result: " + i[1] + ", actual result: " + result);
                overall = false;
            }
        }
        return overall;
    },

    // Return the type of an IPv6 address
    /*
        -- For IPv6 addresses types are: --
        unspecified     ::/128                                          All zeros
        local           ::1/128         0000:0000:0000:0000:0000:0000:0000:0001
        linklocal       fe80::/10                                       Starts with fe8, fe9, fea, feb
        sitelocal       fec0::/10   (deprecated)                        Starts with fec, fed, fee, fef
        uniquelocal     fc00::/7    (similar to RFC1918 addresses)      Starts with: fc or fd
        pdmulticast     ff00::/8                                        Starts with ff
        v4transition    ::ffff:0:0/96 (IPv4-mapped)                     Starts with 0000:0000:0000:0000:0000:ffff
                        ::ffff:0:0:0/96 (Stateless IP/ICMP Translation) Starts with 0000:0000:0000:0000:ffff:0000
                        0064:ff9b::/96 ("Well-Known" prefix)            Starts with 0064:ff9b:0000:0000:0000:0000
        6to4            2002::/16                                       Starts with 2002
        teredo          2001::/32                                       Starts with 2001:0000
        benchmark       2001:2::/48                                     Starts with 2001:0002:0000
        documentation   2001:db8::/32                                   Starts with 2001:0db8
    */
    // Sort IPv6 addresses into logical ordering
    sort_ip6 : function (a, b)
    {
        var typeof_a, typeof_b;
        typeof_a = this.typeof_ip6(a);
        typeof_b = this.typeof_ip6(b);
        // addresses of different types have a distinct precedence order
        // global, linklocal, [other]
        if (typeof_a === typeof_b)
        {
            // TODO - move normalise out of this function so it doesn't happen for every comparison in the sort
            a = this.normalise_ip6(a);
            b = this.normalise_ip6(b);
            if (a === b)
            {
                return 0;   // Identical
            }
            else if (a > b)
            {
                return 1;   // a > b
            }
            return -1;      // b > a
            // addresses of same type are compared based on their numeric values
            // e.g. fe80::2001 comes before fe80::2:2001
            // Comparison can be made lexicographically on normalised address
            // Return -1 if a < b, 0 if a == b, 1 if a > b
        }
        // They are not equal
        else if (typeof_a === "global")
        {
            return -1;  // a comes before b
        }
        else if (typeof_b === "global")
        {
            return 1;   // b comes before a
        }
        // Neither of them are global
        else if (typeof_a === "linklocal")
        {
            return -1;  // a comes before b
        }
        else if (typeof_b === "linklocal")
        {
            return 1;   // b comes before a
        }

    },

    typeof_ip6 : function (ip_address)
    {
        var norm_address;
        log("Sixornot - dns_handler:typeof_ip6: " + ip_address, 2);
        // 1. Check IP version, return false if v4
        if (!dns_handler.is_ip6(ip_address))
        {
            return false;
        }
        // 2. Normalise address, return false if normalisation fails
        norm_address = dns_handler.normalise_ip6(ip_address);
        // 3. Compare against type patterns
        if (norm_address === "0000:0000:0000:0000:0000:0000:0000:0000")
        {
            return "unspecified";
        }
        if (norm_address === "0000:0000:0000:0000:0000:0000:0000:0001"
         || norm_address === "fe80:0000:0000:0000:0000:0000:0000:0001") // linklocal address of loopback interface on Mac OSX
        {
            return "localhost";
        }
        if (["fe8", "fe9", "fea", "feb"].indexOf(norm_address.substr(0, 3)) !== -1)
        {
            return "linklocal";
        }
        if (["fec", "fed", "fee", "fef"].indexOf(norm_address.substr(0, 3)) !== -1)
        {
            return "sitelocal";
        }
        if (["fc", "fd"].indexOf(norm_address.substr(0, 2)) !== -1)
        {
            return "uniquelocal";
        }
        if (["ff"].indexOf(norm_address.substr(0, 2)) !== -1)
        {
            return "multicast";
        }
        if (["2002"].indexOf(norm_address.substr(0, 4)) !== -1)
        {
            return "6to4";
        }
        if (["2001:0000"].indexOf(norm_address.substr(0, 9)) !== -1)
        {
            return "teredo";
        }
        // If no other type then address is global
        return "global";
    },

    /*
        Returns value of preference network.dns.disableIPv6
    */
    is_ip6_disabled : function ()
    {
        return Services.prefs.getBoolPref("network.dns.disableIPv6");
    },


    /*
        Returns true if the domain specified is in the list of IPv4-only domains
    */
    is_ip4only_domain : function (domain)
    {
        var ip4onlydomains, i;
        ip4onlydomains = Services.prefs.getCharPref("network.dns.ipv4OnlyDomains").replace(/\s+/g, "").toLowerCase().split(",");
        domain = domain.toLowerCase();
        for (i = 0; i < ip4onlydomains.length; i += 1)
        {
            if (domain === ip4onlydomains[i])
            {
                return true;
            }
        }
        return false;
    },

    /*
        Finding local IP address(es)
    */
    // Return the IP address(es) of the local host
    resolve_local_async : function (callback)
    {
        log("Sixornot - dns_handler:resolve_local_async");
        if (this.local_ctypes)
        {
            // If remote resolution is happening via ctypes...
            return this.local_ctypes_async(callback);
        }
        else
        {
            // Else if using firefox methods
            return this.local_firefox_async(callback);
        }
    },

    local_ctypes_async : function (callback)
    {
        var new_callback_id;
        log("Sixornot - dns_handler:local_ctypes_async - selecting resolver for local host lookup", 2);
        // This uses dns_worker to do the work asynchronously

        new_callback_id = this.add_callback_id(callback);

        this.worker.postMessage([new_callback_id, this.reqids.locallookup, null]);

        return this.make_cancel_obj(new_callback_id);
    },

    // Proxy to remote_firefox_async since it does much the same thing
    local_firefox_async : function (callback)
    {
        log("Sixornot - dns_handler:local_firefox_async - resolving local host using Firefox builtin method", 2);
        return this.remote_firefox_async(dnsService.myHostName, callback);
    },


    /*
        Finding remote IP address(es)
    */
    // Resolve IP address(es) of a remote host using DNS
    resolve_remote_async : function (host, callback)
    {
        log("Sixornot - dns_handler:resolve_remote_async - host: " + host + ", callback: " + callback, 2);
        if (this.remote_ctypes)
        {
            // If remote resolution is happening via ctypes...
            return this.remote_ctypes_async(host, callback);
        }
        else
        {
            // Else if using firefox methods
            return this.remote_firefox_async(host, callback);
        }
    },

    remote_ctypes_async : function (host, callback)
    {
        var new_callback_id;
        log("Sixornot - dns_handler:remote_ctypes_async - host: " + host + ", callback: " + callback, 2);
        // This uses dns_worker to do the work asynchronously

        new_callback_id = this.add_callback_id(callback);

        this.worker.postMessage([new_callback_id, this.reqids.remotelookup, host]);

        return this.make_cancel_obj(new_callback_id);
    },

    remote_firefox_async : function (host, callback)
    {
        var my_callback;
        log("Sixornot - dns_handler:remote_firefox_async - host: " + host + ", callback: " + callback, 2);

        my_callback =
        {
            onLookupComplete : function (nsrequest, dnsresponse, nsstatus)
            {
                var ip_addresses;
                // Request has been cancelled - ignore
                if (nsstatus === Components.results.NS_ERROR_ABORT)
                {
                    return;
                }
                // Request has failed for some reason
                if (nsstatus !== 0 || !dnsresponse || !dnsresponse.hasMore())
                {
                    if (nsstatus === Components.results.NS_ERROR_UNKNOWN_HOST)
                    {
                        log("Sixornot - dns_handler:remote_firefox_async - resolve host failed, unknown host", 1);
                        callback(["FAIL"]);
                    }
                    else
                    {
                        log("Sixornot - dns_handler:remote_firefox_async - resolve host failed, status: " + nsstatus, 1);
                        callback(["FAIL"]);
                    }
                    // Address was not found in DNS for some reason
                    return;  
                }
                // Otherwise address was found
                ip_addresses = [];
                while (dnsresponse.hasMore())
                {
                    ip_addresses.push(dnsresponse.getNextAddrAsString());
                }
                // Call callback for this request with ip_addresses array as argument
                callback(ip_addresses);
            }
        };
        try
        {
            return dnsService.asyncResolve(host, 0, my_callback, threadManager.currentThread);
        }
        catch (e)
        {
            Components.utils.reportError("Sixornot EXCEPTION: " + parse_exception(e));
            callback(["FAIL"]);
            return null;
        }
    },


    /*
        ctypes dns callback handling functions
    */
    // Index this.callback_ids and return required callback
    find_callback_by_id : function (callback_id)
    {
        var f;
        log("Sixornot - dns_handler:find_callback_by_id - callback_id: " + callback_id, 2);
        // Callback IDs is an array of 2-item arrays - [ID, callback]
        f = function (a)
        {
            return a[0];
        };
        // Returns -1 if ID not found
        return this.callback_ids.map(f).indexOf(callback_id);
    },

    // Search this.callback_ids for the ID in question, remove it if it exists
    remove_callback_id : function (callback_id)
    {
        var i;
        log("Sixornot - dns_handler:remove_callback_id - callback_id: " + callback_id, 2);
        i = this.find_callback_by_id(callback_id);
        if (i !== -1)
        {
            // Return the callback function
            return this.callback_ids.splice(i, 1)[0][1];
        }
        // If ID not found, return false
        return false;
    },

    // Add a callback to the callback_ids array with the next available ID
    add_callback_id : function (callback)
    {
        log("Sixornot - dns_handler:add_callback_id - callback: " + callback, 2);
        // Use next available callback ID, return that ID
        this.next_callback_id = this.next_callback_id + 1;
        this.callback_ids.push([this.next_callback_id, callback]);
        return this.next_callback_id;
    },

    make_cancel_obj : function (callback_id)
    {
        var obj;
        log("Sixornot - dns_handler:make_cancel_obj - callback_id: " + callback_id, 2);
        obj =
        {
            cancel : function ()
            {
                // Remove ID from callback_ids if it exists there
                dns_handler.remove_callback_id(callback_id);
            }
        };
        return obj;
    },


    /*
        Recieve and act on messages from Worker
    */
    // Called by worker to pass information back to main thread
    onworkermessage : function (evt)
    {
        var callback;
        log("Sixornot - dns_handler:onworkermessage - message: " + evt.data, 2);
        // evt.data is the information passed back
        // This is an array: [callback_id, request_id, data]
        // data will usually be a list of IP addresses
        // Look up correct callback in callback_ids array

        // checkremote, set remote ctypes status
        if (evt.data[1] === this.reqids.checkremote)
        {
            this.remote_ctypes = evt.data[2];
        }
        // checklocal, set local ctypes status
        else if (evt.data[1] === this.reqids.checklocal)
        {
            this.local_ctypes = evt.data[2];
        }
        else if (evt.data[1] === this.reqids.init)
        {
            log("Sixornot - dns_handler:onworkermessage - init ack received", 2);
        }
        else if (evt.data[1] === this.reqids.loglevel)
        {
            log("Sixornot - dns_handler:onworkermessage - loglevel change ack received", 2);
        }
        // remotelookup/locallookup, find correct callback and call it
        else if (evt.data[1] === this.reqids.remotelookup || evt.data[1] === this.reqids.locallookup)
        {
            callback = this.remove_callback_id(evt.data[0]);
            log("Sixornot - dns_handler:onworkermessage, typeof callback: " + typeof callback, 1);
            // Execute callback
            if (callback)
            {
                callback(evt.data[2]);
            }
        }
    },


    /*
        Misc.
    */

    // Cancels an active ctypes DNS lookup request currently being actioned by Worker
    cancel_request : function (request)
    {
        log("Sixornot - dns_handler:cancel_request - request: " + request, 2);
        try
        {
            // This function can be called with request as a null or undefined value
            if (request)
            {
                request.cancel(Components.results.NS_ERROR_ABORT);
            }
        }
        catch (e)
        {
            Components.utils.reportError("Sixornot EXCEPTION: " + parse_exception(e));
        }
    },

    // Returns true if the URL is set to have its DNS lookup proxied via SOCKS
    is_proxied_dns : function (url)
    {
        var uri, proxyinfo;
        log("Sixornot - dns_handler:is_proxied_dns - url: " + url, 2);
        uri = ioService.newURI(url, null, null);
        // Finds proxy (shouldn't block thread; we already did this lookup to load the page)
        proxyinfo = proxyService.resolve(uri, 0);
        // "network.proxy.socks_remote_dns" pref must be set to true for Firefox to set TRANSPARENT_PROXY_RESOLVES_HOST flag when applicable
        return (proxyinfo !== null) && (proxyinfo.flags && proxyinfo.TRANSPARENT_PROXY_RESOLVES_HOST);
    }

/*
    // Convert a base10 representation of a number into a base16 one (zero-padded to two characters, input number less than 256)
    to_hex : function (int_string)
    {
        var hex;
        hex = Number(int_string).toString(16);
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
*/
};



