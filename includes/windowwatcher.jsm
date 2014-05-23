/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Speak Words.
 *
 * The Initial Developer of the Original Code is The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Edward Lee <edilee@mozilla.com>
 *   Erik Vold <erikvvold@gmail.com>
 *   Timothy Baldock <tb@entropy.me.uk>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/*jslint white: true, maxerr: 100, indent: 4 */

// Provided by Firefox:
/*global Components, Services */

// Provided by Sixornot
/*global log, parse_exception */

// Module imports we need
/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");

// Import logging
Components.utils.import("resource://sixornot/includes/logger.jsm");

/*jslint es5: false */

var EXPORTED_SYMBOLS = ["watchWindows", "unload", "runOnWindows"];


var unload = (function () {
    "use strict";
    // Persistent listing of unloaders
    var unloaders = [];

    /**
     * Save callbacks to run when unloading. Optionally scope the callback to a
     * container, e.g., window. Provide a way to run all the callbacks.
     *
     * @usage unload(): Run all callbacks and release them.
     *
     * @usage unload(callback): Add a callback to run on unload.
     * @param [function] callback: 0-parameter function to call on unload.
     * @return [function]: A 0-parameter function that undoes adding the callback.
     *
     * @usage unload(callback, container) Add a scoped callback to run on unload.
     * @param [function] callback: 0-parameter function to call on unload.
     * @param [node] container: Remove the callback when this container unloads.
     * @return [function]: A 0-parameter function that undoes adding the callback.
     */
    return function (callback, container) {
        var remove_unloader, orig_callback;

        // Calling with no arguments runs all the unloader callbacks
        if (!callback) {
            unloaders.slice().forEach(function (unloader) {
                unloader();
            });
            unloaders.length = 0;
            return;
        }

        // Provide a way to remove the unloader
        remove_unloader = function () {
            var index = unloaders.indexOf(callback);
            if (index !== -1) {
                unloaders.splice(index, 1);
            }
        };

        // The callback is bound to the lifetime of the container if we have one
        if (container) {
            // Remove the unloader when the container unloads
            container.addEventListener("unload", remove_unloader, false);

            // Wrap the callback to additionally remove the unload listener
            orig_callback = callback;
            callback = function () {
                container.removeEventListener("unload", remove_unloader, false);
                orig_callback();
            };
        }

        // TODO test that this is still working properly and removes everything properly
        unloaders.push(callback);

        return remove_unloader;
    };
}());

/**
 * Waits for a browser window to finish loading before running the callback
 *
 * @usage runOnLoad(window, callback): Apply a callback to to run on a window when it loads.
 * @param [function] callback: 1-parameter function that gets a browser window.
 */
var runOnLoad = function (win, callback) {
    "use strict";
    // Listen for one load event before checking the window type
    win.addEventListener("load", function load_once () {
        win.removeEventListener("load", load_once, false);

        // Now that the window has loaded, only handle browser windows
        if (win.document.documentElement.getAttribute("windowtype") === "navigator:browser") {
            // SeaMonkey invokes load callbacks before window.gBrowser becomes available
            // This breaks the addon, so wait up to a second for it before running callback
            var count = 0;
            var gBrowserCheck = function () {
                if (win.gBrowser) {
                    log("Sixornot - WindowWatcher - gBrowser exists", 1);
                    callback(win);
                } else if (count < 10) {
                    log("Sixornot - WindowWatcher - waiting on gBrowser: " + count, 1);
                    count += 1;
                    win.setTimeout(gBrowserCheck, 100);
                } else {
                    log("Sixornot - WindowWatcher - gBrowser failed to become available in time", 0);
                }
            };
            gBrowserCheck();
        }
    }, false);
};


/**
 * Add functionality to existing browser windows
 *
 * @usage runOnWindows(callback): Apply a callback to each open browser window.
 * @param [function] callback: 1-parameter function that gets a browser window.
 */
var runOnWindows = function (callback) {
    "use strict";
    var browserWindows, browserWindow;
    // Add functionality to existing windows
    browserWindows = Services.wm.getEnumerator("navigator:browser");
    while (browserWindows.hasMoreElements()) {
        // Only run the callback immediately if the browser is completely loaded
        browserWindow = browserWindows.getNext();
        if (browserWindow.document.readyState === "complete") {
            callback(browserWindow);
        } else {
            // Wait for the window to load before continuing
            runOnLoad(browserWindow, callback);
        }
    }
};

/**
 * Apply a callback to each open and new browser windows.
 *
 * @usage watchWindows(callback): Apply a callback to each browser window.
 * @param [function] callback: 1-parameter function that gets a browser window.
 */
var watchWindows = function (callback) {
    "use strict";
    // Add functionality to existing windows
    runOnWindows(callback);

    // Watch for new browser windows opening then wait for them to load
    function windowWatcher (subject, topic) {
        if (topic === "domwindowopened") {
            runOnLoad(subject, callback);
        }
    }
    Services.ww.registerNotification(windowWatcher);

    // Make sure to stop watching for windows if we're unloading
    unload(function () {
        Services.ww.unregisterNotification(windowWatcher);
    });
};

