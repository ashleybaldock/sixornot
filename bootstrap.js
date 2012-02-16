/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2008-2012 Timothy Baldock. All Rights Reserved.
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

/*jslint white: true, maxerr: 100, indent: 4 */

// Provided by Firefox:
/*global Components, Services, AddonManager */
/*global APP_STARTUP, APP_SHUTDOWN, ADDON_ENABLE, ADDON_DISABLE, ADDON_INSTALL, ADDON_UNINSTALL, ADDON_UPGRADE, ADDON_DOWNGRADE */

// Provided in included modules:
/*global unload, watchWindows, dns_handler, log, parse_exception, prefs, requests */


/*
 * Constants and global variables
 */
// Import needed code modules
/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");
/*jslint es5: false */

// Define all used globals
// Note: Due to execution as a bootstrapless addon these aren't really global
// but are within the scope of this extension

// Prefs observer object - TODO - move into function where it is used? no need to be global?
var PREF_OBSERVER;
var PREF_OBSERVER_DNS;
var HTTP_REQUEST_OBSERVER;

// Global functions
// Main functionality
var insert_code;
var startup;
var shutdown;
var install;
var uninstall;
var reload;


/*
 * Sixornot Preferences observer
 * Watches our preferences so that if the user changes them manually we update to reflect the changes
 */
