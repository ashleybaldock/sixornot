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

var EXPORTED_SYMBOLS = ["stylesheet"];

var stylesheet = {
    sheets: {
        base: Services.io.newURI("resource://sixornot/css/base.css", null, null),
        customize: Services.io.newURI("resource://sixornot/css/customize.css", null, null)
    },
    injectIntoWindow: function (win, sheet) {
        log("Sixornot - injecting stylesheet: '" + sheet.prePath + sheet.path + "' into window: '" + win.name + "'", 2);
        win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIDOMWindowUtils).loadSheet(sheet, 1);
    },
    removeFromWindow: function (win, sheet) {
        log("Sixornot - removing stylesheet: '" + sheet.prePath + sheet.path + "' from window: '" + win.name + "'", 2);
        win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIDOMWindowUtils).removeSheet(sheet, 1);
    },
    injectIntoWindowWithUnload: function (win, sheet) {
        stylesheet.injectIntoWindow(win, sheet);

        unload(function () {
            stylesheet.removeFromWindow(win, sheet);
        }, win);
    }
};

