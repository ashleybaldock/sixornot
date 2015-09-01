/*
 * Copyright 2014-2015 Timothy Baldock. All Rights Reserved.
 */

// Provided by Firefox:
/*global Components, Services */

// Provided by Sixornot
/*global log, parse_exception, windowWatcher, unload */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/windowwatcher.jsm");

// Module globals
var EXPORTED_SYMBOLS = ["stylesheet"];

const FIREFOX_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";

var stylesheet = {
    sheets: {
        base: Services.io.newURI("resource://sixornot/css/base.css", null, null),
        large: Services.io.newURI("resource://sixornot/css/large.css", null, null),
        customize: Services.io.newURI("resource://sixornot/css/customize.css", null, null),
        customize_ffp29: Services.io.newURI("resource://sixornot/css/customize_pre29.css", null, null),
        customize_ffp29_linux: Services.io.newURI("resource://sixornot/css/customize_pre29_linux.css", null, null)
    },
    // These are only used for legacy platforms without customizableUI
    get_customize_sheet_for_platform: function () {
        if (Services.appinfo.ID === FIREFOX_ID) {
            if (Services.appinfo.OS === "Linux") {
                return stylesheet.sheets.customize_ffp29_linux;
            }
            return stylesheet.sheets.customize_ffp29;
        }
        return stylesheet.sheets.customize; // SeaMonkey etc.
    },
    inject_into_window: function (win, sheet) {
        log("Sixornot - injecting stylesheet: '" + sheet.prePath + sheet.path + "' into window: '" + win.name + "'", 2);
        win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIDOMWindowUtils).loadSheet(sheet, 1);
    },
    remove_from_window: function (win, sheet) {
        log("Sixornot - removing stylesheet: '" + sheet.prePath + sheet.path + "' from window: '" + win.name + "'", 2);
        win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIDOMWindowUtils).removeSheet(sheet, 1);
    },
    inject_into_window_with_unload: function (win, sheet) {
        stylesheet.inject_into_window(win, sheet);

        unload(function () {
            stylesheet.remove_from_window(win, sheet);
        }, win);
    },
    // Inject the specified stylesheet into all new windows with the path specified
    inject_into_new_windows_with_path: function (sheet, path) {
        function on_new_window (win, topic) {
            if (topic === "domwindowopened") {
                win.addEventListener("load", function load_once () {
                    win.removeEventListener("load", load_once, false);
                    if (win.document.documentURI === path) {
                        stylesheet.inject_into_window(win, sheet);
                    }
                });
            }
        };

        // Could also use chrome-document-global-created events for this

        Services.ww.registerNotification(on_new_window);

        // Make sure to stop watching for windows if we're unloading
        unload(function () {
            Services.ww.unregisterNotification(on_new_window);
        });
    }
};
