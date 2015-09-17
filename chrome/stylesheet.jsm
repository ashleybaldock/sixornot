/*
 * Copyright 2014-2015 Timothy Baldock. All Rights Reserved.
 */

/*global log, unload */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://sixornot/content/logger.jsm");
Components.utils.import("chrome://sixornot/content/windowwatcher.jsm");

/* exported stylesheet */
var EXPORTED_SYMBOLS = ["stylesheet"];

var stylesheet = {
    sheets: {
        base: Services.io.newURI("chrome://sixornot/content/css/base.css", null, null),
        customize: Services.io.newURI("chrome://sixornot/content/css/customize.css", null, null)
    },
    injectIntoWindow: function (win, sheet) { // TODO legacy - when we remove legacy UI, this can be a private method
        log("Sixornot - injecting stylesheet: '" + sheet.prePath + sheet.path + "' into window: '" + win.name + "'", 2);
        win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIDOMWindowUtils).loadSheet(sheet, 1);
    },
    removeFromWindow: function (win, sheet) { // TODO legacy - when we remove legacy UI, this can be a private method
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

