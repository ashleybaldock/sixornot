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

/*jslint white: true */

// Provided by Firefox:
/*global Components, Services, APP_SHUTDOWN, AddonManager */

// Provided in included modules:
/*global gt, unload, watchWindows, initLocalisation, gbi */

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
    ADDRESS_IMG_ID,
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
    s6only_16_c, s6and4_16_c, s4pot6_16_c, s4only_16_c, sother_16_c, serror_16_c,
    s6only_24_c, s6and4_24_c, s4pot6_24_c, s4only_24_c, sother_24_c, serror_24_c,
    s6only_cache_16_c, s4pot6_cache_16_c, s4only_cache_16_c, sother_cache_16_c,
    s6only_cache_24_c, s4pot6_cache_24_c, s4only_cache_24_c, sother_cache_24_c,
    // Greyscale icons
    s6only_16_g, s6and4_16_g, s4pot6_16_g, s4only_16_g, sother_16_g, serror_16_g,
    s6only_24_g, s6and4_24_g, s4pot6_24_g, s4only_24_g, sother_24_g, serror_24_g,
    s6only_cache_16_g, s4pot6_cache_16_g, s4only_cache_16_g, sother_cache_16_g,
    s6only_cache_24_g, s4pot6_cache_24_g, s4only_cache_24_g, sother_cache_24_g,
    // Current icons
    s6only_16,   s6and4_16,   s4pot6_16,   s4only_16,   sother_16, serror_16,
    s6only_24,   s6and4_24,   s4pot6_24,   s4only_24,   sother_24, serror_24,
    s6only_cache_16,   s4pot6_cache_16,   s4only_cache_16,   sother_cache_16,
    s6only_cache_24,   s4pot6_cache_24,   s4only_cache_24,   sother_cache_24,
    // dns_handler
    dns_handler,
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
    set_iconset,
    get_bool_pref,
    get_int_pref,
    set_initial_prefs,
    parse_exception,
    defineLazyGetter,
    // Global objects
    xulRuntime;


// Fake data for testing
var localipv4s = [];
var localipv6s = [];
var locallookuptime = 0;


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


TODO - investigate crash on exit - related to DNS resolver??

*/

var RequestCache = [];
var RequestWaitingList = [];

// TODO - periodic refresh of local addresses + store these globally

xulRuntime = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime);

NS_XUL          = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

BUTTON_ID       = "sixornot-buttonid";
ADDRESS_IMG_ID  = "sixornot-addressimageid";
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
(function (scope) {
    scope.include = function (src) {
        // This triggers a warning on AMO validation
        // This method is only used to import utils.js and locale.js
        // Which are local to this addon (under include directory)
        Services.scriptloader.loadSubScript(src, scope);
    };
})(this);

