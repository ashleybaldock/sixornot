/*jslint white: true, maxerr: 100, indent: 4 */

// Provided by Firefox:
/*global Components, Services */

// Provided by Sixornot
/*global prefs */

// Module imports we need
/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");

// Import preferences
Components.utils.import("resource://sixornot/includes/prefs.jsm");

/*jslint es5: false */

var EXPORTED_SYMBOLS = ["log", "parse_exception"];

// Log a message to error console, but only if it is important enough
var log = (function () {
    "use strict";
    var get_loglevel = function () {
        try {
            return prefs.get_int("loglevel");
        } catch (e) {
            // Fallback to hard-coded default (minimal logging)
            return 0;
        }
    };
    return function (message, level) {
        // Three log levels, 0 = critical, 1 = normal, 2 = verbose
        // Default level is 1
        level = level || 1;
        // If preference unset, default to 1 (normal) level
        if (level <= get_loglevel()) {
            Components.classes["@mozilla.org/consoleservice;1"]
                .getService(Components.interfaces.nsIConsoleService)
                .logStringMessage(message);
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

