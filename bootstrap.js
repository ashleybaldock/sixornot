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
/*global unload, watchWindows, dns_handler, log, parse_exception, prefs, requests, insert_code, create_button, set_addressbar_icon_visibility, set_greyscale_icons */

/*
 * Constants and global variables
 */
// Import needed code modules
/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");
Components.utils.import("resource:///modules/CustomizableUI.jsm");
/*jslint es5: false */

// Addon-Global functions
var startup,
    shutdown,
    install,
    uninstall;

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
    Components.utils.import("resource://sixornot/includes/prefs.jsm");
    Components.utils.import("resource://sixornot/includes/dns.jsm");
    /*jslint es5: false */

    // Init dns_handler
    dns_handler.init();

    // Create default preferences (if they are missing)
    prefs.create();

    /*jslint es5: true */
    Components.utils.import("resource://sixornot/includes/windowwatcher.jsm");
    Components.utils.import("resource://sixornot/includes/requestcache.jsm");
    Components.utils.import("resource://sixornot/includes/requestobserver.jsm");
    Components.utils.import("resource://sixornot/includes/prefsobserver.jsm");
    Components.utils.import("resource://sixornot/includes/gui.jsm");
    /*jslint es5: false */

    // Load callback for when our addon finishes loading
    AddonManager.getAddonByID(aData.id, function (addon, data) {
        // Run dns_handler tests
        if (prefs.get_int("loglevel") >= 2) {
            dns_handler.test_normalise_ip6();
            dns_handler.test_typeof_ip6();
            dns_handler.test_is_ip6();
        }

        // Load into existing windows and set callback to load into any new ones too
        watchWindows(insert_code);

        // Create button UI using Australis method
        CustomizableUI.createWidget(create_button());

        // The observers actually trigger events in the UI, nothing happens until they are registered
        PREF_OBSERVER.register();
        PREF_OBSERVER_DNS.register();
        HTTP_REQUEST_OBSERVER.register();
    });
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
        Components.utils.unload("resource://sixornot/includes/prefsobserver.jsm");
        Components.utils.unload("resource://sixornot/includes/requestobserver.jsm");
        Components.utils.unload("resource://sixornot/includes/requestcache.jsm");
        Components.utils.unload("resource://sixornot/includes/windowwatcher.jsm");
        Components.utils.unload("resource://sixornot/includes/imagesrc.jsm");
        Components.utils.unload("resource://sixornot/includes/locale.jsm");
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
