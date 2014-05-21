/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2008-2014 Timothy Baldock. All Rights Reserved.
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
Components.utils.import("resource:///modules/CustomizableUI.jsm");
/*jslint es5: false */

// Define all used globals
// Note: Due to execution as a bootstrapless addon these aren't really global
// but are within the scope of this extension

// Prefs observer object - TODO - replace with built-in, or move to module
var PREF_OBSERVER;
var PREF_OBSERVER_DNS;

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
    // Import request observer module (adds global symbol: HTTP_REQUEST_OBSERVER)
    Components.utils.import("resource://sixornot/includes/requestobserver.jsm");
    // Import gui module (adds global symbol: insert_code)
    Components.utils.import("resource://sixornot/includes/gui.jsm");
    Components.utils.import("resource://sixornot/includes/imagesrc.jsm");
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

        // Create button UI using Australis method
        CustomizableUI.createWidget({
            id : "sixornot-button", // BUTTON_ID
            type : "view",
            viewId : "sixornot-panel", // 
            defaultArea : CustomizableUI.AREA_NAVBAR,
            label : "Sixornot Button", // gt("label")
            tooltiptext : "Sixornot",  // get("buttontooltiptext")
            // Attached to all non-custom widgets; a function that will be invoked before the widget gets a DOM node constructed, passing the document in which that will happen.
            onBeforeCreated : function (aDoc) {
            },
            // Attached to all widgets; a function that will be invoked whenever the widget has a DOM node constructed, passing the constructed node as an argument.
            onCreated : function (node) {
                // TODO create closure for this stuff

                // TODO
                // This should be shared code with the address bar icon
                // Have an object/closure with the event handlers which bind to the window
                // that the node passed into the constructor method belongs to
                // (Also unload these event handlers when needed)
                // This will simply change the class of the node, which in turn
                // changes the icon - all logic about the icon is thus shared between button
                // and address bar

                log("Sixornot - button UI created");
                var win = node.ownerDocument.defaultView;
                var currentTabInnerID = 0;
                var currentTabOuterID = 0;
                // Change icon via class (icon set via stylesheet)
                var update_icon = function () {
                    // Change class of button to correct icon
                };
                var set_current_tab_ids = function () {
                };

                // Event handlers to bind
                var tabselect_handler = function (evt) {
                    log("Sixornot - onCreated:tabselect_handler fired - evt.detail: " + JSON.stringify(evt.detail) + ", currentTabOuterID: " + currentTabOuterID + ", currentTabInnerID: " + currentTabInnerID, 2);
                    set_current_tab_ids();
                    update_icon();
                };
                var pageshow_handler = function (evt) {
                    log("Sixornot - onCreated:pageshow_handler fired - evt.detail: " + JSON.stringify(evt.detail) + ", currentTabOuterID: " + currentTabOuterID + ", currentTabInnerID: " + currentTabInnerID, 2);
                    set_current_tab_ids();
                    update_icon();
                };
                var page_change_handler = function (evt) {
                    log("Sixornot - onCreated:page_change_handler fired - evt.detail: " + JSON.stringify(evt.detail) + ", currentTabOuterID: " + currentTabOuterID + ", currentTabInnerID: " + currentTabInnerID, 2);
                    set_current_tab_ids();
                    if (evt.detail.outer_id === currentTabOuterID) {
                        update_icon();
                    }
                };
                var on_dns_complete = function (evt) {
                    log("Sixornot - onCreated:on_dns_complete fired - evt.detail: " + JSON.stringify(evt.detail) + ", currentTabOuterID: " + currentTabOuterID + ", currentTabInnerID: " + currentTabInnerID, 2);
                    set_current_tab_ids();
                    if (evt.detail.outer_id === currentTabOuterID) {
                        update_icon();
                    }
                };

                win.addEventListener("sixornot-page-change-event", page_change_handler, false);
                win.addEventListener("sixornot-dns-lookup-event", on_dns_complete, false);
                win.gBrowser.tabContainer.addEventListener("TabSelect", tabselect_handler, false);
                win.gBrowser.addEventListener("pageshow", pageshow_handler, false);

                // TODO need to register unload callbacks for these events too
                set_current_tab_ids();
            },
            // Only useful for views; a function that will be invoked when a user shows your view.
            onViewShowing : function (aEvent) {
            },
            // Only useful for views; a function that will be invoked when a user hides your view.
            onViewHiding : function (aEvent) {
            }
        });

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

        CustomizableUI.destroyWidget("sixornot-button");

        HTTP_REQUEST_OBSERVER.unregister();
        PREF_OBSERVER_DNS.unregister();
        PREF_OBSERVER.unregister();

        // Unload our own code modules
        Components.utils.unload("resource://sixornot/includes/gui.jsm");
        Components.utils.unload("resource://sixornot/includes/requestobserver.jsm");
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

