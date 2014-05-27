/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2014 Timothy Baldock. All Rights Reserved.
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
/*global log, parse_exception, windowWatcher, unload */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/windowwatcher.jsm");
Components.utils.import("resource://sixornot/includes/env.jsm");

// Module globals
var EXPORTED_SYMBOLS = ["stylesheet"];

var stylesheet = {
    sheets: {
        base: Services.io.newURI("resource://sixornot/css/base.css", null, null),
        large: Services.io.newURI("resource://sixornot/css/large.css", null, null),
        customize: Services.io.newURI("resource://sixornot/css/customize.css", null, null),
        customize_ffp29: Services.io.newURI("resource://sixornot/css/customize_pre29.css", null, null),
        customize_ffp29_linux: Services.io.newURI("resource://sixornot/css/customize_pre29_linux.css", null, null)
    },
    get_customize_sheet_for_platform: function () {
        if (env.application() === "firefox") {
            if (env.os() === "Linux") {
                return stylesheet.sheets.customize_ffp29_linux;
            }
            return stylesheet.sheets.customize_ffp29;
        }
        return stylesheet.sheets.customize;
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

        Services.ww.registerNotification(on_new_window);

        // Make sure to stop watching for windows if we're unloading
        unload(function () {
            Services.ww.unregisterNotification(on_new_window);
        });
    }
};
