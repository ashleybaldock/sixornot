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


/*jslint white: true, maxerr: 100, indent: 4 */

// Provided by Firefox:
/*global Components, Services, AddonManager */
/*global APP_STARTUP, APP_SHUTDOWN, ADDON_ENABLE, ADDON_DISABLE, ADDON_INSTALL, ADDON_UNINSTALL, ADDON_UPGRADE, ADDON_DOWNGRADE */

// Provided in included modules:
/*global gt, unload, watchWindows, initLocalisation, gbi, imagesrc, dns_handler */


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
    ADDRESS_IMG_ID,
    // Prefs branch constant
    PREF_BRANCH_SIXORNOT,
    PREF_BRANCH_DNS,
    // Preferences object (stores defaults)
    PREFS,
    // Prefs observer object - TODO - move into function where it is used? no need to be global?
    PREF_OBSERVER,
    PREF_OBSERVER_DNS,
    HTTP_REQUEST_OBSERVER,
    // Global functions
    // Main functionality
    insert_code,
    startup,
    shutdown,
    install,
    uninstall,
    reload,
    // Utility functions
    include,
    log,
    get_char_pref,
    get_int_pref,
    get_bool_pref,
    set_initial_prefs,
    parse_exception;


// Fake data for testing
var localipv4s = [];
var localipv6s = [];
var locallookuptime = 0;


/* Request Cache - keyed by ID, list of all hosts contacted per page */
var RequestCache = [];
var RequestWaitingList = [];


NS_XUL          = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
BUTTON_ID       = "sixornot-buttonid";
ADDRESS_IMG_ID  = "sixornot-addressimageid";


/* Preferences */
PREF_BRANCH_SIXORNOT = Services.prefs.getBranch("extensions.sixornot.");
PREF_BRANCH_DNS      = Services.prefs.getBranch("network.dns.");

// Default values for all Sixornot preferences
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
(function (scope) {
    "use strict";
    scope.include = function (src) {
        // This triggers a warning on AMO validation
        // This method is only used to import utils.js and locale.js
        // Which are local to this addon (under include directory)
        Services.scriptloader.loadSubScript(src, scope);
    };
}(this));


/* Logging utility functions */
// Log a message to error console, but only if it is important enough
log = (function () {
    "use strict";
    var get_loglevel = function () {
        try {
            return PREF_BRANCH_SIXORNOT.getIntPref("loglevel");
        } catch (e) {
            // Fallback to hard-coded default
            return PREFS.loglevel;
        }
    };
    return function (message, level) {
        // Three log levels, 0 = critical, 1 = normal, 2 = verbose
        // Default level is 1
        level = level || 1;
        // If preference unset, default to 1 (normal) level
        if (level <= get_loglevel()) {
            Components.classes["@mozilla.org/consoleservice;1"]
                .getService(Components.interfaces.nsIConsoleService)
                .logStringMessage(message);
        }
    };
}());

// Returns a string version of an exception object with its stack trace
parse_exception = function (e) {
    "use strict";
    log("Sixornot - parse_exception", 2);
    if (!e) {
        return "";
    } else if (!e.stack) {
        return String(e);
    } else {
        return String(e) + " \n" + e.stack;
    }
};


/*
    Sixornot Preferences observer
    Watches our preferences so that if the user changes them manually we update to reflect the changes
*/
PREF_OBSERVER = {
    observe: function (aSubject, aTopic, aData) {
        "use strict";
        log("Sixornot - PREF_OBSERVER - aSubject: " + aSubject + ", aTopic: " + aTopic.valueOf() + ", aData: " + aData, 2);
        if (aTopic.valueOf() !== "nsPref:changed") {
            log("Sixornot - PREF_OBSERVER - not a pref change event 1", 2);
            return;
        }
        if (!PREFS.hasOwnProperty(aData)) {
            log("Sixornot - PREF_OBSERVER - not a pref change event 2", 2);
            return;
        }

        if (aData === "showaddressicon") {
            log("Sixornot - PREF_OBSERVER - addressicon has changed", 1);
            reload();
        }
        if (aData === "greyscaleicons") {
            log("Sixornot - PREF_OBSERVER - greyscaleicons has changed", 1);
            reload();
        }
        // TODO Update worker process to use new log level?
        if (aData === "loglevel") {
            log("Sixornot - PREF_OBSERVER - loglevel has changed", 1);
        }
        if (aData === "overridelocale") {
            log("Sixornot - PREF_OBSERVER - overridelocale has changed", 1);
            reload();
        }
        if (aData === "showallips") {
            log("Sixornot - PREF_OBSERVER - showallips has changed", 1);
        }
    },

    nsIPB2: PREF_BRANCH_SIXORNOT.QueryInterface(Components.interfaces.nsIPrefBranch2),

    register: function () {
        "use strict";
        log("Sixornot - PREF_OBSERVER - register", 2);
        this.nsIPB2.addObserver("", PREF_OBSERVER, false);
    },

    unregister: function () {
        "use strict";
        log("Sixornot - PREF_OBSERVER - unregister", 2);
        this.nsIPB2.removeObserver("", PREF_OBSERVER);
    }
};

/*
    DNS Preferences observer
    Watches built-in Firefox preferences which have an impact on DNS resolution.
*/
PREF_OBSERVER_DNS = {
    observe: function (aSubject, aTopic, aData) {
        "use strict";
        log("Sixornot - PREF_OBSERVER_DNS - aSubject: " + aSubject + ", aTopic: " + aTopic.valueOf() + ", aData: " + aData, 2);
        if (aTopic.valueOf() !== "nsPref:changed") {
            log("Sixornot - PREF_OBSERVER_DNS - not a pref change event 1", 2);
            return;
        }

        if (aData === "disableIPv6") {
            log("Sixornot - PREF_OBSERVER_DNS - disableIPv6 has changed", 1);
            reload();
        }
        if (aData === "ipv4OnlyDomains") {
            log("Sixornot - PREF_OBSERVER_DNS - ipv4OnlyDomains has changed", 1);
            reload();
        }
    },

    nsIPB2: PREF_BRANCH_DNS.QueryInterface(Components.interfaces.nsIPrefBranch2),

    register: function () {
        "use strict";
        log("Sixornot - PREF_OBSERVER_DNS - register", 2);
        this.nsIPB2.addObserver("", PREF_OBSERVER_DNS, false);
    },

    unregister: function () {
        "use strict";
        log("Sixornot - PREF_OBSERVER_DNS - unregister", 2);
        this.nsIPB2.removeObserver("", PREF_OBSERVER_DNS);
    }
};