PREF_OBSERVER = {
    observe: function (aSubject, aTopic, aData) {
        "use strict";
        log("Sixornot - PREF_OBSERVER - aSubject: " + aSubject + ", aTopic: " + aTopic.valueOf() + ", aData: " + aData, 2);
        if (aTopic.valueOf() !== "nsPref:changed") {
            return;
        }
        if (!prefs.defaults.hasOwnProperty(aData)) {
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

    register: function () {
        "use strict";
        Services.prefs.addObserver(prefs.sixornot_prefs, PREF_OBSERVER, false);
    },

    unregister: function () {
        "use strict";
        Services.prefs.removeObserver(prefs.sixornot_prefs, PREF_OBSERVER);
    }
};

/*
 * DNS Preferences observer
 * Watches built-in Firefox preferences which have an impact on DNS resolution.
 */
PREF_OBSERVER_DNS = {
    observe: function (aSubject, aTopic, aData) {
        "use strict";
        log("Sixornot - PREF_OBSERVER_DNS - aSubject: " + aSubject + ", aTopic: " + aTopic.valueOf() + ", aData: " + aData, 2);
        if (aTopic.valueOf() !== "nsPref:changed") {
            return;
        }

        if (aData === "disableIPv6") {
            reload();
        }
        if (aData === "ipv4OnlyDomains") {
            log("Sixornot - PREF_OBSERVER_DNS - ipv4OnlyDomains has changed", 1);
            reload();
        }
    },

    register: function () {
        "use strict";
        Services.prefs.addObserver(prefs.dns_prefs, PREF_OBSERVER_DNS, false);
    },

    unregister: function () {
        "use strict";
        Services.prefs.removeObserver(prefs.dns_prefs, PREF_OBSERVER_DNS);
    }
};


/*
 * HTTP Request observer
 * Observes all HTTP requests to determine the details of connections
 * Ignores connections which aren't related to browser windows
 */
var HTTP_REQUEST_OBSERVER = {
    observe: function (aSubject, aTopic, aData) {
        "use strict";
        var domWindow, domWindowUtils, domWindowInner,
            domWindowOuter, original_window, new_page, remoteAddress, send_event,
            create_new_entry, remoteAddressFamily, check_inner_id,
            http_channel, http_channel_internal, nC, new_entry;
        log("Sixornot - HTTP_REQUEST_OBSERVER - (" + aTopic + ")", 1);

        /*
         * Create an event of the specified type and dispatch it to the specified element
         * Return boolean indicating if the event has been cancelled
         * Event type one of:
         *  sixornot-dns-lookup-event
         *  sixornot-count-change-event
         *  sixornot-address-change-event
         *  sixornot-new-host-event
         *  sixornot-page-change-event
         */
        send_event = function (type, target, entry) {
            // Create an event to inform listeners that a new page load has started
            // We do this now since it's only now that we know the innerID of the page
            var evt = target.top.document.createEvent("CustomEvent");

            // Event's payload is basic info to allow lookup of entry from request cache
            evt.initCustomEvent(type, true, true, {
                host: entry.host,
                inner_id: entry.inner_id,
                outer_id: entry.outer_id
            });

            log("Sixornot - send_event of type: " + type + ", to target: " + target + " with payload: " + JSON.stringify(evt.detail), 2);

            // Dispatch the event
            return target.top.dispatchEvent(evt);
        };

        /* Prepare and return a new blank entry for the hosts listing */
        create_new_entry = function (host, address, address_family, inner, outer) {
            return {
                host: host,
                address: address,
                address_family: address_family,
                show_detail: true,
                count: 1,
                ipv6s: [],
                ipv4s: [],
                dns_status: "ready",
                dns_cancel: null,
                inner_id: inner,
                outer_id: outer,
                lookup_ips: function (evt_origin) {
                    var entry, on_returned_ips;
                    /* Create closure containing reference to element and trigger async lookup with callback */
                    entry = this;
                    log("Sixornot - LOOKUP_IPS", 2);
                    on_returned_ips = function (ips) {
                        log("Sixornot - LOOKUP_IPS - on_returned_ips", 2);
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
                        send_event("sixornot-dns-lookup-event", evt_origin, entry);
                    };
                    if (entry.dns_cancel) {
                        entry.dns_cancel.cancel();
                    }
                    entry.dns_cancel = dns_handler.resolve_remote_async(entry.host, on_returned_ips);
                }
            };
        };

        /* Check an inner window ID against all browser windows, return true if it matches
           Used to check for favicon loading by chrome window */
        check_inner_id = function (inner_id) {
            var enumerator, win, utils, win_inner;
            enumerator = Services.wm.getEnumerator("navigator:browser");
            while(enumerator.hasMoreElements()) {
                win = enumerator.getNext();
                utils = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                            .getInterface(Components.interfaces.nsIDOMWindowUtils);     // TODO - use of getInterface
                if (inner_id === utils.currentInnerWindowID) {
                    return true;
                }
            }
            return false;
        };

        // TODO - A copy of the initial load for each site visited is stored under innerWindow ID 2, this is a bug!

        if (aTopic === "http-on-examine-response" || aTopic === "http-on-examine-cached-response") {
            http_channel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
            http_channel_internal = aSubject.QueryInterface(Components.interfaces.nsIHttpChannelInternal);

            // Fetch DOM window associated with this request
            nC = http_channel.notificationCallbacks;
            if (!nC) {
                nC = http_channel.loadGroup.notificationCallbacks;
            }
            if (!nC) {
                // Unable to determine which window intiated this http request
                log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response: Unable to determine notificationCallbacks for this http_channel", 0);
                return;
            }

            try {
                domWindow = nC.getInterface(Components.interfaces.nsIDOMWindow).top;    // TODO - use of getInterface
                domWindowUtils = domWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                            .getInterface(Components.interfaces.nsIDOMWindowUtils); // TODO - use of getInterface
                domWindowInner = domWindowUtils.currentInnerWindowID;
                domWindowOuter = domWindowUtils.outerWindowID;

                original_window = nC.getInterface(Components.interfaces.nsIDOMWindow);  // TODO - use of getInterface
            } catch (e2) {
                // HTTP response is in response to a non-DOM source - ignore these
                log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response: non-DOM request", 2);
                return;
            }

            // Check for browser windows loading things like favicons and filter out
            if (check_inner_id(domWindowInner)) {
                log("Sixornot - HTTP_REQUEST_OBSERVER: domWindowInner: " + domWindowInner + " matches a chrome window (probably a favicon load), skipping.", 1);
                return;
            }

            // Extract address information
            if (aTopic === "http-on-examine-response") {
                try {
                    remoteAddress = http_channel_internal.remoteAddress;
                    remoteAddressFamily = remoteAddress.indexOf(":") === -1 ? 4 : 6;
                    // TODO move this code into a function executed immediately for address_family item
                } catch (e1) {
                    log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response: remoteAddress was not accessible for: " + http_channel.URI.spec, 0);
                    remoteAddress = "";
                    remoteAddressFamily = 0;
                }
            } else {
                remoteAddress = "";
                remoteAddressFamily = 2;
            }

            log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response: Processing " + http_channel.URI.host + " (" + (remoteAddress || "FROM_CACHE") + ")", 1);

            // Detect new page loads by checking if flag LOAD_INITIAL_DOCUMENT_URI is set
            log("http_channel.loadFlags: " + http_channel.loadFlags, 2);
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
                // new connections until such a time as it is, these get stored in the requests waiting list
                // which is keyed by the outer window ID
                if (!requests.waitinglist[domWindowOuter]) {
                    requests.waitinglist[domWindowOuter] = [];
                }
                if (!requests.waitinglist[domWindowOuter].some(function (item, index, items) {
                    // If element present in list update fields if required
                    if (item.host === http_channel.URI.host) {
                        item.count += 1;
                        if (item.address !== remoteAddress && remoteAddress !== "") {
                            item.address = remoteAddress;
                            item.address_family = remoteAddressFamily;
                        }
                        return true;
                    }
                })) {
                    // Create new entry + add to waiting list
                    log("Sixornot - HTTP_REQUEST_OBSERVER - New page load, adding new entry, host: " + http_channel.URI.host + ", remoteAddress: " + remoteAddress + ", ID: " + domWindowInner, 1);
                    requests.waitinglist[domWindowOuter].push(create_new_entry(http_channel.URI.host, remoteAddress, remoteAddressFamily, null, domWindowOuter));
                }

            } else {
                /* SECONDARY PAGE LOAD */
                // Not new, inner window ID will be correct by now so add entries to request cache
                if (!requests.cache[domWindowInner]) {
                    log("SN: requests.cache[" + domWindowInner + "] set to: []", 0);
                    requests.cache[domWindowInner] = [];
                }
                // If host already in list update IP address if needed
                if (!requests.cache[domWindowInner].some(function (item, index, items) {
                    if (item.host === http_channel.URI.host) {
                        item.count += 1;
                        send_event("sixornot-count-change-event", domWindow, item);

                        if (item.address !== remoteAddress && remoteAddress !== "") {
                            item.address = remoteAddress;
                            item.address_family = remoteAddressFamily;
                            send_event("sixornot-address-change-event", domWindow, item);
                        }
                        return true;
                    }
                })) {
                    // Create new entry + add to cache
                    log("Sixornot - HTTP_REQUEST_OBSERVER - Secondary load, adding new entry, host: " + http_channel.URI.host + ", remoteAddress: " + remoteAddress + ", ID: " + domWindowInner, 1);
                    new_entry = create_new_entry(http_channel.URI.host, remoteAddress, remoteAddressFamily, domWindowInner, domWindowOuter);
                    // Add to cache
                    requests.cache[domWindowInner].push(new_entry);
                    // Secondary pages shouldn't have full info shown in panel
                    new_entry.show_detail = false;
                    // Trigger new DNS lookup for the new host entry
                    new_entry.lookup_ips(domWindow);
                    // Finally send event to signal new entry
                    send_event("sixornot-new-host-event", domWindow, new_entry);
                }
            }

        } else if (aTopic === "content-document-global-created") {
            // This signals that the document has been created, initial load completed
            // This is where entries on the requests waiting list get moved to the request cache
            domWindow = aSubject;
            domWindowUtils = domWindow.top.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);   // TODO - use of getInterface
            domWindowInner = domWindowUtils.currentInnerWindowID;
            domWindowOuter = domWindowUtils.outerWindowID;

            log("Sixornot - HTTP_REQUEST_OBSERVER - content-document-global-created: Inner Window ID: " + domWindowInner + ", Outer Window ID: " + domWindowOuter + ", Location: " + domWindow.location, 1);

            if (!requests.waitinglist[domWindowOuter]) {
                log("requests.waitinglist[domWindowOuter] is null (this is normal)", 2);
                return;
            }

            if (requests.cache[domWindowInner]) {
                throw "Sixornot = HTTP_REQUEST_OBSERVER - content-document-global-created: requests.cache already contains content entries.";
            }

            // Move item(s) from waiting list to cache
            // Replace spliced item with empty array, to keep waitinglist array indexes correct!
            requests.cache[domWindowInner] = requests.waitinglist.splice(domWindowOuter, 1, [])[0];

            // For each member of the new cache set inner ID and trigger a dns lookup
            requests.cache[domWindowInner].forEach(function (item, index, items) {
                item.inner_id = domWindowInner;
                item.lookup_ips(domWindow);
                send_event("sixornot-page-change-event", domWindow, item);
            });

            // Create an event to inform listeners that a new page load has started
            // We do this now since it's only now that we know the innerID of the page
            // Uses first element of the set, since the method triggered by this event builds all the members

        } else if (aTopic === "inner-window-destroyed") {
            domWindowInner = aSubject.QueryInterface(Components.interfaces.nsISupportsPRUint64).data;
            // Remove elements for this window and ensure DNS lookups are all cancelled
            log("Sixornot - HTTP_REQUEST_OBSERVER - inner-window-destroyed: " + domWindowInner, 2);
            if (requests.cache[domWindowInner]) {
                log("Sixornot - removing " + requests.cache[domWindowInner].length + " items for inner window: " + domWindowInner, 1);
                requests.cache[domWindowInner].forEach(function (item, index, items) {
                    if (item.dns_cancel) {
                        log("Cancelling DNS for item: " + item.host, 1);
                        item.dns_cancel.cancel();
                    }
                });

                delete requests.cache[domWindowInner];
            }

        } else if (aTopic === "outer-window-destroyed") {
            domWindowOuter = aSubject.QueryInterface(Components.interfaces.nsISupportsPRUint64).data;
            log("Sixornot - HTTP_REQUEST_OBSERVER - outer-window-destroyed: " + domWindowOuter, 1);
            // Remove elements for this window and ensure DNS lookups are all cancelled
            if (requests.waitinglist[domWindowOuter]) {
                log("Sixornot - removing " + requests.waitinglist[domWindowOuter].length + " items for outer window: " + domWindowOuter, 1);

                requests.waitinglist[domWindowOuter].forEach(function (item, index, items) {
                    // DNS lookup should not be triggered until the item has been moved from waitinglist to cache
                    // But do this anyway, just to be sure
                    if (item.dns_cancel) {
                        log("Cancelling DNS for item: " + item.host, 1);
                        item.dns_cancel.cancel();
                    }
                });

                delete requests.waitinglist[domWindowOuter];
            }
        }
    },

    observer_service: Components.classes["@mozilla.org/observer-service;1"]
                         .getService(Components.interfaces.nsIObserverService),

    register: function () {
        "use strict";
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
 * Resource alias management (for resource:// URLs)
 */
var setup_resource = function (aData) {
    "use strict";
    var resource, alias;
    // Set up resource URI alias
    resource = Services.io.getProtocolHandler("resource")
                .QueryInterface(Components.interfaces.nsIResProtocolHandler);

    alias = Services.io.newFileURI(aData.installPath);

    if (!aData.installPath.isDirectory()) {
        alias = Services.io.newURI("jar:" + alias.spec + "!/", null, null);
    }

    // This triggers a warning on AMO validation
    // The resource substitution is cleaned up by the addon's shutdown/uninstall methods
    // Search for cleanup_resource()
    resource.setSubstitution("sixornot", alias);
};

var cleanup_resource = function () {
    "use strict";
    var resource = Services.io.getProtocolHandler("resource")
                .QueryInterface(Components.interfaces.nsIResProtocolHandler);
    resource.setSubstitution("sixornot", null);
};



/*
 * bootstrap.js API
 */
/* APP_STARTUP, ADDON_ENABLE, ADDON_INSTALL, ADDON_UPGRADE, or ADDON_DOWNGRADE */
startup = function (aData, aReason) {
    "use strict";
    // Set up sixornot resource alias
    setup_resource(aData);

    // Import logging module (adds global symbols: log, parse_exception)
    /*jslint es5: true */
    Components.utils.import("resource://sixornot/includes/logger.jsm");
    // Import prefs module (adds global: symbol prefs)
    Components.utils.import("resource://sixornot/includes/prefs.jsm");
    // Import dns module (adds global symbol: dns_handler)
    Components.utils.import("resource://sixornot/includes/dns.jsm");
    /*jslint es5: false */

    // Init dns_handler
    dns_handler.init();

    /*jslint es5: true */
    // Import windowwatcher module (adds global symbols: watchWindows, unload)
    Components.utils.import("resource://sixornot/includes/windowwatcher.jsm");
    // Import request cache module (adds global symbol: requests)
    Components.utils.import("resource://sixornot/includes/requestcache.jsm");
    // Import gui module (adds global symbol: insert_code)
    Components.utils.import("resource://sixornot/includes/gui.jsm");
    /*jslint es5: false */

    // Load callback for when our addon finishes loading
    AddonManager.getAddonByID(aData.id, function (addon, data) {
        // Run dns_handler tests
        // Only run these if debug level is set to 2 or higher
        if (prefs.get_int("loglevel") >= 2) {
            dns_handler.test_normalise_ip6();
            dns_handler.test_typeof_ip6();
            dns_handler.test_is_ip6();
        }

        // Load into existing windows and set callback to load into any new ones too
        watchWindows(insert_code);

        // The observers actually trigger events in the UI, nothing happens until they are registered
        PREF_OBSERVER.register();
        PREF_OBSERVER_DNS.register();
        HTTP_REQUEST_OBSERVER.register();
    });
};

/* Reload addon in all windows, e.g. when preferences change */
reload = function () {
    "use strict";
    log("Sixornot - reload", 1);
    unload();
    watchWindows(insert_code);
};

/* APP_SHUTDOWN, ADDON_DISABLE, ADDON_UNINSTALL, ADDON_UPGRADE, or ADDON_DOWNGRADE */
shutdown = function (aData, aReason) {
    "use strict";
    if (aReason !== APP_SHUTDOWN) {
        // Unload all UI via init-time unload() callbacks
        unload();

        HTTP_REQUEST_OBSERVER.unregister();
        PREF_OBSERVER_DNS.unregister();
        PREF_OBSERVER.unregister();

        // Unload our own code modules
        Components.utils.unload("resource://sixornot/includes/gui.jsm");
        Components.utils.unload("resource://sixornot/includes/requestcache.jsm");
        Components.utils.unload("resource://sixornot/includes/windowwatcher.jsm");
        // Shutdown dns_handler
        dns_handler.shutdown();
        Components.utils.unload("resource://sixornot/includes/dns.jsm");
        Components.utils.unload("resource://sixornot/includes/prefs.jsm");
        Components.utils.unload("resource://sixornot/includes/logger.jsm");

        // Remove resource alias
        cleanup_resource();
    }
};

/* ADDON_INSTALL, ADDON_UPGRADE, or ADDON_DOWNGRADE */
install = function (aData, aReason) {
    "use strict";
    // Set up sixornot resource alias
    setup_resource(aData);

    // Import logging module (adds global symbols log, parse_exception)
    /*jslint es5: true */
    Components.utils.import("resource://sixornot/includes/logger.jsm");
    /*jslint es5: false */

    // Import prefs module (adds global symbol prefs)
    /*jslint es5: true */
    Components.utils.import("resource://sixornot/includes/prefs.jsm");
    /*jslint es5: false */

    prefs.create();
};

/* ADDON_UNINSTALL, ADDON_UPGRADE, or ADDON_DOWNGRADE */
uninstall = function (aData, aReason) {
    "use strict";

    // If uninstalling, remove our preferences
    if (aReason === ADDON_UNINSTALL) {
        Services.prefs.getBranch("extensions.sixornot").deleteBranch("");
    }

    // Remove resource alias
    cleanup_resource();
};