// Log a message to error console, but only if it is important enough
log = (function () {
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
            consoleService.logStringMessage(message);
        }
    };
}());


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
            set_iconset();
            reload();
        }
        // TODO Update worker process to use new log level?
        if (aData === "loglevel") {
            log("Sixornot - PREF_OBSERVER - loglevel has changed", 1);
            // Ensure dns_worker is at the same loglevel
            dns_handler.set_worker_loglevel(PREF_BRANCH_SIXORNOT.getIntPref("loglevel"));
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
        var notifcationCallbacks, domWindow, domWindowUtils, domWindowInner,
            domWindowOuter, original_window, new_page, remoteAddress, send_event,
            lookupIPs, http_channel, http_channel_internal, nC, new_entry, hosts, evt, cancelled;
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
        var create_new_entry = function (host, address, address_family, origin, inner, outer) {
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
                    /* Create closure containing reference to element and trigger async lookup with callback */
                    var entry = this;
                    var on_returned_ips = function (ips) {
                        var evt, cancelled;
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
                        entry.dns_cancel();
                    }
                    entry.dns_cancel = dns_handler.resolve_remote_async(entry.host, on_returned_ips);
                }
            };
        };

        var remoteAddressFamily;

        if (aTopic === "http-on-examine-response" || aTopic === "http-on-examine-cached-response") {
            http_channel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
            http_channel_internal = aSubject.QueryInterface(Components.interfaces.nsIHttpChannelInternal);

            if (aTopic === "http-on-examine-response") {
                try {
                    remoteAddress = http_channel_internal.remoteAddress;
                    remoteAddressFamily = remoteAddress.indexOf(":") === -1 ? 4 : 6;
                    // TODO move this code into a function executed immediately for address_family item
                } catch (e) {
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
            } catch (e) {
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
                    var new_entry = create_new_entry(http_channel.URI.host, remoteAddress, remoteAddressFamily, domWindow, domWindowInner, domWindowOuter);
                    send_event("sixornot-new-host-event", domWindow, new_entry);
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
                throw "Sixornot = HTTP_REQUEST_OBSERVER - content-document-global-created: RequestCache already contains content entries."
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
                RequestCache.splice(domWindowInner, 1)[0].forEach(function (item, index, items) {
                    if (item.dns_cancel) {
                        log("Cancelling DNS...", 1);
                        item.dns_cancel();
                    }
                });
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
                        item.dns_cancel();
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
    https://addons.mozilla.org/en-US/firefox/files/browse/129684/file/bootstrap.js#L127
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
    var doc, onMenuCommand,
        create_button, create_addressbaricon, create_panel,
        get_icon_source,
        currentTabInnerID, currentTabOuterID, setCurrentTabIDs,
        getCurrentHost,
        update_panel;

    doc = win.document;

    // TODO move this up a level to allow other functions to use it
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

    /* Creates and sets up a panel to display information which can then be bound to an icon */
    create_panel = function () {
        var panel, refresh_panel;
        panel = doc.createElement("panel");
        panel.setAttribute("noautohide", true);

        // This contains everything else in the panel, vertical orientation
        var panel_vbox = doc.createElement("vbox");
        panel_vbox.setAttribute("flex", "1");
        panel_vbox.style.overflowY = "auto";
        panel_vbox.style.overflowX = "hidden";
        panel.appendChild(panel_vbox);

        // Build containing panel UI
        var remote_grid = doc.createElement("grid");
        var remote_rows = doc.createElement("rows");
        var remote_cols = doc.createElement("columns");
        // 5 columns wide
        // icon, count, host, address, extra
        remote_cols.appendChild(doc.createElement("column"));
        remote_cols.appendChild(doc.createElement("column"));
        remote_cols.appendChild(doc.createElement("column"));
        remote_cols.appendChild(doc.createElement("column"));
        remote_cols.appendChild(doc.createElement("column"));
        remote_grid.appendChild(remote_cols);
        remote_grid.appendChild(remote_rows);
        panel_vbox.appendChild(remote_grid);

        // Add "Remote" title
        var title_remote = doc.createElement("label");
        title_remote.setAttribute("value", gt("header_remote"));
        title_remote.setAttribute("style", "text-align: center; font-size: smaller;");
        remote_rows.appendChild(title_remote);
        // Add remote title anchor object
        var remote_anchor = {
            add_after: function (element) {
                if (title_remote.nextSibling) {
                    remote_rows.insertBefore(element, title_remote.nextSibling);
                } else {
                    remote_rows.appendChild(element);
                }
            }
        };

        // Add "Local" title (TODO - replace with element with "hide" method)
        var title_local = doc.createElement("label");
        title_local.setAttribute("value", gt("header_local"));
        title_local.setAttribute("style", "text-align: center; font-size: smaller;");
        remote_rows.appendChild(title_local);

        // Settings UI
        var settingslabel = doc.createElement("description");
        settingslabel.setAttribute("value", "Settings");
        settingslabel.setAttribute("flex", "1");
        settingslabel.setAttribute("style", "text-align: right; font-size: smaller;");

        var settingssep = doc.createElement("separator");
        settingssep.setAttribute("orient", "vertical");
        settingssep.setAttribute("class", "thin");

        var settingstoggle = doc.createElement("description");
        settingstoggle.setAttribute("value", "[Show]");
        settingstoggle.setAttribute("flex", "1");
        settingstoggle.setAttribute("style", "text-decoration: underline; text-align: left; font-size: smaller;");
        var settingslabel_hbox = doc.createElement("hbox");
        settingslabel_hbox.appendChild(settingslabel);
        settingslabel_hbox.appendChild(settingssep);
        settingslabel_hbox.appendChild(settingstoggle);
        panel_vbox.appendChild(settingslabel_hbox);

        // Add a checkbox to the settings UI
        var add_checkbox = function (addto, label, checked) {
            var cbox, hbox;
            cbox = doc.createElement("checkbox");
            cbox.setAttribute("label", label);
            cbox.setAttribute("checked", checked);
            cbox.setAttribute("hidden", true);
            hbox = doc.createElement("hbox");
            hbox.appendChild(cbox);
            addto.appendChild(hbox);
            return cbox;
        };

        // Show icon
        var setting_icon = add_checkbox(panel_vbox, "Show addressbar icon", true);

        // Greyscale
        var setting_grey = add_checkbox(panel_vbox, "Greyscale mode", true);

        // Show all IPs
        var setting_show = add_checkbox(panel_vbox, "Show all local IPs", true);

        var show_settings = function (evt) {
            evt.stopPropagation();
            // Show the settings UI
            setting_icon.setAttribute("hidden", false);
            setting_grey.setAttribute("hidden", false);
            setting_show.setAttribute("hidden", false);
            settingstoggle.setAttribute("value", "[Hide]");
            settingstoggle.removeEventListener("click", show_settings, false);
            settingstoggle.addEventListener("click", hide_settings, false);
        };
        var hide_settings = function (evt) {
            evt.stopPropagation();
            // Show the settings UI
            setting_icon.setAttribute("hidden", true);
            setting_grey.setAttribute("hidden", true);
            setting_show.setAttribute("hidden", true);
            settingstoggle.setAttribute("value", "[Show]");
            settingstoggle.removeEventListener("click", hide_settings, false);
            settingstoggle.addEventListener("click", show_settings, false);
        };

        settingstoggle.addEventListener("click", show_settings, false);
        settingstoggle.addEventListener("mouseover", function (evt) {
            evt.target.style.cursor="pointer";
        }, false);
        settingstoggle.addEventListener("mouseout", function (evt) {
            evt.target.style.cursor="default";
        }, false);

        /* Add a clickable URL field */
        var add_url = function (addto, url, text) {
            var label, hbox;
            label = doc.createElement("description");

            label.setAttribute("value", text);
            label.setAttribute("crop", "none");
            label.setAttribute("style", "text-decoration: underline;");
            // TODO remove event listeners
            label.addEventListener("click", function (evt) {
                var currentWindow, currentBrowser;
                evt.stopPropagation();
                panel.hidePopup();
                // Add tab to most recent window, regardless of where this function was called from
                currentWindow = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator)
                     .getMostRecentWindow("navigator:browser");
                currentWindow.focus();
                currentBrowser = currentWindow.getBrowser();
                currentBrowser.selectedTab = currentBrowser.addTab(url);
            }, false);
            label.addEventListener("mouseover", function (evt) {
                evt.target.style.cursor="pointer";
            }, false);
            label.addEventListener("mouseout", function (evt) {
                evt.target.style.cursor="default";
            }, false);
            hbox = doc.createElement("hbox");
            hbox.appendChild(label);
            hbox.setAttribute("align", "end");
            addto.appendChild(hbox);
        };

        // Add link to Sixornot website to UI
        add_url(panel_vbox, "http://entropy.me.uk/sixornot/", "Goto Sixornot website");



        /* Functions */

        /* Get the hosts list for the current window */
        var get_hosts = function () {
            // New functionality, get IDs for lookup
            return RequestCache[win.gBrowser.mCurrentBrowser.contentWindow.domWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils).currentInnerWindowID];
        };

        /* Ensure panel contents visible with scrollbars */
        var force_scrollbars = function () {
            if (panel_vbox.clientHeight > panel.clientHeight) {
                panel_vbox.setAttribute("maxheight", panel.clientHeight - 50);
                // TODO if panel width changes after this is applied horizontal fit breaks
                panel_vbox.setAttribute("minwidth", panel_vbox.clientWidth + 40);
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
        var new_line = function (host, addafter) {
            log("Sixornot - new_line", 1);
            var mouseover = function (evt) {
                evt.target.style.textDecoration = "underline";
                evt.target.style.cursor="pointer";
            };
            var mouseout = function (evt) {
                evt.target.style.textDecoration = "none";
                evt.target.style.cursor="default";
            };

            /* Create and return a new detail line item */
            var create_detail_row = function (add_address, addafter) {
                log("Sixornot - create_detail_row", 1);
                // 3 spacers, address
                var s1, s2, s3, address, row, update;
                s1 = doc.createElement("image");
                s1.setAttribute("width", "16");
                s1.setAttribute("height", "16");
                s1.setAttribute("src", "");
                s2 = doc.createElement("label");
                s2.setAttribute("value", "");
                s3 = doc.createElement("label");
                s3.setAttribute("value", "");
                address = doc.createElement("label");
                address.addEventListener("mouseover", mouseover, false);
                address.addEventListener("mouseout", mouseout, false);
                // Colouring for field
                if (dns_handler.is_ip6(add_address)) {
                    address.setAttribute("value", add_address);
                    address.setAttribute("style", "color: #0F0;");
                    address.setAttribute("tooltiptext", gt("tt_copyaddr"));
                } else if (dns_handler.is_ip4(add_address)) {
                    address.setAttribute("value", add_address);
                    address.setAttribute("style", "color: #F00;");
                    address.setAttribute("tooltiptext", gt("tt_copyaddr"));
                } else {
                    // Should not happen!
                    address.setAttribute("value", "ERROR");
                    address.setAttribute("style", "color: #FF0;");
                }
                // Create row
                row = doc.createElement("row");
                // Add elements to row
                row.appendChild(s1);
                row.appendChild(s2);
                row.appendChild(s3);
                row.appendChild(address);

                update = function () {
                    // Show or hide the row
                    row.setAttribute("hidden", !(host.show_detail));
                };
                /* Update element on create */
                update();
                /* Add this element after the last one */
                addafter.add_after(row);
                /* Object representing header row of entry */
                return {
                    update: update,
                    remove: function () {
                        address.removeEventListener("mouseover", mouseover, false);
                        address.removeEventListener("mouseout", mouseout, false);
                        row.removeChild(s1);
                        row.removeChild(s2);
                        row.removeChild(s3);
                        row.removeChild(address);
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

            /* Create and return a new line item */
            var create_header_row = function (addafter) {
                log("Sixornot - create_header_row", 1);
                var create_showhide = function (addto) {
                    var c6, c4, hide, hbox, update;
                    log("Sixornot - create_showhide", 1);
                    hbox = doc.createElement("hbox");
                    hbox.setAttribute("pack", "center");

                    /* Create DOM UI elements */
                    c6 = doc.createElement("label");
                    c6.setAttribute("style", "color: #0F0;");
                    c6.setAttribute("tooltiptext", gt("tt_show_detail"));
                    c4 = doc.createElement("label");
                    c4.setAttribute("style", "color: #F00;");
                    c4.setAttribute("tooltiptext", gt("tt_show_detail"));
                    hide = doc.createElement("label");
                    hide.setAttribute("value", "[Hide]");
                    hide.setAttribute("style", "");
                    hide.setAttribute("tooltiptext", gt("tt_hide_detail"));

                    hbox.appendChild(c6);
                    hbox.appendChild(c4);
                    hbox.appendChild(hide);

                    c4.addEventListener("mouseover", mouseover, false);
                    c4.addEventListener("mouseout", mouseout, false);
                    c6.addEventListener("mouseover", mouseover, false);
                    c6.addEventListener("mouseout", mouseout, false);
                    hide.addEventListener("mouseover", mouseover, false);
                    hide.addEventListener("mouseout", mouseout, false);

                    update = function () {
                        var count6 = 0, count4 = 0;
                        host.ipv6s.forEach(function (address, index, addresses) {
                            if (address !== host.address) {
                                count6 += 1;
                            }
                        });
                        host.ipv4s.forEach(function (address, index, addresses) {
                            if (address !== host.address) {
                                count4 += 1;
                            }
                        });
                        hide.setAttribute("hidden",
                            !(host.show_detail && (count6 > 0 || count4 > 0)));

                        c6.setAttribute("value", "[+" + count6 + "]");
                        c6.setAttribute("hidden",
                            !(!host.show_detail && count6 > 0));

                        c4.setAttribute("value", "[+" + count4 + "]");
                        c4.setAttribute("hidden",
                            !(!host.show_detail && count4 > 0));
                    };
                    /* Update elements on create */
                    update();
                    addto.appendChild(hbox);
                    /* Return object for interacting with DOM elements */
                    return {
                        update: update,
                        remove: function () {
                            c4.removeEventListener("mouseover", mouseover, false);
                            c4.removeEventListener("mouseout", mouseout, false);
                            c6.removeEventListener("mouseover", mouseover, false);
                            c6.removeEventListener("mouseout", mouseout, false);
                            hide.removeEventListener("mouseover", mouseover, false);
                            hide.removeEventListener("mouseout", mouseout, false);

                            hbox.removeChild(c4);
                            hbox.removeChild(c6);
                            hbox.removeChild(hide);
                            addto.removeChild(hbox);
                        }
                    };
                };
                var create_icon = function (addto) {
                    var icon, update;
                    log("Sixornot - create_icon", 1);
                    /* Create DOM UI elements */
                    icon = doc.createElement("image");
                    icon.setAttribute("width", "16");
                    icon.setAttribute("height", "16");
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
                var create_count = function (addto) {
                    var count, update;
                    log("Sixornot - create_count", 1);
                    /* Create DOM UI elements */
                    count = doc.createElement("label");
                    count.addEventListener("mouseover", mouseover, false);
                    count.addEventListener("mouseout", mouseout, false);

                    count.setAttribute("tooltiptext", gt("tt_copycount"));
                    update = function () {
                        if (host.count > 0) {
                            count.setAttribute("value", "(" + host.count + ")");
                        } else {
                            count.setAttribute("value", "");
                        }
                    };
                    /* Update element on create */
                    update();
                    addto.appendChild(count);
                    /* Return object for interacting with DOM element */
                    return {
                        update: update,
                        remove: function () {
                            count.removeEventListener("mouseover", mouseover, false);
                            count.removeEventListener("mouseout", mouseout, false);
                            addto.removeChild(count);
                        }
                    };
                };
                var create_hostname = function (addto) {
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
                    hostname.addEventListener("mouseover", mouseover, false);
                    hostname.addEventListener("mouseout", mouseout, false);

                    hostname.setAttribute("tooltiptext", gt("tt_copyall"));
                    update = function () {
                        // Update the copy+paste text TODO
                    };
                    /* Update element on create */
                    update();
                    addto.appendChild(hostname);
                    /* Return object for interacting with DOM element */
                    return {
                        update: update,
                        remove: function () {
                            hostname.removeEventListener("mouseover", mouseover, false);
                            hostname.removeEventListener("mouseout", mouseout, false);
                            addto.removeChild(hostname);
                        }
                    };
                };
                var create_conip = function (addto) {
                    var address, update;
                    log("Sixornot - create_conip", 1);
                    /* Create DOM UI elements */
                    address = doc.createElement("label");
                    address.addEventListener("mouseover", mouseover, false);
                    address.addEventListener("mouseout", mouseout, false);

                    update = function () {
                        if (host.address_family === 6) {
                            address.setAttribute("value", host.address);
                            address.setAttribute("style", "color: #0F0;");
                            address.setAttribute("tooltiptext", gt("tt_copyaddr"));
                        } else if (host.address_family === 4) {
                            address.setAttribute("value", host.address);
                            address.setAttribute("style", "color: #F00;");
                            address.setAttribute("tooltiptext", gt("tt_copyaddr"));
                        } else if (host.address_family === 2) {
                            address.setAttribute("value", gt("addr_cached"));
                            address.setAttribute("style", "color: #00F;");
                        } else {
                            address.setAttribute("value", gt("addr_unavailable"));
                            address.setAttribute("style", "color: #000;");
                        }
                        // Update the copy+paste text TODO
                    };
                    /* Update element on create */
                    update();
                    addto.appendChild(address);
                    /* Return object for interacting with DOM element */
                    return {
                        update: update,
                        remove: function () {
                            address.removeEventListener("mouseover", mouseover, false);
                            address.removeEventListener("mouseout", mouseout, false);
                            addto.removeChild(address);
                        }
                    };
                };

                // Create row
                var row = doc.createElement("row");
                /* Add this element after the last one */
                addafter.add_after(row);
                //addafter.parentNode.insertAfter(addafter, row);
                /* Object representing header row of entry */
                return {
                    icon: create_icon(row),
                    count: create_count(row),
                    hostname: create_hostname(row),
                    con_ip: create_conip(row),
                    showhide: create_showhide(row),
                    /* Remove this element and all children */
                    remove: function () {
                        this.icon.remove();
                        this.count.remove();
                        this.hostname.remove();
                        this.con_ip.remove();
                        this.showhide.remove();
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

            /* Return sorted array of detail rows */
            var create_detail_rows = function (addafter) {
                log("Sixornot - create_detail_rows", 1);
                var detail_rows = [];
                
                /* Sort the lists of addresses */
                host.ipv6s.sort(function (a, b) {
                    return dns_handler.sort_ip6.call(dns_handler, a, b);
                });
                host.ipv4s.sort(function (a, b) {
                    return dns_handler.sort_ip4.call(dns_handler, a, b);
                });
                host.ipv6s.forEach(function (address, index, addresses) {
                    if (address !== host.address) {
                        detail_rows.push(create_detail_row(address, detail_rows[0] || addafter));
                    }
                });
                host.ipv4s.forEach(function (address, index, addresses) {
                    if (address !== host.address) {
                        detail_rows.push(create_detail_row(address, detail_rows[0] || addafter));
                    }
                });
                return detail_rows;
            };
            // Bind onclick events here TODO
            var header_row = create_header_row(addafter);
            var detail_rows = create_detail_rows(header_row);

            return {
                header_row: header_row,
                detail_rows: detail_rows,
                host: host,
                copy_full: "",
                remove: function () {
                    header_row.remove();
                    this.detail_rows.forEach(function (item, index, items) {
                        item.remove();
                    });
                },
                show_detail: function () {
                    this.detail_rows.forEach(function (item, index, items) {
                        item.update();
                    });
                    this.header_row.showhide.update();
                },
                hide_detail: function () {
                    this.detail_rows.forEach(function (item, index, items) {
                        item.update();
                    });
                    this.header_row.showhide.update();
                },
                update_address: function () {
                    this.header_row.con_ip.update();
                    this.header_row.icon.update();
                },
                update_ips: function () {
                    this.detail_rows.forEach(function (item, index, items) {
                        item.remove();
                    });
                    this.detail_rows = create_detail_rows(this.header_row);
                    this.header_row.showhide.update();
                    this.header_row.icon.update();
                },
                update_count: function () {
                    this.header_row.count.update();
                },

                /* Return the last element, useful for inserting another element after this one */
                get_last_element: function () {
                    if (this.detail_rows.length > 0) {
                        return this.detail_rows[this.detail_rows.length - 1];
                    } else {
                        return this.header_row;
                    }
                },
                /* Adds the contents of this object after the specified element */
                add_after: function (element) {
                    if (row.nextSibling) {
                        row.parentNode.insertBefore(element, row.nextSibling);
                    } else {
                        row.parentNode.appendChild(element);
                    }
                }
            };
        };

        var grid_contents = [];

        var remove_all = function () {
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
        var generate_all = function () {
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

        // On show panel
        // If so remove all entries in grid_contents list
        // Then create a new entry in grid_contents (new_grid_line()) for each element
        // in the cache matching this page
        // 
        var on_show_panel = function (evt) {
            log("Sixornot - panel:on_show_panel", 1);
            remove_all();
            generate_all();
        };

        // On page change
        // Check if tab innerID matches event innerID
        // If so repopulate grid_contents list as per show panel
        var on_page_change = function (evt) {
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
        var on_new_host = function (evt) {
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
        var on_address_change = function (evt) {
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
        var on_count_change = function (evt) {
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
        var on_dns_complete = function (evt) {
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
        var on_tab_select = function (evt) {
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


        /* Update all panel contents */

        /* Update local IP contents */

        /* Update remote IP contents */
        /* var update_remote_list = function (evt) {
                var copy_full = host.host;
                if (host.address) {
                    copy_full = copy_full + "," + host.address;
                }

                host.ipv6s.forEach(function (address, index, addresses) {
                    if (address !== host.address) {
                        count6 += 1;
                        copy_full = copy_full + "," + address;
                    }
                });
                host.ipv4s.forEach(function (address, index, addresses) {
                    if (address !== host.address) {
                        count4 += 1;
                        copy_full = copy_full + "," + address;
                    }
                });
                copy_full = copy_full + "\n";

                var add_show_detail_listeners = function (element) {
                    element.addEventListener("click", function (evt) {
                        evt.stopPropagation();
                        summary_rows.forEach(function (row, index, thearray) {
                            row.setAttribute("hidden", true);
                        });
                        detail_rows.forEach(function (row, index, thearray) {
                            row.setAttribute("hidden", false);
                        });
                    }, false);
                };
                var add_hide_detail_listeners = function (element) {
                    element.addEventListener("click", function (evt) {
                        evt.stopPropagation();
                        summary_rows.forEach(function (row, index, thearray) {
                            row.setAttribute("hidden", false);
                        });
                        detail_rows.forEach(function (row, index, thearray) {
                            row.setAttribute("hidden", true);
                        });
                    }, false);
                };

                //  add them to some kind of array for removal...
                var add_copy_on_click = function (element, copytext) {
                    element.addEventListener("click", function (evt) {
                        evt.stopPropagation();
                        clipboardHelper.copyString(copytext);
                        // TODO add confirmation message to main UI to indicate copy worked
                    }, false);
                };

            };
        }; */

        // Panel setup
        panel.setAttribute("type", "arrow");
        panel.setAttribute("hidden", true);
        panel.setAttribute("position", "bottomcenter topright");

        // This must be set so that panel's children don't inherit this style!
        panel.style.listStyleImage = "none";

        // Event listener to update panel contents when it is shown
        panel.addEventListener("popupshowing", on_show_panel, false);
        win.addEventListener("sixornot-page-change-event", on_page_change, false);
        win.addEventListener("sixornot-new-host-event", on_new_host, false);
        win.addEventListener("sixornot-address-change-event", on_address_change, false);
        win.addEventListener("sixornot-count-change-event", on_count_change, false);
        win.addEventListener("sixornot-dns-lookup-event", on_dns_complete, false);
        win.gBrowser.tabContainer.addEventListener("TabSelect", on_tab_select, false);

        // Add a callback to our unload list to remove the UI when addon is disabled
        unload(function () {
            log("Sixornot - Unload panel callback", 2);
            // Remove event listeners
            panel.removeEventListener("popupshowing", on_show_panel, false);
            win.removeEventListener("sixornot-page-change-event", on_page_change, false);
            win.removeEventListener("sixornot-new-host-event", on_new_host, false);
            win.removeEventListener("sixornot-address-change-event", on_address_change, false);
            win.removeEventListener("sixornot-count-change-event", on_count_change, false);
            win.removeEventListener("sixornot-dns-lookup-event", on_dns_complete, false);
            win.gBrowser.tabContainer.removeEventListener("TabSelect", on_tab_select, false);
            // Remove UI
            panel.parentNode.removeChild(panel);
        }, win);

        return panel;
    };

    /* Creates icon button and binds events */
    create_button = function () {
        var toolbarButton, toolbarId, toolbar,
            nextItem,
            onclick_toolbarButton, panel, toggle_customise,
            page_change_handler, tabselect_handler, update_icon;
        log("Sixornot - insert_code:create_button", 2);

        // Event handler to show panel
        onclick_toolbarButton = function () {
            panel.setAttribute("hidden", false);
            panel.openPopup(toolbarButton, panel.getAttribute("position"), 0, 0, false, false);
        };

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
                toolbarButton.style.listStyleImage = "url('" + sother_16 + "')";
                return;
            }

        };

        /* Called whenever the current window's active tab is changed
           Calls the update method for the icon */
        tabselect_handler = function (evt) {
            log("Sixornot - insert_code:create_button:tabselect_handler", 1);
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

        /* When button location is customised store the new location in preferences so we can load into the same place next time */
        toggle_customise = function (evt) {
            var button_parent, button_nextitem, toolbar_id, nextitem_id;
            log("Sixornot - insert_code:create_button:toggle_customise");
            if (toolbarButton) {
                button_parent = toolbarButton.parentNode;
                button_nextitem = toolbarButton.nextSibling;
                if (button_parent && button_parent.localName === "toolbar") {
                    toolbar_id = button_parent.id;
                    nextitem_id = button_nextitem && button_nextitem.id;
                }
            }
            PREF_BRANCH_SIXORNOT.setCharPref(PREF_TOOLBAR,  toolbar_id || "");
            PREF_BRANCH_SIXORNOT.setCharPref(PREF_NEXTITEM, nextitem_id || "");
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
        toolbarButton.style.listStyleImage = "url('" + sother_16 + "')";

        /* Create a panel to show details when clicked */
        panel = create_panel();
        toolbarButton.appendChild(panel);

        /* Add button to toolbox palette, since it needs a parent */
        gbi(doc, "navigator-toolbox").palette.appendChild(toolbarButton);

        /* Move to location specified in prefs */
        toolbarId = PREF_BRANCH_SIXORNOT.getCharPref(PREF_TOOLBAR);
        toolbar = toolbarId && gbi(doc, toolbarId);
        if (toolbar) {
            nextItem = gbi(doc, PREF_BRANCH_SIXORNOT.getCharPref(PREF_NEXTITEM));
            toolbar.insertItem(BUTTON_ID, nextItem && nextItem.parentNode.id === toolbarId && nextItem);
        }

        /* Add event listeners */
        // win.addEventListener("online", onChangedOnlineStatus, false); TODO
        // win.addEventListener("offline", onChangedOnlineStatus, false); TODO
        toolbarButton.addEventListener("click", onclick_toolbarButton, false);
        win.addEventListener("aftercustomization", toggle_customise, false);

        /* Ensure tab ID is set upon loading into window */
        setCurrentTabIDs();

        /* Register for page change events */
        win.addEventListener("sixornot-page-change-event", page_change_handler, false);
        win.addEventListener("sixornot-dns-lookup-event", page_change_handler, false);
        win.gBrowser.tabContainer.addEventListener("TabSelect", tabselect_handler, false);

        /* Add a callback to unload to remove the button */
        unload(function () {
            log("Sixornot - Unload main UI for a window...", 2);

            /* Clear event handlers */
            win.removeEventListener("aftercustomization", toggle_customise, false);
            // win.removeEventListener("offline", onChangedOnlineStatus, false); TODO
            // win.removeEventListener("online", onChangedOnlineStatus, false); TODO
            toolbarButton.removeEventListener("click", onclick_toolbarButton, false);
            win.removeEventListener("sixornot-page-change-event", page_change_handler, false);
            win.removeEventListener("sixornot-dns-lookup-event", page_change_handler, false);
            win.gBrowser.tabContainer.removeEventListener("TabSelect", tabselect_handler, false);

            /* Remove UI */
            toolbarButton.parentNode.removeChild(toolbarButton);
        }, win);
    };

    create_addressbaricon = function () {
        var addressBarIcon, urlbaricons, starbutton,
            onclick_addressBarIcon, panel,
            page_change_handler, tabselect_handler, update_icon;
        log("Sixornot - insert_code:create_addressbaricon", 2);

        // Event handler to show panel
        onclick_addressBarIcon = function () {
            panel.setAttribute("hidden", false);
            panel.openPopup(addressBarIcon, panel.getAttribute("position"), 0, 0, false, false);
        };

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
                addressBarIcon.style.listStyleImage = "url('" + sother_16 + "')";
            }

        };

        /* When the active tab is changed this event handler updates the icon */
        tabselect_handler = function (evt) {
            log("Sixornot - insert_code:create_addressbaricon:tabselect_handler", 2);
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
        addressBarIcon.style.listStyleImage = "url('" + sother_16 + "')";
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

        /* Add event listeners */
        addressBarIcon.addEventListener("click", onclick_addressBarIcon, false);

        /* Ensure tab ID is set upon loading into window */
        setCurrentTabIDs();

        /* Register for page change events */
        win.addEventListener("sixornot-page-change-event", page_change_handler, false);
        win.addEventListener("sixornot-dns-lookup-event", page_change_handler, false);
        win.gBrowser.tabContainer.addEventListener("TabSelect", tabselect_handler, false);

        /* Add a callback to unload to remove the icon */
        unload(function () {
            log("Sixornot - address bar unload function", 2);

            /* Clear event handlers */
            addressBarIcon.removeEventListener("click", onclick_addressBarIcon, false);
            win.removeEventListener("sixornot-page-change-event", page_change_handler, false);
            win.removeEventListener("sixornot-dns-lookup-event", page_change_handler, false);
            win.gBrowser.tabContainer.removeEventListener("TabSelect", tabselect_handler, false);

            /* Remove UI */
            addressBarIcon.parentNode.removeChild(addressBarIcon);
        }, win);
    };

    /* Returns the correct icon source entry for a given record */
    // TODO
    // Expand this to account for proxies, cached files etc.
    // Also account for error conditions, e.g. using v4 with no v4 in DNS
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
        } else if (record.address_family === 2) {
            // address family 2 is cached responses
            if (record.ipv6s.length === 0) {
                if (record.ipv4s.length === 0) {
                    // No addresses, grey cache icon
                    return sother_cache_16;
                } else {
                    // Only v4 addresses from DNS, red cache icon
                    return s4only_cache_16;
                }
            } else {
                if (record.ipv4s.length === 0) {
                    // Only v6 addresses from DNS, blue cache icon
                    return s6only_cache_16;
                } else {
                    // Both kinds of addresses from DNS, yellow cache icon
                    return s4pot6_cache_16;
                }
            }
        } else if (record.address_family === 0) {
            // This indicates that no addresses were available but request is not cached
            // Show error icon TODO
            return serror_16;
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
                    } else if (dns_handler.is_ip4only_domain(record.host)) {
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
*/

/*
// Update the status icon state (icon & tooltip)
// Returns true if it's done and false if unknown
update_icon = function () {

    loc_options = ["file:", "data:", "about:", "chrome:", "resource:"];

    // For any of these protocols, display "other" icon
    if (loc_options.indexOf(contentDoc.location.protocol) !== -1) {
        set_icon(sother_16);
        specialLocation = ["localfile"];
        return true;
    }
};
*/


// Image set is either colour or greyscale
set_iconset = function () {
    "use strict";
    log("Sixornot - set_iconset", 2);
    // If greyscaleicons is set to true, load grey icons, otherwise load default set
    if (get_bool_pref("greyscaleicons")) {
        s6only_16 = s6only_16_g;
        s6and4_16 = s6and4_16_g;
        s4pot6_16 = s4pot6_16_g;
        s4only_16 = s4only_16_g;
        sother_16 = sother_16_g;
        serror_16 = serror_16_g;

        s6only_cache_16 = s6only_cache_16_g;
        s4pot6_cache_16 = s4pot6_cache_16_g;
        s4only_cache_16 = s4only_cache_16_g;
        sother_cache_16 = sother_cache_16_g;

        s6only_24 = s6only_24_g;
        s6and4_24 = s6and4_24_g;
        s4pot6_24 = s4pot6_24_g;
        s4only_24 = s4only_24_g;
        sother_24 = sother_24_g;
        serror_24 = serror_24_g;

        s6only_cache_24 = s6only_cache_24_g;
        s4pot6_cache_24 = s4pot6_cache_24_g;
        s4only_cache_24 = s4only_cache_24_g;
        sother_cache_24 = sother_cache_24_g;
    }
    else
    {
        s6only_16 = s6only_16_c;
        s6and4_16 = s6and4_16_c;
        s4pot6_16 = s4pot6_16_c;
        s4only_16 = s4only_16_c;
        sother_16 = sother_16_c;
        serror_16 = serror_16_c;

        s6only_cache_16 = s6only_cache_16_c;
        s4pot6_cache_16 = s4pot6_cache_16_c;
        s4only_cache_16 = s4only_cache_16_c;
        sother_cache_16 = sother_cache_16_c;

        s6only_24 = s6only_24_c;
        s6and4_24 = s6and4_24_c;
        s4pot6_24 = s4pot6_24_c;
        s4only_24 = s4only_24_c;
        sother_24 = sother_24_c;
        serror_24 = serror_24_c;

        s6only_cache_24 = s6only_cache_24_c;
        s4pot6_cache_24 = s4pot6_cache_24_c;
        s4only_cache_24 = s4only_cache_24_c;
        sother_cache_24 = sother_cache_24_c;
    }
};

/*
    bootstrap.js API
*/
startup = function (aData, aReason) {
    "use strict";
    var resource, alias;
    log("Sixornot - startup - reason: " + aReason, 0);
    // Set up resource URI alias
    resource = Services.io.getProtocolHandler("resource").QueryInterface(Components.interfaces.nsIResProtocolHandler);
    alias = Services.io.newFileURI(aData.installPath);
    if (!aData.installPath.isDirectory()) {
        alias = Services.io.newURI("jar:" + alias.spec + "!/", null, null);
    }
    // This triggers a warning on AMO validation
    // The resource substitution is cleaned up by the addon's shutdown method
    // Search for "resource.setSubstitution("sixornot", null);"
    resource.setSubstitution("sixornot", alias);

    AddonManager.getAddonByID(aData.id, function (addon, data) {
        var prefs;

        // Include libraries
        log("Sixornot - startup - including: " + addon.getResourceURI("includes/utils.js").spec, 2);
        include(addon.getResourceURI("includes/utils.js").spec);
        log("Sixornot - startup - including: " + addon.getResourceURI("includes/locale.js").spec, 2);
        include(addon.getResourceURI("includes/locale.js").spec);

        // Init dns_handler
        dns_handler.init();

        // Run dns_handler tests
        // Only run these if debug level is set to 2 or higher
        if (get_int_pref("loglevel") >= 2) {
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
        serror_16_g = addon.getResourceURI("images/error_g_16.png").spec;

        s6only_cache_16_g = addon.getResourceURI("images/6only_cache_g_16.png").spec;
        s4pot6_cache_16_g = addon.getResourceURI("images/4pot6_cache_g_16.png").spec;
        s4only_cache_16_g = addon.getResourceURI("images/4only_cache_g_16.png").spec;
        sother_cache_16_g = addon.getResourceURI("images/other_cache_g_16.png").spec;

        s6only_24_g = addon.getResourceURI("images/6only_g_24.png").spec;
        s6and4_24_g = addon.getResourceURI("images/6and4_g_24.png").spec;
        s4pot6_24_g = addon.getResourceURI("images/4pot6_g_24.png").spec;
        s4only_24_g = addon.getResourceURI("images/4only_g_24.png").spec;
        sother_24_g = addon.getResourceURI("images/other_g_24.png").spec;
        serror_24_g = addon.getResourceURI("images/error_g_24.png").spec;

        s6only_cache_24_g = addon.getResourceURI("images/6only_cache_g_24.png").spec;
        s4pot6_cache_24_g = addon.getResourceURI("images/4pot6_cache_g_24.png").spec;
        s4only_cache_24_g = addon.getResourceURI("images/4only_cache_g_24.png").spec;
        sother_cache_24_g = addon.getResourceURI("images/other_cache_g_24.png").spec;
        // Colour
        s6only_16_c = addon.getResourceURI("images/6only_c_16.png").spec;
        s6and4_16_c = addon.getResourceURI("images/6and4_c_16.png").spec;
        s4pot6_16_c = addon.getResourceURI("images/4pot6_c_16.png").spec;
        s4only_16_c = addon.getResourceURI("images/4only_c_16.png").spec;
        sother_16_c = addon.getResourceURI("images/other_c_16.png").spec;
        serror_16_c = addon.getResourceURI("images/error_c_16.png").spec;

        s6only_cache_16_c = addon.getResourceURI("images/6only_cache_c_16.png").spec;
        s4pot6_cache_16_c = addon.getResourceURI("images/4pot6_cache_c_16.png").spec;
        s4only_cache_16_c = addon.getResourceURI("images/4only_cache_c_16.png").spec;
        sother_cache_16_c = addon.getResourceURI("images/other_cache_c_16.png").spec;

        s6only_24_c = addon.getResourceURI("images/6only_c_24.png").spec;
        s6and4_24_c = addon.getResourceURI("images/6and4_c_24.png").spec;
        s4pot6_24_c = addon.getResourceURI("images/4pot6_c_24.png").spec;
        s4only_24_c = addon.getResourceURI("images/4only_c_24.png").spec;
        sother_24_c = addon.getResourceURI("images/other_c_24.png").spec;
        serror_24_c = addon.getResourceURI("images/error_c_24.png").spec;

        s6only_cache_24_c = addon.getResourceURI("images/6only_cache_c_24.png").spec;
        s4pot6_cache_24_c = addon.getResourceURI("images/4pot6_cache_c_24.png").spec;
        s4only_cache_24_c = addon.getResourceURI("images/4only_cache_c_24.png").spec;
        sother_cache_24_c = addon.getResourceURI("images/other_cache_c_24.png").spec;

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


// Return integer preference value, either from prefs branch or internal defaults
// TODO - move into utils.js
get_int_pref = function (name) {
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

// Returns a string version of an exception object with its stack trace
parse_exception = function (e) {
    log("Sixornot - parse_exception", 2);
    if (!e) {
        return "";
    } else if (!e.stack) {
        return String(e);
    } else {
        return String(e) + " \n" + e.stack;
    }
};

// Lazy getter services
defineLazyGetter = function (getterName, getterFunction) {
    // The first time this getter is requested it'll decay into the function getterFunction
    /*jslint nomen: false*/
    this.__defineGetter__(getterName, function () {
        /*jslint nomen: true*/
        // Remove stale reference to getterFunction
        delete this[getterName];
        // Produce a fresh copy of getterFunction with the correct this applied
        this[getterName] = getterFunction.apply(this);
        return this[getterName];
    });
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
dns_handler = {
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
    init : function () {
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

    set_worker_loglevel : function (newloglevel) {
        this.worker.postMessage([-1, this.reqids.loglevel, newloglevel]);
    },

    shutdown : function () {
        log("Sixornot - dns_handler:shutdown", 1);
        // Shutdown async resolver
        this.worker.postMessage([-1, this.reqids.shutdown, null]);
    },


    /*
        IP Address utility functions
    */
    validate_ip4 : function (ip_address) {
        log("Sixornot - dns_handler:validate_ip4: " + ip_address, 3);
        // TODO - Write this function if needed, extensive validation of IPv4 address
        return false;
    },

    // Quick check for address family, not a validator (see validate_ip4)
    is_ip4 : function (ip_address) {
        log("Sixornot - dns_handler:is_ip4 " + ip_address, 3);
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
    pad_ip4 : function (ip4_address) {
        var pad = function (n) {
            return ("00" + n).substr(-3);
        };
        return ip4_address.split(".").map(pad).join(".");
    },
    // Remove leading zeros from IPv4 address
    unpad_ip4 : function (ip4_address) {
        var unpad = function (n) {
            return parseInt(n, 10);
        };
        return ip4_address.split(".").map(unpad).join(".");
    },

    // Sort IPv4 addresses into logical ordering
    sort_ip4 : function (a, b) {
        var typeof_a, typeof_b;
        typeof_a = this.typeof_ip4(a);
        typeof_b = this.typeof_ip4(b);
        // addresses of different types have a distinct precedence order
        // global, rfc1918, [other]
        if (typeof_a === typeof_b) {
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

    typeof_ip4 : function (ip_address) {
        var split_address;
        log("Sixornot - dns_handler:typeof_ip4 " + ip_address, 3);
        // TODO - Function in_subnet (network, subnetmask, ip) to check if specified IP is in the specified subnet range
        if (!dns_handler.is_ip4(ip_address)) {
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

    test_is_ip6 : function () {
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
        for (i = 0; i < tests.length; i += 1) {
            result = this.is_ip6(tests[i][0]);
            if (result === tests[i][1]) {
                log("Sixornot - test_is_ip6, passed test value: " + tests[i][0] + ", result: " + result);
            } else {
                log("Sixornot - test_is_ip6, failed test value: " + tests[i][0] + ", expected result: " + tests[i][1] + ", actual result: " + result);
                overall = false;
            }
        }
        return overall;
    },

    validate_ip6 : function (ip_address) {
        log("Sixornot - dns_handler:validate_ip6: " + ip_address, 3);
        // TODO - Write this function if needed, extensive validation of IPv6 address
        return false;
    },

    // Quick check for address family, not a validator (see validate_ip6)
    is_ip6 : function (ip_address) {
        log("Sixornot - dns_handler:is_ip6: " + ip_address, 3);
        return ip_address && (ip_address.indexOf(":") !== -1);
    },

    test_normalise_ip6 : function () {
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
        for (i = 0; i < tests.length; i += 1) {
            result = this.normalise_ip6(tests[i][0]);
            if (result === tests[i][1]) {
                log("Sixornot - test_normalise_ip6, passed test value: " + tests[i][0] + ", result: " + result, 1);
            } else {
                log("Sixornot - test_normalise_ip6, failed test value: " + tests[i][0] + ", expected result: " + tests[i][1] + ", actual result: " + result, 1);
                overall = false;
            }
        }
        return overall;
    },

    // Expand IPv6 address into long version
    normalise_ip6 : function (ip6_address) {
        var sides, left_parts, right_parts, middle, outarray, pad_left;
        log("Sixornot - dns_handler:normalise_ip6: " + ip6_address, 3);
        // Split by instances of ::
        sides = ip6_address.split("::");
        // Split remaining sections by instances of :
        left_parts = sides[0].split(":");
        right_parts = (sides[1] && sides[1].split(":")) || [];

        middle = ["0", "0", "0", "0", "0", "0", "0", "0"].slice(0, 8 - left_parts.length - right_parts.length);
        outarray = Array.concat(left_parts, middle, right_parts);

        // Pad each component to 4 char length with zeros to left (and convert to lowercase)
        pad_left = function (str) {
            return ("0000" + str).slice(-4);
        };

        return outarray.map(pad_left).join(":").toLowerCase();
    },

    // Unit test suite for typeof_ip6 function, returns false if a test fails
    test_typeof_ip6 : function () {
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
        for (i = 0; i < tests.length; i += 1) {
            result = this.typeof_ip6(tests[i][0]);
            if (result === tests[i][1]) {
                log("Sixornot - test_typeof_ip6, passed test value: " + tests[i][0] + ", result: " + result);
            } else {
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
    sort_ip6 : function (a, b) {
        var typeof_a, typeof_b;
        typeof_a = this.typeof_ip6(a);
        typeof_b = this.typeof_ip6(b);
        // addresses of different types have a distinct precedence order
        // global, linklocal, [other]
        if (typeof_a === typeof_b) {
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

    typeof_ip6 : function (ip_address) {
        var norm_address;
        log("Sixornot - dns_handler:typeof_ip6: " + ip_address, 3);
        // 1. Check IP version, return false if v4
        if (!dns_handler.is_ip6(ip_address)) {
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
    is_ip6_disabled : function () {
        return Services.prefs.getBoolPref("network.dns.disableIPv6");
    },


    /*
        Returns true if the domain specified is in the list of IPv4-only domains
    */
    is_ip4only_domain : function (domain) {
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
    resolve_local_async : function (callback) {
        log("Sixornot - dns_handler:resolve_local_async");
        if (this.local_ctypes) {
            // If remote resolution is happening via ctypes...
            return this.local_ctypes_async(callback);
        } else {
            // Else if using firefox methods
            return this.local_firefox_async(callback);
        }
    },

    local_ctypes_async : function (callback) {
        var new_callback_id;
        log("Sixornot - dns_handler:local_ctypes_async - selecting resolver for local host lookup", 2);
        // This uses dns_worker to do the work asynchronously

        new_callback_id = this.add_callback_id(callback);

        this.worker.postMessage([new_callback_id, this.reqids.locallookup, null]);

        return this.make_cancel_obj(new_callback_id);
    },

    // Proxy to remote_firefox_async since it does much the same thing
    local_firefox_async : function (callback) {
        log("Sixornot - dns_handler:local_firefox_async - resolving local host using Firefox builtin method", 2);
        return this.remote_firefox_async(dnsService.myHostName, callback);
    },


    /*
        Finding remote IP address(es)
    */
    // Resolve IP address(es) of a remote host using DNS
    resolve_remote_async : function (host, callback) {
        log("Sixornot - dns_handler:resolve_remote_async - host: " + host + ", callback: " + callback, 2);
        if (this.remote_ctypes) {
            // If remote resolution is happening via ctypes...
            return this.remote_ctypes_async(host, callback);
        } else {
            // Else if using firefox methods
            return this.remote_firefox_async(host, callback);
        }
    },

    remote_ctypes_async : function (host, callback) {
        var new_callback_id;
        log("Sixornot - dns_handler:remote_ctypes_async - host: " + host + ", callback: " + callback, 2);
        // This uses dns_worker to do the work asynchronously

        new_callback_id = this.add_callback_id(callback);

        this.worker.postMessage([new_callback_id, this.reqids.remotelookup, host]);

        return this.make_cancel_obj(new_callback_id);
    },

    remote_firefox_async : function (host, callback) {
        var my_callback;
        log("Sixornot - dns_handler:remote_firefox_async - host: " + host + ", callback: " + callback, 2);

        my_callback = {
            onLookupComplete : function (nsrequest, dnsresponse, nsstatus) {
                var ip_addresses;
                // Request has been cancelled - ignore
                if (nsstatus === Components.results.NS_ERROR_ABORT)
                {
                    return;
                }
                // Request has failed for some reason
                if (nsstatus !== 0 || !dnsresponse || !dnsresponse.hasMore()) {
                    if (nsstatus === Components.results.NS_ERROR_UNKNOWN_HOST) {
                        log("Sixornot - dns_handler:remote_firefox_async - resolve host failed, unknown host", 1);
                        callback(["FAIL"]);
                    } else {
                        log("Sixornot - dns_handler:remote_firefox_async - resolve host failed, status: " + nsstatus, 1);
                        callback(["FAIL"]);
                    }
                    // Address was not found in DNS for some reason
                    return;  
                }
                // Otherwise address was found
                ip_addresses = [];
                while (dnsresponse.hasMore()) {
                    ip_addresses.push(dnsresponse.getNextAddrAsString());
                }
                // Call callback for this request with ip_addresses array as argument
                callback(ip_addresses);
            }
        };
        try {
            return dnsService.asyncResolve(host, 0, my_callback, threadManager.currentThread);
        } catch (e) {
            Components.utils.reportError("Sixornot EXCEPTION: " + parse_exception(e));
            callback(["FAIL"]);
            return null;
        }
    },


    /*
        ctypes dns callback handling functions
    */
    // Index this.callback_ids and return required callback
    find_callback_by_id : function (callback_id) {
        var f;
        log("Sixornot - dns_handler:find_callback_by_id - callback_id: " + callback_id, 2);
        // Callback IDs is an array of 2-item arrays - [ID, callback]
        f = function (a) {
            return a[0];
        };
        // Returns -1 if ID not found
        return this.callback_ids.map(f).indexOf(callback_id);
    },

    // Search this.callback_ids for the ID in question, remove it if it exists
    remove_callback_id : function (callback_id) {
        var i;
        log("Sixornot - dns_handler:remove_callback_id - callback_id: " + callback_id, 2);
        i = this.find_callback_by_id(callback_id);
        if (i !== -1) {
            // Return the callback function
            return this.callback_ids.splice(i, 1)[0][1];
        }
        // If ID not found, return false
        return false;
    },

    // Add a callback to the callback_ids array with the next available ID
    add_callback_id : function (callback) {
        log("Sixornot - dns_handler:add_callback_id - callback: " + callback, 2);
        // Use next available callback ID, return that ID
        this.next_callback_id = this.next_callback_id + 1;
        this.callback_ids.push([this.next_callback_id, callback]);
        return this.next_callback_id;
    },

    make_cancel_obj : function (callback_id) {
        var obj;
        log("Sixornot - dns_handler:make_cancel_obj - callback_id: " + callback_id, 2);
        obj = {
            cancel : function () {
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
    onworkermessage : function (evt) {
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
    cancel_request : function (request) {
        log("Sixornot - dns_handler:cancel_request - request: " + request, 2);
        try {
            // This function can be called with request as a null or undefined value
            if (request) {
                request.cancel(Components.results.NS_ERROR_ABORT);
            }
        } catch (e) {
            Components.utils.reportError("Sixornot EXCEPTION: " + parse_exception(e));
        }
    },

    // Returns true if the URL is set to have its DNS lookup proxied via SOCKS
    is_proxied_dns : function (url) {
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