/*
    HTTP Request observer
    Observes all HTTP requests to determine the details of all browser connections
*/
var HTTP_REQUEST_OBSERVER = {
    observe: function (aSubject, aTopic, aData) {
        "use strict";
        var domWindow, domWindowUtils, domWindowInner,
            domWindowOuter, original_window, new_page, remoteAddress, send_event,
            create_new_entry, remoteAddressFamily,
            http_channel, http_channel_internal, nC, new_entry;
        log("Sixornot - HTTP_REQUEST_OBSERVER - (" + aTopic + ")", 1);

        /* Create an event of the specified type and dispatch it to the specified element
           Return boolean indicating if the event has been cancelled */
        send_event = function (type, target, subject) {
            // Create an event to inform listeners that a new page load has started
            // We do this now since it's only now that we know the innerID of the page
            var evt = target.top.document.createEvent("CustomEvent");
            evt.initCustomEvent(type, true, true, null);
            evt.subject = subject;
            // Dispatch the event
            return target.top.dispatchEvent(evt);
        };

        /* Prepare and return a new blank entry for the hosts listing */
        create_new_entry = function (host, address, address_family, origin, inner, outer) {
            return {
                // TODO Should this be hostPort? Since we could connect using v4/v6 on different ports?
                host: host,
                address: address,
                address_family: address_family,
                show_detail: true,
                count: 1,
                ipv6s: [],
                ipv4s: [],
                dns_status: "ready",
                dns_cancel: null,
                origin: origin,
                inner_id: inner,
                outer_id: outer,
                lookup_ips: function () {
                    var entry, on_returned_ips;
                    /* Create closure containing reference to element and trigger async lookup with callback */
                    entry = this;
                    log("Sixornot - LOOKUP_IPS", 1);
                    on_returned_ips = function (ips) {
                        log("Sixornot - LOOKUP_IPS - on_returned_ips", 1);
                        entry.dns_cancel = null;
                        if (ips[0] === "FAIL") {
                            entry.ipv6s = [];
                            entry.ipv4s = [];
                            entry.dns_status = "failure";
                        } else {
                            entry.ipv6s = ips.filter(dns_handler.is_ip6);
                            entry.ipv4s = ips.filter(dns_handler.is_ip4);
                            entry.dns_status = "complete";
                        }
                        // Also trigger page change event here to refresh display of IP tooltip
                        // Create a page change event
                        send_event("sixornot-dns-lookup-event", entry.origin, entry);
                    };
                    if (entry.dns_cancel) {
                        entry.dns_cancel.cancel();
                    }
                    entry.dns_cancel = dns_handler.resolve_remote_async(entry.host, on_returned_ips);
                }
            };
        };

        if (aTopic === "http-on-examine-response" || aTopic === "http-on-examine-cached-response") {
            http_channel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
            http_channel_internal = aSubject.QueryInterface(Components.interfaces.nsIHttpChannelInternal);

            if (aTopic === "http-on-examine-response") {
                try {
                    remoteAddress = http_channel_internal.remoteAddress;
                    remoteAddressFamily = remoteAddress.indexOf(":") === -1 ? 4 : 6;
                    // TODO move this code into a function executed immediately for address_family item
                } catch (e1) {
                    log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response: remoteAddress was not accessible for: " + http_channel.URI.spec, 1);
                    remoteAddress = "";
                    remoteAddressFamily = 0;
                }
            } else {
                remoteAddress = "";
                remoteAddressFamily = 2;
            }

            log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response: Processing " + http_channel.URI.host + " (" + (remoteAddress || "FROM_CACHE") + ")", 1);

            // Fetch DOM window associated with this request
            nC = http_channel.notificationCallbacks;
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
                domWindowUtils = domWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                            .getInterface(Components.interfaces.nsIDOMWindowUtils);
                domWindowInner = domWindowUtils.currentInnerWindowID;
                domWindowOuter = domWindowUtils.outerWindowID;

                original_window = nC.getInterface(Components.interfaces.nsIDOMWindow);
            } catch (e2) {
                // HTTP response is in response to a non-DOM source - ignore these
                log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response: non-DOM request", 2);
                return;
            }

            // Detect new page loads by checking if flag LOAD_INITIAL_DOCUMENT_URI is set
            log("http_channel.loadFlags: " + http_channel.loadFlags, 1);
            /*jslint bitwise: true */
            if (http_channel.loadFlags & Components.interfaces.nsIChannel.LOAD_INITIAL_DOCUMENT_URI) {
            /*jslint bitwise: false */
                // What does this identity assignment do in practice? How does this detect new windows?
                new_page = original_window === original_window.top;
            }

            // Create new entry for this domain in the current window's cache (if not already present)
            // If already present update the connection IP(s) list (strip duplicates)
            // Trigger DNS lookup with callback to update DNS records upon completion

            // After the initial http-on-examine-response event, but before the first content-document-global-created one
            // the new page won't have an inner ID. In this case temporarily cache the object in a waiting list (keyed by
            // outer ID) until the first content-document-global-created event (at which point add this as the first element
            // of the new window's cached list, keyed by the new inner ID).

            if (new_page) {
                /* PRIMARY PAGE LOAD */
                // New page, since inner window ID hasn't been set yet we need to store any
                // new connections until such a time as it is, these get stored in the RequestWaitingList
                // which is keyed by the outer window ID
                if (!RequestWaitingList[domWindowOuter]) {
                    RequestWaitingList[domWindowOuter] = [];
                }
                if (!RequestWaitingList[domWindowOuter].some(function (item, index, items) {
                    // If element present in list update fields if required
                    if (item.host === http_channel.URI.host) {
                        item.count += 1;
                        if (item.address !== remoteAddress && remoteAddress !== "") {
                            log("Sixornot - HTTP_REQUEST_OBSERVER - New page load, updated IP address for entry: " + remoteAddress + ", ID: " + domWindowOuter, 1);
                            item.address = remoteAddress;
                            item.address_family = remoteAddressFamily;
                        }
                        return true;
                    }
                })) {
                    // Create new entry + add to waiting list
                    log("Sixornot - HTTP_REQUEST_OBSERVER - New page load, adding new entry: " + remoteAddress + ", ID: " + domWindowOuter, 1);
                    RequestWaitingList[domWindowOuter].push(create_new_entry(http_channel.URI.host, remoteAddress, remoteAddressFamily, domWindow, null, domWindowOuter));
                }

            } else {
                /* SECONDARY PAGE LOAD */
                // Not new, inner window ID will be correct by now so add entries to RequestCache
                if (!RequestCache[domWindowInner]) {
                    RequestCache[domWindowInner] = [];
                }
                // If host already in list update IP address if needed
                if (!RequestCache[domWindowInner].some(function (item, index, items) {
                    if (item.host === http_channel.URI.host) {
                        item.count += 1;
                        send_event("sixornot-count-change-event", domWindow, item);

                        if (item.address !== remoteAddress && remoteAddress !== "") {
                            log("Sixornot - HTTP_REQUEST_OBSERVER - Secondary load, updated IP address for entry: "
                                + remoteAddress + ", ID: " + domWindowInner, 1);
                            send_event("sixornot-address-change-event", domWindow, item);
                            item.address = remoteAddress;
                            item.address_family = remoteAddressFamily;
                        }
                        return true;
                    }
                })) {
                    // Create new entry + add to cache
                    log("Sixornot - HTTP_REQUEST_OBSERVER - Secondary load, adding new entry: remoteAddress: " + remoteAddress + ", ID: " + domWindowInner, 1);
                    new_entry = create_new_entry(http_channel.URI.host, remoteAddress, remoteAddressFamily, domWindow, domWindowInner, domWindowOuter);
                    send_event("sixornot-new-host-event", domWindow, new_entry);
                    // Secondary pages shouldn't have full info shown in panel
                    new_entry.show_detail = false;
                    // Trigger new DNS lookup for the new host entry
                    new_entry.lookup_ips();
                    // Add to cache
                    RequestCache[domWindowInner].push(new_entry);
                }
            }

        } else if (aTopic === "content-document-global-created") {
            // This signals that the document has been created, initial load completed
            // This is where entries on the RequestWaitingList get moved to the RequestCache
            domWindow = aSubject;
            domWindowUtils = domWindow.top.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);
            domWindowInner = domWindowUtils.currentInnerWindowID;
            domWindowOuter = domWindowUtils.outerWindowID;

            log("Sixornot - HTTP_REQUEST_OBSERVER - content-document-global-created: Inner Window ID: "
                + domWindowInner + ", Outer Window ID: " + domWindowOuter + ", Location: " + domWindow.location, 1);

            if (!RequestWaitingList[domWindowOuter]) {
                log("RequestWaitingList[domWindowOuter] is null", 1);
                return;
            }

            if (RequestCache[domWindowInner]) {
                throw "Sixornot = HTTP_REQUEST_OBSERVER - content-document-global-created: RequestCache already contains content entries.";
            }

            // Move item(s) from waiting list to cache
            RequestCache[domWindowInner] = RequestWaitingList.splice(domWindowOuter, 1)[0];

            // For each member of the new cache set inner ID and trigger a dns lookup
            RequestCache[domWindowInner].forEach(function (item, index, items) {
                log("Setting inner_id of item: " + item.host + "(" + item.address + ") to: " + domWindowInner, 1);
                item.inner_id = domWindowInner;
                item.lookup_ips();
                log("item - host: " + item.host + ", inner_id: " + item.inner_id + ", outer_id: " + item.outer_id, 1);
                send_event("sixornot-page-change-event", domWindow, item);
            });

            // Create an event to inform listeners that a new page load has started
            // We do this now since it's only now that we know the innerID of the page
            // Uses first element of the set, since the method triggered by this event builds all the members

        } else if (aTopic === "inner-window-destroyed") {
            domWindowInner = aSubject.QueryInterface(Components.interfaces.nsISupportsPRUint64).data;
            // Remove elements for this window and ensure DNS lookups are all cancelled
            if (RequestCache[domWindowInner]) {
                log("Sixornot - HTTP_REQUEST_OBSERVER - inner-window-destroyed: " + domWindowInner
                        + " - removing all items for this inner window...", 1);
                if (RequestCache[domWindowInner].dns_cancel) {
                    log("Cancelling DNS..." + typeof item.dns_cancel, 1);
                    item.dns_cancel.cancel();
                }
                RequestCache[domWindowInner] = undefined;
                /* RequestCache.splice(domWindowInner, 1)[0].forEach(function (item, index, items) {
                    if (item.dns_cancel) {
                        log("Cancelling DNS..." + typeof item.dns_cancel, 1);
                        item.dns_cancel.cancel();
                    }
                }); */
            } else {
                log("Sixornot - HTTP_REQUEST_OBSERVER - inner-window-destroyed: " + domWindowInner, 1);
            }

        } else if (aTopic === "outer-window-destroyed") {
            domWindowOuter = aSubject.QueryInterface(Components.interfaces.nsISupportsPRUint64).data;
            // Remove elements for this window and ensure DNS lookups are all cancelled
            if (RequestWaitingList[domWindowOuter]) {
                log("Sixornot - HTTP_REQUEST_OBSERVER - outer-window-destroyed: " + domWindowOuter + " - removing all items for this outer window...", 1);
                RequestWaitingList.splice(domWindowOuter, 1)[0].forEach(function (item, index, items) {
                    if (item.dns_cancel) {
                        log("Cancelling DNS...", 1);
                        item.dns_cancel.cancel();
                    }
                });
            } else {
                log("Sixornot - HTTP_REQUEST_OBSERVER - outer-window-destroyed: " + domWindowOuter, 1);
            }
        }
    },

    observer_service: Components.classes["@mozilla.org/observer-service;1"]
                         .getService(Components.interfaces.nsIObserverService),

    register: function () {
        "use strict";
        log("Sixornot - HTTP_REQUEST_OBSERVER - register", 2);
        this.observer_service.addObserver(this, "http-on-examine-response", false);
        this.observer_service.addObserver(this, "http-on-examine-cached-response", false);
        this.observer_service.addObserver(this, "content-document-global-created", false);
        this.observer_service.addObserver(this, "inner-window-destroyed", false);
        this.observer_service.addObserver(this, "outer-window-destroyed", false);

        //this.observer_service.addObserver(this, "http-on-modify-request", false);
        //this.observer_service.addObserver(this, "dom-window-destroyed", false);
    },

    unregister: function () {
        "use strict";
        log("Sixornot - HTTP_REQUEST_OBSERVER - unregister", 2);
        this.observer_service.removeObserver(this, "http-on-examine-response");
        this.observer_service.removeObserver(this, "http-on-examine-cached-response");
        this.observer_service.removeObserver(this, "content-document-global-created");
        this.observer_service.removeObserver(this, "inner-window-destroyed");
        this.observer_service.removeObserver(this, "outer-window-destroyed");

        //this.observer_service.removeObserver(this, "http-on-modify-request");
        //this.observer_service.removeObserver(this, "dom-window-destroyed");
    }
};


