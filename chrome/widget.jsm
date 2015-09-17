/*
 * Copyright 2015 Timothy Baldock. All Rights Reserved.
 */

/* global log, prefs, util, getMessanger, dnsResolver, createPanel, unload */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://sixornot/content/logger.jsm");
Components.utils.import("chrome://sixornot/content/utility.jsm");
Components.utils.import("chrome://sixornot/content/prefs.jsm");
Components.utils.import("chrome://sixornot/content/windowwatcher.jsm");
Components.utils.import("chrome://sixornot/content/panel.jsm");
Components.utils.import("chrome://sixornot/content/messanger.jsm");
Components.utils.import("chrome://sixornot/content/dns.jsm");

/* exported createWidget */
var EXPORTED_SYMBOLS = ["createWidget"];

/* Contains shared code used by both the address bar icon and button */
var createWidget = function (node, win) {
    "use strict";
    var updateGreyscale = function () {
        if (prefs.getBool("greyscaleicons")) {
            util.add_greyscale_class_to_node(node);
        } else {
            util.remove_greyscale_class_from_node(node);
        }
    };

    var lastMainHost = "";
    var dnsCancel;
    var ips = [];

    // Change icon via class (icon set via stylesheet)
    var updateIconForNode = function (data, node) {
        if (data.main === "") {
            // Cancel existing DNS lookup callback
            if (dnsCancel) { dnsCancel.cancel(); }
            ips = [];
            // No matching entry for main host (probably a local file)
            util.remove_sixornot_classes_from(node);
            util.add_class_to_node("sixornot_other", node);
        } else {
            var mainHost = data.entries.find(function (element) {
                return element.host === data.main;
            });

            if (mainHost.host !== lastMainHost) {
                if (dnsCancel) { dnsCancel.cancel(); }
                ips = [];
                if (!(mainHost.ip.family === 1
                 || mainHost.proxy.type === "http"
                 || mainHost.proxy.type === "https"
                 || mainHost.proxy.proxyResolvesHost)) {
                    dnsCancel = dnsResolver.resolveRemote(mainHost.host, function (results) {
                        dnsCancel = null;
                        if (results.success) {
                            ips = results.addresses;
                        } else {
                            ips = [];
                        }
                        log("widget dns complete callback, ips: " + ips, 1);
                        util.update_node_icon_for_host(node, mainHost, ips);
                    });
                }
            }
            util.update_node_icon_for_host(node, mainHost, ips);
        }
        /* Always update last main host */
        lastMainHost = data.main;
    };

    var onClick = function () {
        panel.setAttribute("hidden", false);
        panel.openPopup(node, panel.getAttribute("position"), 0, 0, false, false);
    };

    /* Create a panel to show details when clicked */
    var panel = createPanel(win, node.id + "-panel");
    node.appendChild(panel);

    /* Update greyscale property + icon */
    updateGreyscale();

    /* Add event listeners */
    node.addEventListener("click", onClick, false);
    var greyscaleObserver = prefs.createObserver("extensions.sixornot.greyscaleicons",
                                                  updateGreyscale).register();
    var messanger = getMessanger(win, function (data) { updateIconForNode(data, node); });

    unload(function () {
        log("widget unload function", 2);
        greyscaleObserver.unregister();
        messanger.shutdown();
        node.removeEventListener("click", onClick, false);
        if (dnsCancel) { dnsCancel.cancel(); }
    }, win);
};
