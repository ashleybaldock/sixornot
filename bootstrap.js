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
            log("Sixornot - PREF_OBSERVER - not a pref change event 1", 2);
            return;
        }
        if (!prefs.defaults.hasOwnProperty(aData)) {
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
        log("Sixornot - PREF_OBSERVER - register", 2);
        prefs.PREF_BRANCH_SIXORNOT.QueryInterface(Components.interfaces.nsIPrefBranch2)
            .addObserver("", PREF_OBSERVER, false);
    },

    unregister: function () {
        "use strict";
        log("Sixornot - PREF_OBSERVER - unregister", 2);
        prefs.PREF_BRANCH_SIXORNOT.QueryInterface(Components.interfaces.nsIPrefBranch2)
            .removeObserver("", PREF_OBSERVER);
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

    register: function () {
        "use strict";
        log("Sixornot - PREF_OBSERVER_DNS - register", 2);
        prefs.PREF_BRANCH_DNS.QueryInterface(Components.interfaces.nsIPrefBranch2)
            .addObserver("", PREF_OBSERVER_DNS, false);
    },

    unregister: function () {
        "use strict";
        log("Sixornot - PREF_OBSERVER_DNS - unregister", 2);
        prefs.PREF_BRANCH_DNS.QueryInterface(Components.interfaces.nsIPrefBranch2)
            .removeObserver("", PREF_OBSERVER_DNS);
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
            create_new_entry, remoteAddressFamily,
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
        create_new_entry = function (host, address, address_family, origin, inner, outer) {
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
                origin: origin,
                inner_id: inner,
                outer_id: outer,
                lookup_ips: function () {
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
                            log("Sixornot - HTTP_REQUEST_OBSERVER - New page load, updated IP address for entry: " + remoteAddress + ", ID: " + domWindowOuter, 1);
                            item.address = remoteAddress;
                            item.address_family = remoteAddressFamily;
                        }
                        return true;
                    }
                })) {
                    // Create new entry + add to waiting list
                    log("Sixornot - HTTP_REQUEST_OBSERVER - New page load, adding new entry: " + remoteAddress + ", ID: " + domWindowOuter, 1);
                    requests.waitinglist[domWindowOuter].push(create_new_entry(http_channel.URI.host, remoteAddress, remoteAddressFamily, domWindow, null, domWindowOuter));
                }

            } else {
                /* SECONDARY PAGE LOAD */
                // Not new, inner window ID will be correct by now so add entries to request cache
                if (!requests.cache[domWindowInner]) {
                    requests.cache[domWindowInner] = [];
                }
                // If host already in list update IP address if needed
                if (!requests.cache[domWindowInner].some(function (item, index, items) {
                    if (item.host === http_channel.URI.host) {
                        item.count += 1;
                        send_event("sixornot-count-change-event", domWindow, item);

                        if (item.address !== remoteAddress && remoteAddress !== "") {
                            log("Sixornot - HTTP_REQUEST_OBSERVER - Secondary load, updated IP address for entry: " + remoteAddress + ", ID: " + domWindowInner, 1);
                            item.address = remoteAddress;
                            item.address_family = remoteAddressFamily;
                            send_event("sixornot-address-change-event", domWindow, item);
                        }
                        return true;
                    }
                })) {
                    // Create new entry + add to cache
                    log("Sixornot - HTTP_REQUEST_OBSERVER - Secondary load, adding new entry: remoteAddress: " + remoteAddress + ", ID: " + domWindowInner, 1);
                    new_entry = create_new_entry(http_channel.URI.host, remoteAddress, remoteAddressFamily, domWindow, domWindowInner, domWindowOuter);
                    // Add to cache
                    requests.cache[domWindowInner].push(new_entry);
                    // Secondary pages shouldn't have full info shown in panel
                    new_entry.show_detail = false;
                    // Trigger new DNS lookup for the new host entry
                    new_entry.lookup_ips();
                    // Finally send event to signal new entry
                    send_event("sixornot-new-host-event", domWindow, new_entry);
                }
            }

        } else if (aTopic === "content-document-global-created") {
            // This signals that the document has been created, initial load completed
            // This is where entries on the requests waiting list get moved to the request cache
            domWindow = aSubject;
            domWindowUtils = domWindow.top.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);
            domWindowInner = domWindowUtils.currentInnerWindowID;
            domWindowOuter = domWindowUtils.outerWindowID;

            log("Sixornot - HTTP_REQUEST_OBSERVER - content-document-global-created: Inner Window ID: " + domWindowInner + ", Outer Window ID: " + domWindowOuter + ", Location: " + domWindow.location, 1);

            if (!requests.waitinglist[domWindowOuter]) {
                log("requests.waitinglist[domWindowOuter] is null (this is normal)", 1);
                return;
            }

            if (requests.cache[domWindowInner]) {
                throw "Sixornot = HTTP_REQUEST_OBSERVER - content-document-global-created: requests.cache already contains content entries.";
            }

            // Move item(s) from waiting list to cache
            requests.cache[domWindowInner] = requests.waitinglist.splice(domWindowOuter, 1)[0];

            // For each member of the new cache set inner ID and trigger a dns lookup
            requests.cache[domWindowInner].forEach(function (item, index, items) {
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
            if (requests.cache[domWindowInner]) {
                log("Sixornot - HTTP_REQUEST_OBSERVER - inner-window-destroyed: " + domWindowInner + " - removing all items for this inner window...", 1);
                if (requests.cache[domWindowInner].dns_cancel) {
                    log("Cancelling DNS..." + typeof requests.cache[domWindowInner].dns_cancel, 1);
                    requests.cache[domWindowInner].dns_cancel.cancel();
                }
                requests.cache[domWindowInner] = undefined;
                /* requests.cache.splice(domWindowInner, 1)[0].forEach(function (item, index, items) {
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
            if (requests.waitinglist[domWindowOuter]) {
                log("Sixornot - HTTP_REQUEST_OBSERVER - outer-window-destroyed: " + domWindowOuter + " - removing all items for this outer window...", 1);
                requests.waitinglist.splice(domWindowOuter, 1)[0].forEach(function (item, index, items) {
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
 * Resource alias management (for resource:// URLs)
 */
var setup_resource = function (aData) {
    "use strict";
    var resource, alias;
    // Set up resource URI alias
    resource = Services.io.getProtocolHandler("resource")
                .QueryInterface(Components.interfaces.nsIResProtocolHandler);

    alias = Services.io.newFileURI(aData.installPath);
    //log("Install path is: " + aData.resourceURI.spec);

    if (!aData.installPath.isDirectory()) {
        alias = Services.io.newURI("jar:" + alias.spec + "!/", null, null);
        //log("Install path is: " + alias.spec);
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
    /*jslint es5: false */
    log("Imported: \"resource://sixornot/includes/logger.jsm\"", 1);

    // Import prefs module (adds global: symbol prefs)
    /*jslint es5: true */
    Components.utils.import("resource://sixornot/includes/prefs.jsm");
    /*jslint es5: false */
    log("Imported: \"resource://sixornot/includes/prefs.jsm\"", 1);

    log("Sixornot - startup - reason: " + aReason, 0);

    // Import dns module (adds global symbol: dns_handler)
    /*jslint es5: true */
    Components.utils.import("resource://sixornot/includes/dns.jsm");
    /*jslint es5: false */
    // Init dns_handler
    dns_handler.init();
    log("Imported: \"resource://sixornot/includes/dns.jsm\"", 1);

    // Import windowwatcher module (adds global symbols: watchWindows, unload)
    /*jslint es5: true */
    Components.utils.import("resource://sixornot/includes/windowwatcher.jsm");
    /*jslint es5: false */
    log("Imported: \"resource://sixornot/includes/windowwatcher.jsm\"", 1);

    // Import request cache module (adds global symbol: requests)
    /*jslint es5: true */
    Components.utils.import("resource://sixornot/includes/requestcache.jsm");
    /*jslint es5: false */
    log("Imported: \"resource://sixornot/includes/requestcache.jsm\"", 1);

    // Import gui module (adds global symbol: insert_code)
    /*jslint es5: true */
    Components.utils.import("resource://sixornot/includes/gui.jsm");
    /*jslint es5: false */
    log("Imported: \"resource://sixornot/includes/gui.jsm\"", 1);

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
        log("Sixornot - startup - loading into windows...", 2);
        watchWindows(insert_code);

        // The observers actually trigger events in the UI, nothing happens until they are registered
        log("Sixornot - startup - setting up prefs observer...", 2);
        PREF_OBSERVER.register();

        log("Sixornot - startup - setting up dns prefs observer...", 2);
        PREF_OBSERVER_DNS.register();

        log("Sixornot - startup - setting up http observer...", 2);
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
    log("Sixornot - shutdown - reason: " + aReason, 0);

    if (aReason !== APP_SHUTDOWN) {
        // Unload all UI via init-time unload() callbacks
        unload();

        log("Sixornot - shutdown - removing http observer...", 2);
        HTTP_REQUEST_OBSERVER.unregister();

        log("Sixornot - shutdown - removing dns prefs observer...", 2);
        PREF_OBSERVER_DNS.unregister();

        log("Sixornot - shutdown - removing prefs observer...", 2);
        PREF_OBSERVER.unregister();

        // Unload our own code modules
        Components.utils.unload("resource://sixornot/includes/gui.jsm");
        log("Unloaded: \"resource://sixornot/includes/gui.jsm\"", 1);

        Components.utils.unload("resource://sixornot/includes/requestcache.jsm");
        log("Unloaded: \"resource://sixornot/includes/requestcache.jsm\"", 1);

        Components.utils.unload("resource://sixornot/includes/windowwatcher.jsm");
        log("Unloaded: \"resource://sixornot/includes/windowwatcher.jsm\"", 1);

        // Shutdown dns_handler
        dns_handler.shutdown();
        Components.utils.unload("resource://sixornot/includes/dns.jsm");
        log("Unloaded: \"resource://sixornot/includes/dns.jsm\"", 1);

        Components.utils.unload("resource://sixornot/includes/prefs.jsm");
        log("Unloaded: \"resource://sixornot/includes/prefs.jsm\"", 1);

        Components.utils.unload("resource://sixornot/includes/logger.jsm");
        log("Unloaded: \"resource://sixornot/includes/logger.jsm\"", 1);

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
    log("Importing: \"resource://sixornot/includes/prefs.jsm\"", 1);
    /*jslint es5: true */
    Components.utils.import("resource://sixornot/includes/prefs.jsm");
    /*jslint es5: false */

    log("Sixornot - install - reason: " + aReason, 0);

    prefs.create();
};

/* ADDON_UNINSTALL, ADDON_UPGRADE, or ADDON_DOWNGRADE */
uninstall = function (aData, aReason) {
    "use strict";
    log("Sixornot - uninstall - reason: " + aReason, 0);

    // If uninstalling, remove our preferences
    if (aReason === ADDON_UNINSTALL) {
        prefs.remove();
    }

    // Remove resource alias
    cleanup_resource();
};

