/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2008-2015 Timothy Baldock. All Rights Reserved.
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