/*
    Core functionality
*/

// insert_code called for each new window via watchWindows
// inserts code into browser
// Listeners which trigger events should occur at the global level above this (e.g. httpeventlistener etc.)



// TODO
/*
    Handle all the same edge cases as before
    Find nice structure for organising the functions
    Move settings into panel
    Add tooltips for panel elements
    Allow expanding of panel items to show full detail for any item
        The main page always shows full details
*/


/* Should be called once for each window of the browser */
insert_code = function (win) {
    "use strict";
    var doc, create_button, create_addressbaricon, create_panel,
        get_icon_source,
        currentTabInnerID, currentTabOuterID, setCurrentTabIDs,
        getCurrentHost;

    doc = win.document;

    setCurrentTabIDs = function () {
        var domWindow, domWindowUtils;
        log("Sixornot - insert_code:setCurrentTabIDs", 1);
        domWindow  = win.gBrowser.mCurrentBrowser.contentWindow;
        domWindowUtils = domWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                            .getInterface(Components.interfaces.nsIDOMWindowUtils);

        currentTabInnerID = domWindowUtils.currentInnerWindowID;
        currentTabOuterID = domWindowUtils.outerWindowID;
        log("Sixornot - insert_code:setCurrentTabIDs, outer: " + currentTabOuterID + ", inner: " + currentTabInnerID, 1);
    };


    /* Return the host part of the current window's location */
    getCurrentHost = function () {
        return win.content.document.location.hostname;
    };

    /* Creates and sets up a panel to display information which can then be bound to an icon */
    create_panel = function () {
        var panel, on_click, on_mouseover, on_mouseout,
        on_show_panel, on_page_change, on_new_host, on_address_change,
        popstate_handler, pageshow_handler,
        on_count_change, on_dns_complete, on_tab_select,
        panel_vbox, remote_grid, remote_rows, remote_cols, title_remote,
        remote_anchor, title_local, settingslabel, urllabel, urlhbox,
        get_hosts, force_scrollbars, new_line, grid_contents, remove_all,
        generate_all;
        panel = doc.createElement("panel");
        //panel.setAttribute("noautohide", true);

        // This contains everything else in the panel, vertical orientation
        panel_vbox = doc.createElement("vbox");
        panel_vbox.setAttribute("flex", "1");
        panel_vbox.style.overflowY = "auto";
        panel_vbox.style.overflowX = "hidden";
        panel.appendChild(panel_vbox);

        // Build containing panel UI
        remote_grid = doc.createElement("grid");
        remote_rows = doc.createElement("rows");
        remote_cols = doc.createElement("columns");
        // 5 columns wide
        // icon, count, host, address, show/hide
        remote_cols.appendChild(doc.createElement("column"));
        remote_cols.appendChild(doc.createElement("column"));
        remote_cols.appendChild(doc.createElement("column"));
        remote_cols.appendChild(doc.createElement("column"));
        remote_cols.appendChild(doc.createElement("column"));
        remote_grid.appendChild(remote_cols);
        remote_grid.appendChild(remote_rows);
        panel_vbox.appendChild(remote_grid);

        // Add "Remote" title
        title_remote = doc.createElement("label");
        title_remote.setAttribute("value", gt("header_remote"));
        title_remote.setAttribute("style", "text-align: center; font-size: smaller;");
        remote_rows.appendChild(title_remote);
        // Add remote title anchor object
        remote_anchor = {
            add_after: function (element) {
                if (title_remote.nextSibling) {
                    remote_rows.insertBefore(element, title_remote.nextSibling);
                } else {
                    remote_rows.appendChild(element);
                }
            }
        };

        // Add "Local" title (TODO - replace with element with "hide" method)
        title_local = doc.createElement("label");
        title_local.setAttribute("value", gt("header_local"));
        title_local.setAttribute("style", "text-align: center; font-size: smaller;");
        title_local.setAttribute("hidden", true);
        remote_rows.appendChild(title_local);

        // Settings link
        settingslabel = doc.createElement("description");
        settingslabel.setAttribute("value", gt("header_settings"));
        settingslabel.setAttribute("tooltiptext", gt("tt_open_settings"));
        settingslabel.setAttribute("style", "text-align: center; font-size: smaller;");
        remote_rows.appendChild(settingslabel);

        settingslabel.sixornot_decorate = true;
        settingslabel.sixornot_openprefs = true;

        // Add link to Sixornot website to UI
        urllabel = doc.createElement("description");
        urllabel.setAttribute("value", gt("sixornot_web"));
        urllabel.setAttribute("crop", "none");
        urllabel.sixornot_decorate = true;
        urllabel.sixornot_hyperlink = gt("sixornot_weblink");
        urllabel.setAttribute("tooltiptext", gt("tt_gotowebsite"));
        urlhbox = doc.createElement("urlhbox");
        urlhbox.appendChild(urllabel);
        urlhbox.setAttribute("align", "end");
        panel_vbox.appendChild(urlhbox);


        /* Functions */

        /* Get the hosts list for the current window */
        get_hosts = function () {
            var currentWindowID, requestCacheLookup;
            // New functionality, get IDs for lookup
            currentWindowID = win.gBrowser.mCurrentBrowser.contentWindow
                .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                .getInterface(Components.interfaces.nsIDOMWindowUtils)
                .currentInnerWindowID;
            requestCacheLookup = RequestCache[currentWindowID];
            log("get_hosts: currentWindowID: " + currentWindowID + ", requestCacheLookup: " + requestCacheLookup, 1);
            log("get_hosts: current RequestCache state is: ", 1);
            for (var i = 0; i < RequestCache.length; i++) {
                if (RequestCache[i] !== undefined) {
                    log("item #: " + i + ", is: " + RequestCache[i]);
                }
            }
            return requestCacheLookup;
        };

        /* Ensure panel contents visible with scrollbars */
        force_scrollbars = function () {
            if (panel_vbox.clientHeight > panel.clientHeight) {
                panel_vbox.setAttribute("maxheight", panel.clientHeight - 50);
                // TODO if panel width changes after this is applied horizontal fit breaks
                //panel.setAttribute("minwidth", panel_vbox.clientWidth + 40);
            }
        };


        // Add a line, including local event handlers for show/hide
        //  Added in correct place in ordering (alphabetical, main site at top)

        // Remove all lines, including cleanup of callbacks etc.

        // (All filtered by innerwindowid)
        // Update line icon (index by host) - reference to main model, pass object
        // Update line connection count (index by host)
        // Update line connection address (index by host)
        // Update line additional addresses (index by host)

        // Summary or detail needs to be a property of the object representation so that it can persist between menu shows, or refreshing of the extended info fields
        // The ip address arrays can be rebuilt, meaning the elements would have to be removed and re-added


        /* Object representing one host entry in the panel
           Takes a reference to a member of the request cache as argument
           and links to that member to reflect its state
           Also takes a reference to the element to add this element after
           e.g. header or the preceeding list item */
        new_line = function (host, addafter) {
            var copy_full, create_header_row, header_row;
            log("Sixornot - new_line", 1);
            // Due to closure this is available to all functions defined inside this one
            copy_full = "";

            /* Create and return a new line item */
            create_header_row = function (addafter) {
                var create_showhide, create_icon, create_count, create_hostname,
                    create_ips, row;
                log("Sixornot - create_header_row", 1);
                create_showhide = function (addto) {
                    var showhide, update;
                    log("Sixornot - create_showhide", 1);

                    /* Create DOM UI elements */
                    showhide = doc.createElement("label");
                    showhide.setAttribute("value", "");
                    showhide.setAttribute("style", "");

                    showhide.sixornot_host = host.host;
                    showhide.sixornot_showhide = true;
                    showhide.sixornot_decorate = true;

                    update = function () {
                        var count = 0;
                        host.ipv6s.forEach(function (address, index, addresses) {
                            if (address !== host.address) {
                                count += 1;
                            }
                        });
                        host.ipv4s.forEach(function (address, index, addresses) {
                            if (address !== host.address) {
                                count += 1;
                            }
                        });
                        if (count > 0) {
                            if (host.show_detail) {
                                showhide.setAttribute("value", "[" + gt("hide_text") + "]");
                                showhide.setAttribute("hidden", false);
                                showhide.setAttribute("tooltiptext", gt("tt_hide_detail"));
                            } else {
                                showhide.setAttribute("value", "[+" + count + "]");
                                showhide.setAttribute("hidden", false);
                                showhide.setAttribute("tooltiptext", gt("tt_show_detail"));
                            }
                        } else {
                            showhide.setAttribute("value", "");
                            showhide.setAttribute("hidden", true);
                        }
                    };
                    /* Update elements on create */
                    update();
                    addto.appendChild(showhide);
                    /* Return object for interacting with DOM elements */
                    return {
                        update: update,
                        remove: function () {
                            addto.removeChild(showhide);
                        }
                    };
                };
                create_icon = function (addto) {
                    var icon, update;
                    log("Sixornot - create_icon", 1);
                    /* Create DOM UI elements */
                    icon = doc.createElement("image");
                    icon.setAttribute("width", "16");
                    icon.setAttribute("height", "16");
                    icon.sixornot_decorate = false;
                    update = function () {
                        icon.setAttribute("src", get_icon_source(host));
                    };
                    /* Update element on create */
                    update();
                    addto.appendChild(icon);
                    /* Return object for interacting with DOM element */
                    return {
                        update: update,
                        remove: function () {
                            addto.removeChild(icon);
                        }
                    };
                };
                create_count = function (addto) {
                    var count, update;
                    log("Sixornot - create_count", 1);
                    /* Create DOM UI elements */
                    count = doc.createElement("label");

                    count.setAttribute("tooltiptext", gt("tt_copycount"));
                    update = function () {
                        if (host.count > 0) {
                            count.setAttribute("value", "(" + host.count + ")");
                            //count.sixornot_decorate = true;
                        } else {
                            count.setAttribute("value", "");
                            //count.sixornot_decorate = false;
                        }
                        // TODO Add real copy text here
                        //count.sixornot_copytext = "count copy text";
                    };
                    /* Update element on create */
                    update();
                    addto.appendChild(count);
                    /* Return object for interacting with DOM element */
                    return {
                        update: update,
                        remove: function () {
                            addto.removeChild(count);
                        }
                    };
                };
                create_hostname = function (addto) {
                    var hostname, update;
                    log("Sixornot - create_hostname", 1);
                    /* Create DOM UI elements */
                    hostname = doc.createElement("label");
                    hostname.setAttribute("value", host.host);
                    if (host.host === getCurrentHost()) {
                        // Bold
                        hostname.setAttribute("style", "font-weight: bold;");
                    } else {
                        hostname.setAttribute("style", "font-weight: normal;");
                    }

                    hostname.setAttribute("tooltiptext", gt("tt_copydomclip"));
                    update = function () {
                        // TODO Add real copy text here
                        var text = host.host + "," + host.address;
                        /* Sort the lists of addresses */
                        host.ipv6s.sort(function (a, b) {
                            return dns_handler.sort_ip6.call(dns_handler, a, b);
                        });
                        host.ipv4s.sort(function (a, b) {
                            return dns_handler.sort_ip4.call(dns_handler, a, b);
                        });
                        host.ipv6s.forEach(function (address, index, addresses) {
                            if (address !== host.address) {
                                text = text + "," + address;
                            }
                        });
                        host.ipv4s.forEach(function (address, index, addresses) {
                            if (address !== host.address) {
                                text = text + "," + address;
                            }
                        });
                        hostname.sixornot_copytext = text;
                        hostname.sixornot_decorate = true;
                    };
                    /* Update element on create */
                    update();
                    addto.appendChild(hostname);
                    /* Return object for interacting with DOM element */
                    return {
                        update: update,
                        remove: function () {
                            addto.removeChild(hostname);
                        }
                    };
                };

                /* Creates an element containing a listing of IP addresses
                   The first one will be the connection IP
                   The rest are IP addresses looked up from DNS */
                create_ips = function (addto) {
                    var update, address_box;
                    log("Sixornot - create_conip", 1);
                    /* Create DOM UI elements */
                    address_box = doc.createElement("vbox");

                    update = function () {
                        var conipaddr;
                        // Remove all existing addresses
                        while (address_box.firstChild) {
                            address_box.removeChild(address_box.firstChild);
                        }
                        // Add the first entry (connection IP)
                        conipaddr = doc.createElement("label");
                        conipaddr.sixornot_host = host.host;
                        if (host.address_family === 6) {
                            conipaddr.setAttribute("value", host.address);
                            conipaddr.sixornot_copytext = host.address;
                            //conipaddr.setAttribute("style", "color: #0F0;");
                            conipaddr.setAttribute("tooltiptext", gt("tt_copyaddr"));
                            conipaddr.sixornot_decorate = true;
                        } else if (host.address_family === 4) {
                            conipaddr.setAttribute("value", host.address);
                            conipaddr.sixornot_copytext = host.address;
                            //conipaddr.setAttribute("style", "color: #F00;");
                            conipaddr.setAttribute("tooltiptext", gt("tt_copyaddr"));
                            conipaddr.sixornot_decorate = true;
                        } else if (host.address_family === 2) {
                            conipaddr.setAttribute("value", gt("addr_cached"));
                            conipaddr.sixornot_copytext = "";
                            //conipaddr.setAttribute("style", "color: #00F;");
                            conipaddr.sixornot_decorate = false;
                        } else {
                            conipaddr.setAttribute("value", gt("addr_unavailable"));
                            conipaddr.sixornot_copytext = "";
                            //conipaddr.setAttribute("style", "color: #000;");
                            conipaddr.sixornot_decorate = false;
                        }
                        address_box.appendChild(conipaddr);

                        if (host.show_detail) {
                            // Add the other addresses (if any)
                            host.ipv6s.sort(function (a, b) {
                                return dns_handler.sort_ip6.call(dns_handler, a, b);
                            });
                            host.ipv4s.sort(function (a, b) {
                                return dns_handler.sort_ip4.call(dns_handler, a, b);
                            });
                            host.ipv6s.forEach(function (address, index, addresses) {
                                if (address !== host.address) {
                                    var detailaddr = doc.createElement("label");
                                    detailaddr.setAttribute("value", address);
                                    detailaddr.sixornot_copytext = address;
                                    //detailaddr.setAttribute("style", "color: #0F0;");
                                    detailaddr.setAttribute("tooltiptext", gt("tt_copyaddr"));
                                    detailaddr.sixornot_decorate = true;
                                    detailaddr.sixornot_host = host.host;
                                    address_box.appendChild(detailaddr);
                                }
                            });
                            host.ipv4s.forEach(function (address, index, addresses) {
                                if (address !== host.address) {
                                    var detailaddr = doc.createElement("label");
                                    detailaddr.setAttribute("value", address);
                                    detailaddr.sixornot_copytext = address;
                                    //detailaddr.setAttribute("style", "color: #F00;");
                                    detailaddr.setAttribute("tooltiptext", gt("tt_copyaddr"));
                                    detailaddr.sixornot_decorate = true;
                                    detailaddr.sixornot_host = host.host;
                                    address_box.appendChild(detailaddr);
                                }
                            });
                        }

                    };
                    /* Update element on create */
                    update();
                    address_box.sixornot_host = host.host;
                    addto.appendChild(address_box);
                    /* Return object for interacting with DOM element */
                    return {
                        update: update,
                        remove: function () {
                            addto.removeChild(address_box);
                        }
                    };
                };

                // Create row
                row = doc.createElement("row");
                row.setAttribute("align", "start");
                /* Add this element after the last one */
                addafter.add_after(row);

                /* Object representing header row of entry */
                return {
                    icon: create_icon(row),
                    count: create_count(row),
                    hostname: create_hostname(row),
                    ips: create_ips(row),
                    showhide: create_showhide(row),
                    /* Remove this element and all children */
                    remove: function () {
                        // Remove children
                        this.icon.remove();
                        this.count.remove();
                        this.hostname.remove();
                        this.ips.remove();
                        this.showhide.remove();
                        // Remove self
                        row.parentNode.removeChild(row);
                    },
                    add_after: function (element) {
                        /* Add the element specified immediately after this one in the DOM */
                        if (row.nextSibling) {
                            row.parentNode.insertBefore(element, row.nextSibling);
                        } else {
                            row.parentNode.appendChild(element);
                        }
                    }
                };
            };

            // Bind onclick events here TODO
            header_row = create_header_row(addafter);

            return {
                header_row: header_row,
                host: host,
                copy_full: copy_full,
                remove: function () {
                    header_row.remove();
                },
                show_detail: function () {
                    this.header_row.showhide.update();
                },
                hide_detail: function () {
                    this.header_row.showhide.update();
                },
                update_address: function () {
                    // TODO optimisation - only update connection IP
                    this.header_row.ips.update();
                    this.header_row.icon.update();
                },
                update_ips: function () {
                    // TODO optimisation - only update DNS IPs
                    this.header_row.ips.update();
                    this.header_row.showhide.update();
                    this.header_row.icon.update();
                },
                update_count: function () {
                    this.header_row.count.update();
                },

                /* Return the last element, useful for inserting another element after this one */
                get_last_element: function () {
                    return this.header_row;
                },
                /* Adds the contents of this object after the specified element */
                add_after: function (element) {
                    if (header_row.nextSibling) {
                        header_row.parentNode.insertBefore(element, header_row.nextSibling);
                    } else {
                        header_row.parentNode.appendChild(element);
                    }
                }
            };
        };

        grid_contents = [];

        remove_all = function () {
            log("Sixornot - panel:remove_all", 2);
            grid_contents.forEach(function (item, index, items) {
                try {
                    item.remove();
                } catch (e) {
                    log("exception!" + parse_exception(e), 0);
                }
            });
            grid_contents = [];

        };
        generate_all = function () {
            log("Sixornot - panel:generate_all", 2);
            var hosts = get_hosts();

            hosts.forEach(function (host, index, items) {
                // For each host in hosts add a line object to the grid_contents array
                // These will be added to the DOM after the previous one, or after the
                // anchor element if none have been created yet
                try {
                    if (grid_contents.length > 0) {
                        grid_contents.push(new_line(host, grid_contents[grid_contents.length - 1].get_last_element()));
                    } else {
                        grid_contents.push(new_line(host, remote_anchor));
                    }
                } catch (e) {
                    log("exception!" + parse_exception(e), 0);
                }
            });
        };

        /* Handles mouseover events on any panel element */
        on_mouseover = function (evt) {
            if (evt.target.sixornot_decorate) {
                evt.target.style.textDecoration = "underline";
                evt.target.style.cursor="pointer";
            }
        };
        /* Handles mouseout events on any panel element */
        on_mouseout = function (evt) {
            if (evt.target.sixornot_decorate) {
                evt.target.style.textDecoration = "none";
                evt.target.style.cursor="default";
            }
        };

        /* Handles click events on any panel element
           Actions are defined by custom properties applied to the event target element
           One or more of these can be triggered */
        on_click = function (evt) {
            var currentWindow, currentBrowser;
            log("Sixornot - panel:on_click", 1);
            /* If element has sixornot_copytext, then copy it to clipboard */
            if (evt.target.sixornot_copytext) {
                try {
                    evt.stopPropagation();
                    log("Sixornot - panel:on_click - sixornot_copytext '" + evt.target.sixornot_copytext + "' to clipboard", 1);
                    Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                        .getService(Components.interfaces.nsIClipboardHelper)
                        .copyString(evt.target.sixornot_copytext);
                } catch (e_copytext) {
                    log("exception!" + parse_exception(e_copytext), 0);
                }
            }
            /* If element has show/hide behaviour, toggle and trigger refresh */
            if (evt.target.sixornot_showhide) {
                try {
                    evt.stopPropagation();
                    log("Sixornot - panel:on_click - showhide", 1);
                    // Locate matching element and trigger refresh
                    if (!grid_contents.some(function (item, index, items) {
                        if (item.host.host === evt.target.sixornot_host) {
                            log("Sixornot - panel:on_click - ", 1);
                            item.host.show_detail = !item.host.show_detail;
                            item.update_ips();
                            return true;
                        }
                    })) {
                            log("Sixornot - panel:on_click - no matching host found", 1);
                    }
                } catch (e_showhide) {
                    log("exception!" + parse_exception(e_showhide), 0);
                }
            }
            /* Element should open preferences when clicked */
            if (evt.target.sixornot_openprefs) {
                try {
                    evt.stopPropagation();
                    panel.hidePopup();
                    log("Sixornot - panel:on_click - openprefs", 1);
                    // Add tab to most recent window, regardless of where this function was called from
                    currentWindow = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                         .getService(Components.interfaces.nsIWindowMediator)
                         .getMostRecentWindow("navigator:browser");
                    currentWindow.focus();
                    currentBrowser = currentWindow.getBrowser();
                    currentBrowser.selectedTab = currentBrowser.addTab("about:addons");
                    // TODO link should open Sixornot, but this isn't currently possible
                    //currentWindow.getBrowser().contentWindow.wrappedJSObject.loadView("addons://detail/sixornot@entropy.me.uk");
                } catch (e_openprefs) {
                    log("exception!" + parse_exception(e_openprefs), 0);
                }
            }
            /* Element should open hyperlink when clicked */
            if (evt.target.sixornot_hyperlink) {
                try {
                    log("Sixornot - panel:on_click - open hyperlink", 1);
                    evt.stopPropagation();
                    panel.hidePopup();
                    // Add tab to most recent window, regardless of where this function was called from
                    currentWindow = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                         .getService(Components.interfaces.nsIWindowMediator)
                         .getMostRecentWindow("navigator:browser");
                    currentWindow.focus();
                    currentBrowser = currentWindow.getBrowser();
                    currentBrowser.selectedTab = currentBrowser.addTab(evt.target.sixornot_hyperlink);
                } catch (e_hyperlink) {
                    log("exception!" + parse_exception(e_hyperlink), 0);
                }
            }
        };

        // On show panel
        // If so remove all entries in grid_contents list
        // Then create a new entry in grid_contents (new_grid_line()) for each element
        // in the cache matching this page
        // 
        on_show_panel = function (evt) {
            log("Sixornot - panel:on_show_panel", 1);
            try {
                remove_all();
                generate_all();
            } catch (e) {
                log("exception!" + parse_exception(e), 0);
            }
            log("Sixornot - panel:on_show_panel - done", 1);
        };

        // On page change
        // Check if tab innerID matches event innerID
        // If so repopulate grid_contents list as per show panel
        on_page_change = function (evt) {
            log("Sixornot - panel:on_page_change", 1);
            if (panel.state !== "open") {
                log("Sixornot - on_page_change - skipping (panel is closed)", 1);
                return;
            }
            if (evt.subject.outer_id !== currentTabOuterID) {
                log("Sixornot - on_page_change - skipping (outer ID mismatch), evt.subject.outer_id: " + evt.subject.outer_id + ", currentTabOuterID: " + currentTabOuterID, 1);
                return;
            }
            setCurrentTabIDs();
            if (evt.subject.inner_id !== currentTabInnerID) {
                log("Sixornot - on_page_change - skipping (inner ID mismatch), evt.subject.inner_id: " + evt.subject.inner_id + ", currentTabInnerID: " + currentTabInnerID, 1);
                return;
            }
            remove_all();
            generate_all();
            force_scrollbars();
        };

        // On new host
        // Check if innerID matches
        // Check if mainhost matches
        // If so add a new host into grid_contents (in correct sort position)
        on_new_host = function (evt) {
            log("Sixornot - panel:on_new_host", 1);
            if (panel.state !== "open") {
                log("Sixornot - on_new_host - skipping (panel is closed) - panel.state: " + panel.state, 1);
                return;
            }
            if (evt.subject.inner_id !== currentTabInnerID) {
                log("Sixornot - on_new_host - skipping (inner ID mismatch) - evt.subject.inner_id: " + evt.subject.inner_id + ", currentTabInnerID: " + currentTabInnerID, 1);
                return;
            }

            try {
                // TODO put this in the right position based on some ordering
                // TODO since event subject is the host object in question so long as the IDs match we should be ok
                //  to just use that rather than doing this lookup!
                log("Sixornot - on_new_host - evt.subject.host: " + evt.subject.host, 1);
                // For first match for evt.subject.host add a new line
                // Only do so if a matching host does not exist in the listing already TODO
                if (grid_contents.length > 0) {
                    grid_contents.push(new_line(evt.subject, grid_contents[grid_contents.length - 1].get_last_element()));
                } else {
                    grid_contents.push(new_line(evt.subject, remote_anchor));
                }
            } catch (e) {
                log("exception!" + parse_exception(e), 0);
            }
            force_scrollbars();
        };

        // On address change
        // Check if innerID matches
        // Check if mainhost matches
        // If so look up matching host entry in grid_contents + update its connection IP
        // And update its icon
        on_address_change = function (evt) {
            log("Sixornot - panel:on_address_change", 1);
            if (panel.state !== "open") {
                log("Sixornot - on_address_change - skipping (panel is closed) - panel.state: " + panel.state, 1);
                return;
            }
            if (evt.subject.inner_id !== currentTabInnerID) {
                log("Sixornot - on_address_change - skipping (inner ID mismatch) - evt.subject.inner_id: " + evt.subject.inner_id + ", currentTabInnerID: " + currentTabInnerID, 1);
                return;
            }
            try {
                if (!grid_contents.some(function (item, index, items) {
                    if (item.host.host === evt.subject.host) {
                        item.update_address();
                        return true;
                    }
                })) {
                        log("Sixornot - on_address_change - matching host not found!", 1);
                }
            } catch (e) {
                log("exception!" + parse_exception(e), 0);
            }
        };

        // On count change
        // Check innerID + mainhost match
        // Look up matching host entry in grid_contents and update its count
        on_count_change = function (evt) {
            log("Sixornot - panel:on_count_change", 1);
            if (panel.state !== "open") {
                log("Sixornot - on_count_change - skipping (panel is closed) - panel.state: " + panel.state, 1);
                return;
            }
            if (evt.subject.inner_id !== currentTabInnerID) {
                log("Sixornot - on_count_change - skipping (inner ID mismatch) - evt.subject.inner_id: " + evt.subject.inner_id + ", currentTabInnerID: " + currentTabInnerID, 1);
                return;
            }
            try {
                if (!grid_contents.some(function (item, index, items) {
                    if (item.host.host === evt.subject.host) {
                        item.update_count();
                        return true;
                    }
                })) {
                        log("Sixornot - on_count_change - matching host not found!", 1);
                }
            } catch (e) {
                log("exception!" + parse_exception(e), 0);
            }
        };

        // On DNS lookup completion event
        // Check innerID + mainhost match
        // Look up matching host entry + call update_ips() which rebuilds the set of addresses
        // Update icon
        on_dns_complete = function (evt) {
            log("Sixornot - panel:on_dns_complete", 1);
            // TODO - unsubscribe from events when panel is closed to avoid this check
            if (panel.state !== "open") {
                log("Sixornot - on_dns_complete - skipping (panel is closed) - panel.state: " + panel.state, 1);
                return;
            }
            if (evt.subject.inner_id !== currentTabInnerID) {
                log("Sixornot - on_dns_complete - skipping (inner ID mismatch) - evt.subject.inner_id: " + evt.subject.inner_id + ", currentTabInnerID: " + currentTabInnerID, 1);
                return;
            }
            try {
                if (!grid_contents.some(function (item, index, items) {
                    if (item.host.host === evt.subject.host) {
                        log("Sixornot - on_dns_complete - updating ips and icon", 1);
                            item.update_ips();
                        return true;
                    }
                })) {
                        log("Sixornot - on_dns_complete - matching host not found!", 1);
                }
            } catch (e) {
                log("exception!" + parse_exception(e), 0);
            }
            // TODO optimisation - this only needs to be called if the height is changed (e.g. if showing this host)
            force_scrollbars();
        };

        // On Tab selection by user
        on_tab_select = function (evt) {
            log("Sixornot - panel:on_tab_select", 1);
            // TODO - unsubscribe from events when panel is closed to avoid this check
            if (panel.state !== "open") {
                log("Sixornot - on_tab_select - skipping (panel is closed) - panel.state: " + panel.state, 1);
                return;
            }
            // This should be done by the icon handler, but just make sure
            setCurrentTabIDs();

            remove_all();
            generate_all();
            force_scrollbars();
        };

        /* popstate event triggered */
        popstate_handler = function (evt) {
            log("Sixornot - insert_code:create_button:popstate_handler", 1);
            // TODO - handle this
        };

        /* pageshow event triggered */
        pageshow_handler = function (evt) {
            log("Sixornot - insert_code:create_button:pageshow_handler", 1);
            // TODO - handle this
        };


        // Panel setup
        panel.setAttribute("type", "arrow");
        panel.setAttribute("hidden", true);
        panel.setAttribute("position", "bottomcenter topright");

        // This must be set so that panel's children don't inherit this style!
        panel.style.listStyleImage = "none";

        // Add event listeners for children
        panel.addEventListener("mouseover", on_mouseover, false);
        panel.addEventListener("mouseout", on_mouseout, false);
        panel.addEventListener("click", on_click, false);
        // Event listener to update panel contents when it is shown
        panel.addEventListener("popupshowing", on_show_panel, false);
        win.addEventListener("sixornot-page-change-event", on_page_change, false);
        win.addEventListener("sixornot-new-host-event", on_new_host, false);
        win.addEventListener("sixornot-address-change-event", on_address_change, false);
        win.addEventListener("sixornot-count-change-event", on_count_change, false);
        win.addEventListener("sixornot-dns-lookup-event", on_dns_complete, false);
        win.gBrowser.tabContainer.addEventListener("TabSelect", on_tab_select, false);
        // TODO - add/remove this event listener when the tab changes
        // bind only to the window which is active, so we don't get events for
        // windows which aren't showing
        win.gBrowser.addEventListener("pageshow", pageshow_handler, false);
        //win.gBrowser.addEventListener("DOMContentLoaded", on_page_change, false);

        // Add a callback to our unload list to remove the UI when addon is disabled
        unload(function () {
            log("Sixornot - Unload panel callback", 2);
            // Remove event listeners for children
            panel.removeEventListener("mouseover", on_mouseover, false);
            panel.removeEventListener("mouseout", on_mouseout, false);
            panel.removeEventListener("click", on_click, false);
            // Remove event listeners
            panel.removeEventListener("popupshowing", on_show_panel, false);
            win.removeEventListener("sixornot-page-change-event", on_page_change, false);
            win.removeEventListener("sixornot-new-host-event", on_new_host, false);
            win.removeEventListener("sixornot-address-change-event", on_address_change, false);
            win.removeEventListener("sixornot-count-change-event", on_count_change, false);
            win.removeEventListener("sixornot-dns-lookup-event", on_dns_complete, false);
            win.gBrowser.tabContainer.removeEventListener("TabSelect", on_tab_select, false);
            win.gBrowser.removeEventListener("pageshow", pageshow_handler, false);
            //win.gBrowser.removeEventListener("DOMContentLoaded", on_page_change, false);
            // Remove UI
            panel.parentNode.removeChild(panel);
        }, win);

        return panel;
    };

    /* Creates icon button and binds events */
    create_button = function () {
        var toolbarButton, toolbarID, toolbar, nextItem, nextID,
            click_handler, panel, update_icon,
            customize_handler, page_change_handler, tabselect_handler,
            popstate_handler, pageshow_handler;
        log("Sixornot - insert_code:create_button", 2);

        /* Updates the icon to reflect state of the currently displayed page */
        update_icon = function () {
            log("Sixornot - insert_code:create_button:update_icon", 1);
            var hosts = RequestCache[currentTabInnerID];

            if (hosts) {
                /* Parse array searching for the main host (which matches the current location) */
                hosts.forEach(function (element, index, thearray) {
                    if (element.host === getCurrentHost()) {
                        log("Sixornot - main:create_button - callback: update_state - updating icon!", 1);
                        toolbarButton.style.listStyleImage = "url('" + get_icon_source(element) + "')";
                    }
                });
            } else {
                // Analyse current location, see if it's not a valid page
                // TODO - fallback to DNS lookup of current name
                //      - store this in the cache
                log("Sixornot - main:create_button - callback: update_state - typeof(hosts) is undefined!", 1);
                toolbarButton.style.listStyleImage = "url('" + imagesrc.get("other") + "')";
                return;
            }

        };

        /* click events on the button (show panel) */
        click_handler = function () {
            panel.setAttribute("hidden", false);
            panel.openPopup(toolbarButton, panel.getAttribute("position"), 0, 0, false, false);
        };

        /* Called whenever the current window's active tab is changed
           Calls the update method for the icon */
        tabselect_handler = function (evt) {
            log("Sixornot - insert_code:create_button:tabselect_handler", 1);
            setCurrentTabIDs();
            update_icon();
        };

        /* popstate event triggered, active history entry has changed */
        popstate_handler = function (evt) {
            log("Sixornot - insert_code:create_button:popstate_handler", 1);
            setCurrentTabIDs();
            update_icon();
        };

        /* pageshow event triggered, current page has been shown */
        pageshow_handler = function (evt) {
            log("Sixornot - insert_code:create_button:pageshow_handler", 1);
            setCurrentTabIDs();
            update_icon();
        };

        /* Called whenever a Sixornot page change event is emitted
           Calls the update method for the icon, but only if the event applies to us */
        page_change_handler = function (evt) {
            log("Sixornot - insert_code:create_button:page_change_handler - evt.subject.outer_id: " + evt.subject.outer_id + ", evt.subject.inner_id: " + evt.subject.inner_id + ", currentTabOuterID: " + currentTabOuterID + ", currentTabInnerID: " + currentTabInnerID, 1);
            setCurrentTabIDs();
            // Ignore updates for windows other than this one
            if (evt.subject.outer_id !== currentTabOuterID) {
                log("Sixornot - insert_code:create_button - callback: update_state - Callback ID mismatch: evt.subject.outer_id is: " + evt.subject.outer_id + ", currentTabOuterID is: " + currentTabOuterID, 1);
            } else {
                update_icon();
            }
        };

        /* When button location is customised store the new location in preferences
           so we can load into the same place next time */
        customize_handler = function (evt) {
            var button_parent, button_nextitem, toolbar_id, nextitem_id;
            log("Sixornot - insert_code:create_button:customize_handler");
            if (toolbarButton) {
                button_parent = toolbarButton.parentNode;
                button_nextitem = toolbarButton.nextSibling;
                if (button_parent && button_parent.localName === "toolbar") {
                    toolbar_id = button_parent.id;
                    nextitem_id = button_nextitem && button_nextitem.id;
                }
            }
            PREF_BRANCH_SIXORNOT.setCharPref("toolbar",  toolbar_id || "");
            PREF_BRANCH_SIXORNOT.setCharPref("nextitem", nextitem_id || "");
        };

        /* Create the button */
        toolbarButton = doc.createElement("toolbarbutton");

        /* Iconized button setup */
        toolbarButton.setAttribute("id", BUTTON_ID);
        toolbarButton.setAttribute("label", gt("label"));
        toolbarButton.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional");
        toolbarButton.setAttribute("tooltiptext", "Show Sixornot panel");
        toolbarButton.setAttribute("type", "menu");
        toolbarButton.setAttribute("orient", "horizontal");
        toolbarButton.style.listStyleImage = "url('" + imagesrc.get("other") + "')";

        /* Create a panel to show details when clicked */
        panel = create_panel();
        toolbarButton.appendChild(panel);

        /* Add button to toolbox palette, since it needs a parent */
        gbi(doc, "navigator-toolbox").palette.appendChild(toolbarButton);

        /* Move to location specified in prefs
           If location is blank, then it isn't moved (stays in toolbox palette) */
        toolbarID = get_char_pref("toolbar");
        if (toolbarID !== "") {
            toolbar = gbi(doc, toolbarID);

            nextID = get_char_pref("nextitem");
            if (nextID === "") {
                // Add to end of the specified bar
                toolbar.insertItem(BUTTON_ID);
            } else {
                // Add to specified position, if nextID is found
                nextItem = gbi(doc, nextID);
                if (nextItem && nextItem.parentNode.id === toolbarID) {
                    toolbar.insertItem(BUTTON_ID, nextItem);
                } else {
                    toolbar.insertItem(BUTTON_ID);
                }
            }
        }

        /* Add event listeners */
        // win.addEventListener("online", onChangedOnlineStatus, false); TODO
        // win.addEventListener("offline", onChangedOnlineStatus, false); TODO
        toolbarButton.addEventListener("click", click_handler, false);
        win.addEventListener("aftercustomization", customize_handler, false);

        /* Ensure tab ID is set upon loading into window */
        setCurrentTabIDs();

        /* Register for page change events */
        win.addEventListener("sixornot-page-change-event", page_change_handler, false);
        win.addEventListener("sixornot-dns-lookup-event", page_change_handler, false);
        win.gBrowser.tabContainer.addEventListener("TabSelect", tabselect_handler, false);
        win.gBrowser.addEventListener("pageshow", pageshow_handler, false);
        //win.gBrowser.addEventListener("DOMContentLoaded", page_change_handler, false);

        /* Add a callback to unload to remove the button */
        unload(function () {
            log("Sixornot - Unload main UI for a window...", 2);

            /* Clear event handlers */
            // win.removeEventListener("offline", onChangedOnlineStatus, false); TODO
            // win.removeEventListener("online", onChangedOnlineStatus, false); TODO
            toolbarButton.removeEventListener("click", click_handler, false);
            win.removeEventListener("aftercustomization", customize_handler, false);
            win.removeEventListener("sixornot-page-change-event", page_change_handler, false);
            win.removeEventListener("sixornot-dns-lookup-event", page_change_handler, false);
            win.gBrowser.tabContainer.removeEventListener("TabSelect", tabselect_handler, false);
            win.gBrowser.removeEventListener("pageshow", pageshow_handler, false);
            //win.gBrowser.removeEventListener("DOMContentLoaded", page_change_handler, false);

            /* Remove UI */
            toolbarButton.parentNode.removeChild(toolbarButton);
        }, win);
    };

    create_addressbaricon = function () {
        var addressBarIcon, urlbaricons, starbutton, panel, update_icon,
            click_handler, page_change_handler, tabselect_handler,
            popstate_handler, pageshow_handler;
        log("Sixornot - insert_code:create_addressbaricon", 2);

        /* Updates the icon to reflect state of the currently displayed page */
        update_icon = function () {
            log("Sixornot - insert_code:create_addressbaricon:update_icon", 1);
            var hosts = RequestCache[currentTabInnerID];

            if (hosts) {
                /* Parse array searching for the main host (which matches the current location) */
                hosts.forEach(function (element, index, thearray) {
                    if (element.host === getCurrentHost()) {
                        log("Sixornot - main:create_addressbaricon - callback: update_state - updating icon!", 1);
                        addressBarIcon.style.listStyleImage = "url('" + get_icon_source(element) + "')";
                    }
                });
            } else {
                // Analyse current location, see if it's not a valid page
                // TODO - fallback to DNS lookup of current name
                //      - store this in the cache
                log("Sixornot - main:create_addressbaricon - callback: update_state - typeof(hosts) is undefined!", 1);
                addressBarIcon.style.listStyleImage = "url('" + imagesrc.get("other") + "')";
            }

        };

        /* click events on the button (show panel) */
        click_handler = function () {
            panel.setAttribute("hidden", false);
            panel.openPopup(addressBarIcon, panel.getAttribute("position"), 0, 0, false, false);
        };

        /* When the active tab is changed this event handler updates the icon */
        tabselect_handler = function (evt) {
            log("Sixornot - insert_code:create_addressbaricon:tabselect_handler", 2);
            setCurrentTabIDs();
            update_icon();
        };

        /* popstate event triggered */
        popstate_handler = function (evt) {
            log("Sixornot - insert_code:create_button:popstate_handler", 1);
            setCurrentTabIDs();
            update_icon();
        };

        /* pageshow event triggered */
        pageshow_handler = function (evt) {
            log("Sixornot - insert_code:create_button:pageshow_handler", 1);
            setCurrentTabIDs();
            update_icon();
        };

        /* Called whenever a Sixornot page change event is emitted
           Calls the update method for the icon, but only if the event applies to us */
        page_change_handler = function (evt) {
            log("Sixornot - insert_code:create_addressbaricon:page_change_handler - evt.subject.outer_id: " + evt.subject.outer_id + ", evt.subject.inner_id: " + evt.subject.inner_id + ", currentTabOuterID: " + currentTabOuterID + ", currentTabInnerID: " + currentTabInnerID, 1);
            setCurrentTabIDs();
            // Ignore updates for windows other than this one
            if (evt.subject.outer_id !== currentTabOuterID) {
                log("Sixornot - insert_code:create_addressbaricon - callback: update_state - Callback ID mismatch: evt.subject.outer_id is: " + evt.subject.outer_id + ", currentTabOuterID is: " + currentTabOuterID, 1);
            } else {
                update_icon();
            }
        };

        /* Create address bar icon */
        addressBarIcon = doc.createElement("box");

        /* Address bar icon setup */
        addressBarIcon.setAttribute("width", "16");
        addressBarIcon.setAttribute("height", "16");
        addressBarIcon.setAttribute("align", "center");
        addressBarIcon.setAttribute("pack", "center");
        addressBarIcon.style.listStyleImage = "url('" + imagesrc.get("other") + "')";
        addressBarIcon.setAttribute("tooltiptext", "Show Sixornot panel");
        /* Box must contain at least one child or it doesn't display */
        addressBarIcon.appendChild(doc.createElement("image"));

        /* Create a panel to show details when clicked */
        panel = create_panel();
        addressBarIcon.appendChild(panel);

        /* Position the icon */
        urlbaricons = gbi(doc, "urlbar-icons");
        starbutton = gbi(doc, "star-button");

        /* If star icon visible, insert before it, otherwise just append to urlbaricons */
        if (!starbutton) {
            urlbaricons.appendChild(addressBarIcon);
        } else {
            urlbaricons.insertBefore(addressBarIcon, starbutton);
        }

        /* Ensure tab ID is set upon loading into window */
        setCurrentTabIDs();

        /* Add event listeners */
        addressBarIcon.addEventListener("click", click_handler, false);
        win.addEventListener("sixornot-page-change-event", page_change_handler, false);
        win.addEventListener("sixornot-dns-lookup-event", page_change_handler, false);
        win.gBrowser.tabContainer.addEventListener("TabSelect", tabselect_handler, false);
        win.gBrowser.addEventListener("pageshow", pageshow_handler, false);
        //win.gBrowser.addEventListener("DOMContentLoaded", page_change_handler, false);

        /* Add a callback to unload to remove the icon */
        unload(function () {
            log("Sixornot - address bar unload function", 2);

            /* Clear event handlers */
            addressBarIcon.removeEventListener("click", click_handler, false);
            win.removeEventListener("sixornot-page-change-event", page_change_handler, false);
            win.removeEventListener("sixornot-dns-lookup-event", page_change_handler, false);
            win.gBrowser.tabContainer.removeEventListener("TabSelect", tabselect_handler, false);
            win.gBrowser.removeEventListener("pageshow", pageshow_handler, false);
            //win.gBrowser.removeEventListener("DOMContentLoaded", page_change_handler, false);

            /* Remove UI */
            addressBarIcon.parentNode.removeChild(addressBarIcon);
        }, win);
    };

    /* Returns the correct icon source entry for a given record */
    // TODO
    // Expand this to account for proxies
    // Also account for error conditions, e.g. using v4 with no v4 in DNS
    get_icon_source = function (record) {
        if (record.address_family === 4) {
            if (record.ipv6s.length !== 0) {
                // Actual is v4, DNS is v4 + v6 -> Orange
                return imagesrc.get("4pot6");
            } else {
                // Actual is v4, DNS is v4 -> Red
                return imagesrc.get("4only");
            }
        } else if (record.address_family === 6) {
            if (record.ipv4s.length === 0) {
                // Actual is v6, DNS is v6 -> Blue
                return imagesrc.get("6only");
            } else {
                // Actual is v6, DNS is v4 + v6 -> Green
                return imagesrc.get("6and4");
            }
        } else if (record.address_family === 2) {
            // address family 2 is cached responses
            if (record.ipv6s.length === 0) {
                if (record.ipv4s.length === 0) {
                    // No addresses, grey cache icon
                    return imagesrc.get("other");
                } else {
                    // Only v4 addresses from DNS, red cache icon
                    return imagesrc.get("4only");
                }
            } else {
                if (record.ipv4s.length === 0) {
                    // Only v6 addresses from DNS, blue cache icon
                    return imagesrc.get("6only");
                } else {
                    // Both kinds of addresses from DNS, yellow cache icon
                    return imagesrc.get("4pot6");
                }
            }
        } else if (record.address_family === 0) {
            // This indicates that no addresses were available but request is not cached
            // Show error icon TODO
            return imagesrc.get("error");
        }
    };

    // Create address bar icon
    // Add address bar icon only if desired by preferences
    if (get_bool_pref("showaddressicon")) {
        log("Sixornot - insert_code: add addressicon", 1);
        create_addressbaricon();
    }

    // Create button
    log("Sixornot - insert_code: add mainui", 1);
    create_button();

};





    // TODO


