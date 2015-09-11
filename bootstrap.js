/*
 * Copyright 2008-2015 Timothy Baldock. All Rights Reserved.
 */

// Provided by Firefox:
/*global Components, Services, AddonManager */
/*global APP_STARTUP, APP_SHUTDOWN, ADDON_ENABLE, ADDON_DISABLE, ADDON_INSTALL, ADDON_UNINSTALL, ADDON_UPGRADE, ADDON_DOWNGRADE */

// Provided in included modules:
/*global unload, watchWindows, dnsResolver, log, parse_exception, prefs, requests, insert_code, create_button */

var CustomizableUIAvailable = true, e;
/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");
try {
    Components.utils.import("resource:///modules/CustomizableUI.jsm");
} catch (e) {
    CustomizableUIAvailable = false;
}
/*jslint es5: false */

var startup,
    shutdown,
    install,
    uninstall;

/*
 * Resource alias management (for resource:// URLs)
 */
var setupResource = function (aData) {
    "use strict";
    var resource, alias;
    resource = Services.io.getProtocolHandler("resource")
                .QueryInterface(Components.interfaces.nsIResProtocolHandler);

    alias = Services.io.newFileURI(aData.installPath);

    if (!aData.installPath.isDirectory()) {
        alias = Services.io.newURI("jar:" + alias.spec + "!/", null, null);
    }

    /* This triggers a warning on AMO validation
     * The resource substitution is cleaned up by the addon's shutdown/uninstall methods
     * Search for cleanupResource() */
    resource.setSubstitution("sixornot", alias);
};

var cleanupResource = function () {
    "use strict";
    var resource = Services.io.getProtocolHandler("resource")
                .QueryInterface(Components.interfaces.nsIResProtocolHandler);
    resource.setSubstitution("sixornot", null);
};

var globalMM = Components.classes["@mozilla.org/globalmessagemanager;1"]
                         .getService(Components.interfaces.nsIMessageListenerManager);

/*
 * bootstrap.js API implementation
 */
/* APP_STARTUP, ADDON_ENABLE, ADDON_INSTALL, ADDON_UPGRADE, or ADDON_DOWNGRADE */
startup = function (aData, aReason) {
    "use strict";
    /* Set up resource://sixornot alias */
    setupResource(aData);

    /*jslint es5: true */
    Components.utils.import("resource://sixornot/includes/logger.jsm");
    Components.utils.import("resource://sixornot/includes/prefs.jsm");
    Components.utils.import("resource://sixornot/includes/dns.jsm");
    /*jslint es5: false */

    /* Init dnsResolver
     * This instance is now only used for local address resolution */
    dnsResolver.init();

    // Create default preferences (if they are missing)
    prefs.create();

    /*jslint es5: true */
    Components.utils.import("resource://sixornot/includes/windowwatcher.jsm");
    Components.utils.import("resource://sixornot/includes/requestobserver.jsm");
    Components.utils.import("resource://sixornot/includes/stylesheet.jsm");
    Components.utils.import("resource://sixornot/includes/addressbaricon.jsm");
    Components.utils.import("resource://sixornot/includes/widget.jsm");
    Components.utils.import("resource://sixornot/includes/messanger.jsm");
    if (CustomizableUIAvailable) {
        Components.utils.import("resource://sixornot/includes/gui.jsm");
    } else {
        Components.utils.import("resource://sixornot/includes/gui-legacy.jsm");
    }
    /*jslint es5: false */

    /* Load callback for when our addon finishes loading */
    AddonManager.getAddonByID(aData.id, function (addon, data) {
        if (prefs.get_int("loglevel") >= 2) {
            dnsResolver.test_normalise_ip6();
            dnsResolver.test_typeof_ip6();
            dnsResolver.test_is_ip6();
        }

        /* Inject content script into all existing and subsequently created windows */
        globalMM.loadFrameScript("resource://sixornot/includes/content.js", true);

        /* Load into existing windows and set callback to load into any new ones too */
        watchWindows(ui.insert);

        /* Perform once-only UI setup */
        ui.setup();

        /* Start listening to HTTP requests */
        httpRequestObserver.register();
    });
};

/* APP_SHUTDOWN, ADDON_DISABLE, ADDON_UNINSTALL, ADDON_UPGRADE, or ADDON_DOWNGRADE */
shutdown = function (aData, aReason) {
    "use strict";
    if (aReason !== APP_SHUTDOWN) {
        httpRequestObserver.unregister();

        /* Stop loading our content script into new windows */
        globalMM.removeDelayedFrameScript("resource://sixornot/includes/content.js");
        /* Disable and clean up existing content scripts (note: there isn't yet a way
         * to remove these entirely, the best we can do is clean up */
        globalMM.broadcastAsyncMessage("sixornot@baldock.me:unload");

        /* Unload all UI via init-time unload() callbacks */
        unload();

        ui.teardown();

        /* Unload our own code modules */
        if (CustomizableUIAvailable) {
            Components.utils.unload("resource://sixornot/includes/gui.jsm");
        } else {
            Components.utils.unload("resource://sixornot/includes/gui-legacy.jsm");
        }
        Components.utils.unload("resource://sixornot/includes/addressbaricon.jsm");
        Components.utils.unload("resource://sixornot/includes/panel.jsm");
        Components.utils.unload("resource://sixornot/includes/widget.jsm");
        Components.utils.unload("resource://sixornot/includes/messanger.jsm");
        Components.utils.unload("resource://sixornot/includes/stylesheet.jsm");
        Components.utils.unload("resource://sixornot/includes/requestobserver.jsm");
        Components.utils.unload("resource://sixornot/includes/requestcache.jsm");
        Components.utils.unload("resource://sixornot/includes/windowwatcher.jsm");
        Components.utils.unload("resource://sixornot/includes/locale.jsm");
        Components.utils.unload("resource://sixornot/includes/utility.jsm");
        dnsResolver.shutdown();
        Components.utils.unload("resource://sixornot/includes/dns.jsm");
        Components.utils.unload("resource://sixornot/includes/prefs.jsm");
        Components.utils.unload("resource://sixornot/includes/logger.jsm");

        /* Remove resource alias */
        cleanupResource();

        /* Flush bundles (see bug 719376) */
        Services.strings.flushBundles();
    }
};

/* ADDON_INSTALL, ADDON_UPGRADE, or ADDON_DOWNGRADE */
install = function (aData, aReason) {
    "use strict";
};

/* ADDON_UNINSTALL, ADDON_UPGRADE, or ADDON_DOWNGRADE */
uninstall = function (aData, aReason) {
    "use strict";

    /* If uninstalling, remove our preferences */
    if (aReason === ADDON_UNINSTALL) {
        Services.prefs.getBranch("extensions.sixornot").deleteBranch("");
    }

    /* Remove resource alias */
    cleanupResource();
};

