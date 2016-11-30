/*
 * Copyright 2014-2016 Ashley Baldock. All Rights Reserved.
 */

/*global unload */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://sixornot/content/logger.jsm");
Components.utils.import("chrome://sixornot/content/windowwatcher.jsm");

/* exported stylesheet */
var EXPORTED_SYMBOLS = ["stylesheet"];

function injectIntoWindow (win, sheet) {
    win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
       .getInterface(Components.interfaces.nsIDOMWindowUtils).loadSheet(sheet, 1);
}

function removeFromWindow (win, sheet) {
    win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
       .getInterface(Components.interfaces.nsIDOMWindowUtils).removeSheet(sheet, 1);
}

var stylesheet = {
    sheets: {
        base: Services.io.newURI("chrome://sixornot/content/css/base.css", null, null),
        customize: Services.io.newURI("chrome://sixornot/content/css/customize.css", null, null)
    },
    injectIntoWindowWithUnload: function (win, sheet) {
        injectIntoWindow(win, sheet);

        unload(function () {
            removeFromWindow(win, sheet);
        }, win);
    }
};