// Warnings
// TODO add this to the panel before the rows
/* if (dns_handler.is_ip6_disabled()) {
    add_warning_line(gt("warn_ip6_disabled"));
} */

// TODO - this needs to be done for each host we lookup
/* if (dns_handler.is_ip4only_domain(host)) {
    add_warning_line(gt("warn_ip4only_domain"));
} */


/* Returns array of rows considered to be local */
/* var add_local_ips = function () {
    var local_ips = [];
    // Add local IP addresses, only show proper addresses unless setting set
    if (get_bool_pref("showallips")) {
        l6_filtered = localipv6s;
        l4_filtered = localipv4s;
    } else {
        l6_filtered = localipv6s.filter(function (item) {
            return dns_handler.typeof_ip6(item) === "global";
        });
        l4_filtered = localipv4s.filter(function (item) {
            return ["global", "rfc1918"].indexOf(dns_handler.typeof_ip4(item)) !== -1;
        });
    }
    // Add local IP address information if available
    if (l4_filtered.length !== 0 || l6_filtered.length !== 0) {
        local_ips.push(add_line(remote_rows, gt("header_local"), "text-align: center; font-size: smaller;"));
        l6_filtered.forEach(function (address, index, thearray) {
            if (index === 0) {
                local_ips.push(add_bold_host_line(remote_rows, 0, dnsService.myHostName, address, 6, null));
            } else {
                local_ips.push(add_v6_line(remote_rows, address));
            }
        });
        l4_filtered.forEach(function (address, index, thearray) {
            if (index === 0 && l6_filtered.length < 1) {
                local_ips.push(add_bold_host_line(remote_rows, 0, dnsService.myHostName, address, 4, null));
            } else {
                local_ips.push(add_v4_line(remote_rows, address));
            }
        });
    } else {
        local_ips.push(add_bold_host_line(remote_rows, 0, dnsService.myHostName, gt("no_local"), 0, null));
    }
    return local_ips;
}; */

