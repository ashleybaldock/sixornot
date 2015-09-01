/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2015 Timothy Baldock. All Rights Reserved.
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

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");

var EXPORTED_SYMBOLS = [
    "gbi",
    "open_preferences",
    "open_hyperlink",
    "copy_to_clipboard",
    "remove_sixornot_classes_from",
    "add_class_to_node",
    "update_node_icon_for_host",
    "add_greyscale_class_to_node",
    "remove_greyscale_class_from_node",
    "remove_ssl_classes_from_node",
];

/* Proxy to getElementById */
var gbi = function (node, child_id) {
    "use strict";
    if (node.getElementById) {
        return node.getElementById(child_id);
    } else {
        return node.querySelector("#" + child_id);
    }
};

var open_preferences = function () {
    var currentWindow, currentBrowser, e;
    try {
        // Add tab to most recent window, regardless of where this function was called from
        currentWindow = Services.wm.getMostRecentWindow("navigator:browser");
        currentWindow.focus();
        if (currentWindow.toEM) {
            currentWindow.toEM("addons://detail/sixornot@entropy.me.uk");
        } else if (currentWindow.BrowserOpenAddonsMgr) {
            currentWindow.BrowserOpenAddonsMgr("addons://detail/sixornot@entropy.me.uk");
        } else {
            currentBrowser = currentWindow.getBrowser();
            currentBrowser.selectedTab = currentBrowser.addTab("about:addons");
        }
    } catch (e) {
        Components.utils.reportError(e);
    }
};

var open_hyperlink = function (link) {
    var currentWindow, currentBrowser, e;
    try {
        // Add tab to most recent window, regardless of where this function was called from
        currentWindow = Services.wm.getMostRecentWindow("navigator:browser");
        currentWindow.focus();
        currentBrowser = currentWindow.getBrowser();
        currentBrowser.selectedTab = currentBrowser.addTab(link);
    } catch (e) {
        Components.utils.reportError(e);
    }
};

var copy_to_clipboard = function (text) {
    var e;
    log("copy_to_clipboard: '" + text + "'", 2);
    try {
        Components.classes["@mozilla.org/widget/clipboardhelper;1"]
            .getService(Components.interfaces.nsIClipboardHelper)
            .copyString(text);
    } catch (e) {
        Components.utils.reportError(e);
    }
};

// Sixornot display class related functions

var sixornot_classes = [
    "sixornot_4only", "sixornot_4only_cache",
    "sixornot_4pot6", "sixornot_4pot6_cache",
    "sixornot_6and4", "sixornot_6and4_cache",
    "sixornot_6only", "sixornot_6only_cache",
    "sixornot_other", "sixornot_other_cache",
    "sixornot_proxy", "sixornot_error"
];

var sixornot_ssl_classes = [
    "sixornot_ssl",
    "sixornot_ssl_ev",
    "sixornot_ssl_partial",
    "sixornot_ssl_off"
];

var get_icon_class = function (record) {
    if (record.address_family === 4) {
        if (record.ipv6s.length !== 0) {
            // Actual is v4, DNS is v4 + v6 -> Orange
            return "sixornot_4pot6";
        } else {
            // Actual is v4, DNS is v4 -> Red
            return "sixornot_4only";
        }
    } else if (record.address_family === 6) {
        if (record.ipv4s.length === 0) {
            // Actual is v6, DNS is v6 -> Blue
            return "sixornot_6only";
        } else {
            // Actual is v6, DNS is v4 + v6 -> Green
            return "sixornot_6and4";
        }
    } else if (record.address_family === 2) {
        // address family 2 is cached responses
        if (record.ipv6s.length === 0) {
            if (record.ipv4s.length === 0) {
                // No addresses, grey cache icon
                return "sixornot_other_cache";
            } else {
                // Only v4 addresses from DNS, red cache icon
                return "sixornot_4only_cache";
            }
        } else {
            if (record.ipv4s.length === 0) {
                // Only v6 addresses from DNS, blue cache icon
                return "sixornot_6only_cache";
            } else {
                // Both kinds of addresses from DNS, yellow cache icon
                return "sixornot_4pot6_cache";
            }
        }
    } else if (record.address_family === 1) {
        return "sixornot_other";
    } else if (record.address_family === 0) {
        // This indicates that no addresses were available but request is not cached
        return "sixornot_error";
    }
    return "sixornot_other";
};

var remove_sixornot_classes_from = function (node) {
    sixornot_classes.forEach(function (item, index, items) {
        node.classList.remove(item);
    });
};

var add_class_to_node = function (new_item_class, node) {
    node.classList.add(new_item_class);
};

var update_node_icon_for_host = function (node, host_record) {
    var new_icon_class = get_icon_class(host_record);
    if (!node.classList.contains(new_icon_class)) {
        remove_sixornot_classes_from(node);
        add_class_to_node(new_icon_class, node);
    }
};

var add_greyscale_class_to_node = function (node) {
    node.classList.add("sixornot_grey");
};

var remove_greyscale_class_from_node = function (node) {
    node.classList.remove("sixornot_grey");
};

var remove_ssl_classes_from_node = function (node) {
    sixornot_ssl_classes.forEach(function (item, index, items) {
        node.classList.remove(item);
    });
};

