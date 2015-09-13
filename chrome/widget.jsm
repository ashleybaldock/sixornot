/*
 * Copyright 2015 Timothy Baldock. All Rights Reserved.
 */

/* global log, prefs, util, getMessanger, dnsResolver, ipUtils, createPanel, unload */
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
    var panel, updateIconForNode, onClick;

    var updateGreyscale = function () {
        if (prefs.getBool("greyscaleicons")) {
            util.add_greyscale_class_to_node(node);
        } else {
            util.remove_greyscale_class_from_node(node);
        }
    };

    var messanger = getMessanger(win, function (data) { updateIconForNode(data, node); });

    var lastMainHost = "";
    var dnsCancel;
    var ipv4s = [];
    var ipv6s = [];

    // Change icon via class (icon set via stylesheet)
    updateIconForNode = function (data, node) {
        if (data.main === "") {
            // Cancel existing DNS lookup callback
            if (dnsCancel) { dnsCancel.cancel(); }
            ipv6s = [];
            ipv4s = [];
            // No matching entry for main host (probably a local file)
            util.remove_sixornot_classes_from(node);
            util.add_class_to_node("sixornot_other", node);
        } else {
            var mainHost = data.entries.find(function (element) {
                return element.host === data.main;
            });

            if (mainHost.host !== lastMainHost) {
                if (dnsCancel) { dnsCancel.cancel(); }
                ipv6s = [];
                ipv4s = [];
                if (!(mainHost.address_family === 1
                 || mainHost.proxy.type === "http"
                 || mainHost.proxy.type === "https"
                 || mainHost.proxy.proxyResolvesHost)) {
                    dnsCancel = dnsResolver.resolveRemote(mainHost.host, function (ips) {
                        dnsCancel = null;
                        if (ips[0] !== "FAIL") {
                            ipv6s = ips.filter(ipUtils.is_ip6);
                            ipv4s = ips.filter(ipUtils.is_ip4);
                        }
                        log("widget dns complete, ipv4s: [" + ipv4s + "], ipv6s: [" + ipv6s + "]", 0);
                        util.update_node_icon_for_host(node, mainHost, ipv4s, ipv6s);
                    });
                }
            }
            util.update_node_icon_for_host(node, mainHost, ipv4s, ipv6s);
        }
        /* Always update last main host */
        lastMainHost = data.main;
    };

    onClick = function () {
        panel.setAttribute("hidden", false);
        panel.openPopup(node, panel.getAttribute("position"), 0, 0, false, false);
    };

    /* Create a panel to show details when clicked */
    panel = createPanel(win, node.id + "-panel");
    node.appendChild(panel);

    /* Update greyscale property + icon */
    updateGreyscale();

    /* Add event listeners */
    node.addEventListener("click", onClick, false);
    var greyscaleObserver = prefs.createObserver("extensions.sixornot.greyscaleicons",
                                                  updateGreyscale).register();

    unload(function () {
        log("widget unload function", 2);
        greyscaleObserver.unregister();
        messanger.shutdown();
        node.removeEventListener("click", onClick, false);
        if (dnsCancel) { dnsCancel.cancel(); }
    }, win);
};
