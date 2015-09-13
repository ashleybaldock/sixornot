/*
 * Copyright 2008-2015 Timothy Baldock. All Rights Reserved.
 */

/* global prefs */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://sixornot/content/prefs.jsm");

/* exported log, parse_exception */
var EXPORTED_SYMBOLS = ["log", "parse_exception"];

// Log a message to error console, but only if it is important enough
var log = (function () {
    "use strict";
    var get_loglevel = function () {
        try {
            return prefs.getInt("loglevel");
        } catch (e) {
            // Fallback to hard-coded default (minimal logging)
            return 0;
        }
    };
    return function (message, level) {
        // Three log levels, 0 = critical, 1 = normal, 2 = verbose
        // Default level is 1
        if (level === undefined) {
            level = 1;
        }
        // If preference unset, default to 1 (normal) level
        if (level <= get_loglevel()) {
            Services.console.logStringMessage("SON: " + message);
        }
    };
}());

// Returns a string version of an exception object with its stack trace
var parse_exception = function (e) {
    "use strict";
    log("Sixornot - parse_exception", 2);
    if (!e) {
        return "";
    } else if (!e.stack) {
        return String(e);
    } else {
        return String(e) + " \n" + e.stack;
    }
};

