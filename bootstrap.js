/*
 * Copyright 2008-2015 Timothy Baldock. All Rights Reserved.
 */

// Provided by Firefox:
/* global AddonManager, APP_SHUTDOWN, ADDON_UNINSTALL */

// Provided in included modules:
/* global watchWindows, ui, httpRequestObserver, unload, dnsResolver */

/* exported startup, shutdown, install, uninstall */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");
Components.utils.import("resource:///modules/CustomizableUI.jsm");

/*
 * bootstrap.js API implementation
 */
var startup = function (aData) {
    "use strict";
    Components.utils.import("chrome://sixornot/content/logger.jsm");
    Components.utils.import("chrome://sixornot/content/prefs.jsm");
    Components.utils.import("chrome://sixornot/content/dns.jsm");
    Components.utils.import("chrome://sixornot/content/windowwatcher.jsm");
    Components.utils.import("chrome://sixornot/content/requestobserver.jsm");
    Components.utils.import("chrome://sixornot/content/stylesheet.jsm");
    Components.utils.import("chrome://sixornot/content/addressbaricon.jsm");
    Components.utils.import("chrome://sixornot/content/widget.jsm");
    Components.utils.import("chrome://sixornot/content/messanger.jsm");
    Components.utils.import("chrome://sixornot/content/gui.jsm");

    /* Load callback for when our addon finishes loading */
    AddonManager.getAddonByID(aData.id, function () {
        /* Inject content script into all existing and subsequently created windows */
        Services.mm.loadFrameScript("chrome://sixornot/content/content.js", true);

        /* Load into existing windows and set callback to load into any new ones too */
        watchWindows(ui.insert);

        /* Perform once-only UI setup */
        ui.setup();

        /* Start listening to HTTP requests */
        httpRequestObserver.register();
    });
};

var shutdown = function (aData, aReason) {
    "use strict";
    if (aReason !== APP_SHUTDOWN) {
        httpRequestObserver.unregister();

        /* Stop loading our content script into new windows */
        Services.mm.removeDelayedFrameScript("chrome://sixornot/content/content.js");
        /* Disable and clean up existing content scripts (note: there isn't yet a way
         * to remove these entirely, the best we can do is clean up */
        Services.mm.broadcastAsyncMessage("sixornot@baldock.me:unload");

        /* Unload all UI via init-time unload() callbacks */
        unload();

        ui.teardown();

        /* Unload our own code modules */
        Components.utils.unload("chrome://sixornot/content/gui.jsm");
        Components.utils.unload("chrome://sixornot/content/addressbaricon.jsm");
        Components.utils.unload("chrome://sixornot/content/panel.jsm");
        Components.utils.unload("chrome://sixornot/content/widget.jsm");
        Components.utils.unload("chrome://sixornot/content/messanger.jsm");
        Components.utils.unload("chrome://sixornot/content/stylesheet.jsm");
        Components.utils.unload("chrome://sixornot/content/requestobserver.jsm");
        Components.utils.unload("chrome://sixornot/content/requestcache.jsm");
        Components.utils.unload("chrome://sixornot/content/windowwatcher.jsm");
        Components.utils.unload("chrome://sixornot/content/locale.jsm");
        Components.utils.unload("chrome://sixornot/content/utility.jsm");
        dnsResolver.shutdown();
        Components.utils.unload("chrome://sixornot/content/dns.jsm");
        Components.utils.unload("chrome://sixornot/content/ipaddress.jsm");
        Components.utils.unload("chrome://sixornot/content/prefs.jsm");
        Components.utils.unload("chrome://sixornot/content/logger.jsm");

        /* Flush bundles (see bug 719376) */
        Services.strings.flushBundles();
    }
};

var install = function () {
    "use strict";
};

var uninstall = function (aData, aReason) {
    "use strict";
    /* If uninstalling, remove our preferences */
    if (aReason === ADDON_UNINSTALL) {
        Services.prefs.getBranch("extensions.sixornot").deleteBranch("");
    }
};

