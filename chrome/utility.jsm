/*
 * Copyright 2015 Timothy Baldock. All Rights Reserved.
 */

/* global log */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://sixornot/content/logger.jsm");
var clipboardhelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                                .getService(Components.interfaces.nsIClipboardHelper);

/* exported util */
var EXPORTED_SYMBOLS = ["util"];

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

var util = {
    /* Proxy to getElementById */
    gbi: function (node, child_id) {
        "use strict";
        if (node.getElementById) {
            return node.getElementById(child_id);
        } else {
            return node.querySelector("#" + child_id);
        }
    },

    open_preferences: function () {
        var currentWindow, currentBrowser;
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
    },

    open_hyperlink: function (link) {
        var currentWindow, currentBrowser;
        try {
            // Add tab to most recent window, regardless of where this function was called from
            currentWindow = Services.wm.getMostRecentWindow("navigator:browser");
            currentWindow.focus();
            currentBrowser = currentWindow.getBrowser();
            currentBrowser.selectedTab = currentBrowser.addTab(link);
        } catch (e) {
            Components.utils.reportError(e);
        }
    },

    copy_to_clipboard: function (text) {
        log("copy_to_clipboard: '" + text + "'", 2);
        try {
            clipboardhelper.copyString(text);
        } catch (e) {
            Components.utils.reportError(e);
        }
    },

    // Sixornot display class related functions

    get_icon_class: function (record, ipv4s, ipv6s) {
        if (record.proxy.type === "http" || record.proxy.type === "https") {
            return "sixornot_proxy";
        }
        if (record.address_family === 4) {
            if (ipv6s.length !== 0) {
                // Actual is v4, DNS is v4 + v6 -> Orange
                return "sixornot_4pot6";
            } else {
                // Actual is v4, DNS is v4 (or not completed) -> Red
                return "sixornot_4only";
            }
        } else if (record.address_family === 6) {
            if (ipv4s.length === 0 && ipv6s.length !== 0) {
                // Actual is v6, DNS is v6 -> Blue
                return "sixornot_6only";
            } else {
                // Actual is v6, DNS is v4 + v6 (or not completed) -> Green
                return "sixornot_6and4";
            }
        } else if (record.address_family === 2) {
            // address family 2 is cached responses
            if (ipv6s.length === 0) {
                if (ipv4s.length === 0) {
                    // No addresses, grey cache icon
                    return "sixornot_other_cache";
                } else {
                    // Only v4 addresses from DNS, red cache icon
                    return "sixornot_4only_cache";
                }
            } else {
                if (ipv4s.length === 0) {
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
    },

    remove_sixornot_classes_from: function (node) {
        sixornot_classes.forEach(function (item) {
            node.classList.remove(item);
        });
    },

    add_class_to_node: function (new_item_class, node) {
        node.classList.add(new_item_class);
    },

    update_node_icon_for_host: function (node, host_record, ipv4s, ipv6s) {
        var new_icon_class = this.get_icon_class(host_record, ipv4s, ipv6s);
        if (!node.classList.contains(new_icon_class)) {
            this.remove_sixornot_classes_from(node);
            this.add_class_to_node(new_icon_class, node);
        }
    },

    add_greyscale_class_to_node: function (node) {
        node.classList.add("sixornot_grey");
    },

    remove_greyscale_class_from_node: function (node) {
        node.classList.remove("sixornot_grey");
    },

    remove_ssl_classes_from_node: function (node) {
        sixornot_ssl_classes.forEach(function (item) {
            node.classList.remove(item);
        });
    }
};