// Trigger async local address resolve, callback updates local IP addresses
/* var local_dns_request = dns_handler.resolve_local_async(function (localips) {
    localipv6s = localips.filter(function (a) {
        return dns_handler.is_ip6(a) && dns_handler.typeof_ip6(a) !== "localhost";
    });
    localipv4s = localips.filter(function (a) {
        return dns_handler.is_ip4(a) && dns_handler.typeof_ip4(a) !== "localhost";
    });
    // Remove all local IP children from grid
    // Add new results to grid
    log("About to remove children, typeof local_ips is: " + typeof local_ips);
    log("About to remove children, local_ips.length is: " + local_ips.length);
    local_ips.forEach(function (item, index, thearray) {
        try {
            remote_rows.removeChild(item);
            log("Removed child: " + item, 0);
        } catch (e) {
            log("Error: " + e, 0);
        }
    });
    log("After removing children");
    local_ips = add_local_ips();
    //panel_vbox.setAttribute("maxheight", panel.clientHeight);
    log("Done");
}); */

/*              OLD tooltip creation function
    // TODO - Replace this with an array mapping/lookup table
    // TODO - If a special location is set no need to do any of the IP address stuff!
    if (specialLocation) {
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

/*
if (host === "")
{
    set_icon(imagesrc.get("other"));
    specialLocation = ["unknownsite"];
    log("Sixornot warning: no host returned for \"" + url + "\"");
    return;
}

// Offline mode or otherwise not connected
if (!win.navigator.onLine)
{
    set_icon(imagesrc.get("other"));
    specialLocation = ["offlinemode"];
    log("Sixornot is in offline mode");
    return;
}

// Proxy in use for DNS; can't do a DNS lookup
if (dns_handler.is_proxied_dns(url))
{
    set_icon(imagesrc.get("other"));
    specialLocation = ["nodnserror"];
    log("Sixornot is in proxied mode");
    return;
}
*/


