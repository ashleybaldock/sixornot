/*
 * Copyright 2015-2016 Ashley Baldock. All Rights Reserved.
 */

/* global log */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://sixornot/content/logger.jsm");
var clipboardhelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                                .getService(Components.interfaces.nsIClipboardHelper);

/* exported util */
var EXPORTED_SYMBOLS = ["util"];

var sixornotClasses = [
    "sixornot_4only", "sixornot_4only_cache",
    "sixornot_4pot6", "sixornot_4pot6_cache",
    "sixornot_6and4", "sixornot_6and4_cache",
    "sixornot_6only", "sixornot_6only_cache",
    "sixornot_other", "sixornot_other_cache",
    "sixornot_proxy", "sixornot_error"
];

var securityClasses = [
    "sixornot_ssl",
    "sixornot_ssl_ev",
    "sixornot_ssl_partial",
    "sixornot_ssl_off"
];

var proxyClasses = [
    "sixornot_proxy_on",
    "sixornot_proxy_off"
];
var getIconClass = function (record, ips) {
    if (record.proxy.type === "http" || record.proxy.type === "https") {
        return "sixornot_proxy";
    }
    var hasIPv6DNS = ips.some(function (ip) { return ip.family === 6; });
    var hasIPv4DNS = ips.some(function (ip) { return ip.family === 4; });
    if (record.ip.family === 4) {
        if (hasIPv6DNS) {
            // Actual is v4, DNS is v4 + v6 -> Orange
            return "sixornot_4pot6";
        } else {
            // Actual is v4, DNS is v4 (or not completed) -> Red
            return "sixornot_4only";
        }
    } else if (record.ip.family === 6) {
        if (!hasIPv4DNS && hasIPv6DNS) {
            // Actual is v6, DNS is v6 -> Blue
            return "sixornot_6only";
        } else {
            // Actual is v6, DNS is v4 + v6 (or not completed) -> Green
            return "sixornot_6and4";
        }
    } else if (record.ip.family === 2) {
        // address family 2 is cached responses
        if (!hasIPv6DNS) {
            if (!hasIPv4DNS) {
                // No addresses, grey cache icon
                return "sixornot_other_cache";
            } else {
                // Only v4 addresses from DNS, red cache icon
                return "sixornot_4only_cache";
            }
        } else {
            if (!hasIPv4DNS) {
                // Only v6 addresses from DNS, blue cache icon
                return "sixornot_6only_cache";
            } else {
                // Both kinds of addresses from DNS, yellow cache icon
                return "sixornot_4pot6_cache";
            }
        }
    } else if (record.ip.family === 1) {
        return "sixornot_other";
    } else if (record.ip.family === 0) {
        // This indicates that no addresses were available but request is not cached
        return "sixornot_error";
    }
    return "sixornot_other";
};

var getSecurityClass = function (record) {
    if (record.security.isExtendedValidation) {
        return "sixornot_ssl_ev";
    } else if (record.security.cipherName) {
        return "sixornot_ssl";
    } else {
        return "sixornot_ssl_off";
    }
};

var getProxyClass = function (record) {
    if (record.proxy.type === "http"
     || record.proxy.type === "https"
     || record.proxy.type === "socks4"
     || record.proxy.type === "socks") {
        return "sixornot_proxy_on";
    } else {
        return "sixornot_proxy_off";
    }
};

var removeClassesFrom = function (node, classes) {
    classes.forEach(function (item) {
        node.classList.remove(item);
    });
};

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

    openPreferences: function () {
        var currentWindow;
        try {
            // Add tab to most recent window, regardless of where this function was called from
            currentWindow = Services.wm.getMostRecentWindow("navigator:browser");
            currentWindow.focus();
            if (currentWindow.toEM) {
                currentWindow.toEM("addons://detail/sixornot@entropy.me.uk");
            } else if (currentWindow.BrowserOpenAddonsMgr) {
                currentWindow.BrowserOpenAddonsMgr("addons://detail/sixornot@entropy.me.uk");
            }
        } catch (e) {
            Components.utils.reportError(e);
        }
    },

    openHyperlink: function (link) {
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

    copyToClipboard: function (text) {
        log("copyToClipboard: '" + text + "'", 2);
        try {
            clipboardhelper.copyString(text);
        } catch (e) {
            Components.utils.reportError(e);
        }
    },

    /* Sixornot display class related functions */
    setSixornotClass: function (node, host, ips) {
        var newClass = "sixornot_other";
        if (host) {
            newClass = getIconClass(host, ips);
        }
        if (!node.classList.contains(newClass)) {
            removeClassesFrom(node, sixornotClasses);
            node.classList.add(newClass);
        }
    },

    setSecurityClass: function (node, host) {
        var newClass = "sixornot_ssl_off";
        if (host) {
            newClass = getSecurityClass(host);
        }
        if (!node.classList.contains(newClass)) {
            removeClassesFrom(node, securityClasses);
            node.classList.add(newClass);
        }
    },

    setProxyClass: function (node, host) {
        var newClass = "sixornot_proxy_off";
        if (host) {
            newClass = getProxyClass(host);
        }
        if (!node.classList.contains(newClass)) {
            removeClassesFrom(node, proxyClasses);
            node.classList.add(newClass);
        }
    },

    enableBold: function (node) {
        node.classList.add("sixornot-bold");
    },
    disableBold: function (node) {
        node.classList.remove("sixornot-bold");
    },

    enableGreyscale: function (node) {
        node.classList.add("sixornot_grey");
    },
    disableGreyscale: function (node) {
        node.classList.remove("sixornot_grey");
    },

    setLink: function (node) {
        node.classList.add("sixornot-link");
    },
    setTitle: function (node) {
        node.classList.add("sixornot-title");
    },

    setHidden: function (node) {
        node.classList.add("sixornot-invisible");
    },
    setShowing: function (node) {
        node.classList.remove("sixornot-invisible");
    }
};