/*
    bootstrap.js API
*/
startup = function (aData, aReason) {
    "use strict";
    var resource, alias;
    log("Sixornot - startup - reason: " + aReason, 0);
    // Set up resource URI alias
    resource = Services.io.getProtocolHandler("resource")
                .QueryInterface(Components.interfaces.nsIResProtocolHandler);

    alias = Services.io.newFileURI(aData.installPath);
    log("Install path is: " + aData.resourceURI.spec);

    if (!aData.installPath.isDirectory()) {
        alias = Services.io.newURI("jar:" + alias.spec + "!/", null, null);
        log("Install path is: " + alias.spec);
    }

    // This triggers a warning on AMO validation
    // The resource substitution is cleaned up by the addon's shutdown method
    // Search for "resource.setSubstitution("sixornot", null);"
    // TODO - this substitution is only needed so that the dns worker can be loaded
    //        from the dns code module - may be some way to avoid needing to do this??
    resource.setSubstitution("sixornot", alias);

    // Import module containing all images used by addon (adds global symbol imagesrc)
    log("Importing: \"" + aData.resourceURI.spec + "includes/imagesrc.jsm\"", 1);
    /*jslint es5: true */
    Components.utils.import(aData.resourceURI.spec + "includes/imagesrc.jsm");
    /*jslint es5: false */

    // Import dns module (adds global symbol dns_handler)
    log("Importing: \"" + aData.resourceURI.spec + "includes/dns.jsm\"", 1);
    /*jslint es5: true */
    Components.utils.import(aData.resourceURI.spec + "includes/dns.jsm");
    /*jslint es5: false */
    // Init dns_handler
    dns_handler.init();

    AddonManager.getAddonByID(aData.id, function (addon, data) {
        var prefs;

        // Include libraries
        log("Sixornot - startup - including: " + addon.getResourceURI("includes/utils.js").spec, 2);
        include(addon.getResourceURI("includes/utils.js").spec);
        log("Sixornot - startup - including: " + addon.getResourceURI("includes/locale.js").spec, 2);
        include(addon.getResourceURI("includes/locale.js").spec);


        // Run dns_handler tests
        // Only run these if debug level is set to 2 or higher
        if (get_int_pref("loglevel") >= 2) {
            dns_handler.test_normalise_ip6();
            dns_handler.test_typeof_ip6();
            dns_handler.test_is_ip6();
        }


        log("Sixornot - startup - initLocalisation...", 2);
        initLocalisation(addon, "sixornot.properties", get_char_pref("overridelocale"));

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
reload = function () {
    "use strict";
    log("Sixornot - reload", 1);
    unload();
    watchWindows(insert_code);
};

shutdown = function (aData, aReason) {
    "use strict";
    var prefs, resource;
    log("Sixornot - shutdown - reason: " + aReason, 0);

    if (aReason !== APP_SHUTDOWN) {
        // Unload all UI via init-time unload() callbacks
        unload();

        // Unload our own code modules
        // Shutdown dns_handler
        dns_handler.shutdown();
        log("Unloading: \"" + aData.resourceURI.spec + "includes/dns.jsm\"", 1);
        Components.utils.unload(aData.resourceURI.spec + "includes/dns.jsm");

        log("Unloading: \"" + aData.resourceURI.spec + "includes/imagesrc.jsm\"", 1);
        Components.utils.unload(aData.resourceURI.spec + "includes/imagesrc.jsm");

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

install = function (aData, aReason) {
    "use strict";
    log("Sixornot - install - reason: " + aReason, 0);
    set_initial_prefs();
};

uninstall = function (aData, aReason) {
    "use strict";
    log("Sixornot - uninstall - reason: " + aReason, 0);
    // TODO If this is due to an upgrade then don't delete preferences?
    // Some kind of upgrade function to potentially upgrade preference settings may be required
    // Upgrade function needs to check each existing setting which is in the current version's list of preferences
    // and determine if the value needs to be upgraded - this should be simple if the prefs are kept simple...
    if (aReason !== ADDON_UPGRADE) {
        PREF_BRANCH_SIXORNOT.deleteBranch("");
    }
};


/*
    Utility functions
*/


// Return string preference value, either from prefs branch or internal defaults
get_char_pref = function (name) {
    "use strict";
    log("Sixornot - get_char_pref - name: " + name, 2);
    try {
        return PREF_BRANCH_SIXORNOT.getCharPref(name);
    } catch (e) {
        log("Sixornot - get_char_pref error - " + e, 0);
    }
    if (PREFS.hasOwnProperty(name)) {
        log("Sixornot - get_char_pref returning PREFS[name] : " + PREFS[name], 2);
        return PREFS[name];
    } else {
        log("Sixornot - get_char_pref error - No default preference value for requested preference: " + name, 0);
    }
};

// Return integer preference value, either from prefs branch or internal defaults
// TODO - move into utils.js
get_int_pref = function (name) {
    "use strict";
    log("Sixornot - get_int_pref - name: " + name, 2);
    try {
        return PREF_BRANCH_SIXORNOT.getIntPref(name);
    } catch (e) {
        log("Sixornot - get_int_pref error - " + e, 0);
    }
    if (PREFS.hasOwnProperty(name)) {
        log("Sixornot - get_int_pref returning PREFS[name] : " + PREFS[name], 2);
        return PREFS[name];
    } else {
        log("Sixornot - get_int_pref error - No default preference value for requested preference: " + name, 0);
    }
};

// Return boolean preference value, either from prefs branch or internal defaults
// TODO - move into utils.js
get_bool_pref = function (name) {
    "use strict";
    log("Sixornot - get_bool_pref - name: " + name, 2);
    try {
        return PREF_BRANCH_SIXORNOT.getBoolPref(name);
    } catch (e) {
        log("Sixornot - get_bool_pref error - " + e, 0);
    }
    if (PREFS.hasOwnProperty(name)) {
        log("Sixornot - get_bool_pref returning PREFS[name] : " + PREFS[name], 2);
        return PREFS[name];
    } else {
        log("Sixornot - get_bool_pref error - No default preference value for requested preference: " + name, 0);
    }
};

// Set up initial values for preferences
// TODO - Move into closure
set_initial_prefs = function () {
    "use strict";
    var key, val;
    log("Sixornot - set_initial_prefs", 2);
    for (key in PREFS) {
        if (PREFS.hasOwnProperty(key)) {
            // Preserve pre-existing values for preferences in case user has modified them
            val = PREFS[key];
            if (typeof val === "boolean") {
                if (PREF_BRANCH_SIXORNOT.getPrefType(key) === Services.prefs.PREF_INVALID) {
                    PREF_BRANCH_SIXORNOT.setBoolPref(key, val);
                }
            } else if (typeof val === "number") {
                if (PREF_BRANCH_SIXORNOT.getPrefType(key) === Services.prefs.PREF_INVALID) {
                    PREF_BRANCH_SIXORNOT.setIntPref(key, val);
                }
            } else if (typeof val === "string") {
                if (PREF_BRANCH_SIXORNOT.getPrefType(key) === Services.prefs.PREF_INVALID) {
                    PREF_BRANCH_SIXORNOT.setCharPref(key, val);
                }
            }
        }
    }
};


