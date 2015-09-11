/*
 * Copyright 2015 Timothy Baldock. All Rights Reserved.
 */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/utility.jsm");
Components.utils.import("resource://sixornot/includes/locale.jsm");
Components.utils.import("resource://sixornot/includes/prefs.jsm");
Components.utils.import("resource://sixornot/includes/windowwatcher.jsm");
Components.utils.import("resource://sixornot/includes/panel.jsm");
Components.utils.import("resource://sixornot/includes/messanger.jsm");
Components.utils.import("resource://sixornot/includes/dns.jsm");

var EXPORTED_SYMBOLS = [ "createWidget" ];

// Create widget which handles shared logic between button/addressbar icon
var createWidget = function (node, win) {
    var panel, updateIconForNode,
        onClick, onContentScriptLoaded;

    var updateGreyscale = function () {
        if (prefs.get_bool("greyscaleicons")) {
            add_greyscale_class_to_node(node);
        } else {
            remove_greyscale_class_from_node(node);
        }
    };

    var messanger = getMessanger(win, function (data) { updateIconForNode(data, node); });

    var lastMainHost = "";
    var dnsCancel;

    // Change icon via class (icon set via stylesheet)
    updateIconForNode = function (data, node) {
        if (data.main === "") {
            // Cancel existing DNS lookup callback
            if (dnsCancel) { dnsCancel.cancel(); }
            // No matching entry for main host (probably a local file)
            remove_sixornot_classes_from(node);
            add_class_to_node("sixornot_other", node);
        } else {
            var mainHost = data.entries.find(function (element, index, array) {
                return element.host === data.main;
            });

            // No DNS lookup for proxied connections or local files
            if (mainHost.address_family === 1
             || mainHost.proxy.type === "http"
             || mainHost.proxy.type === "https"
             || mainHost.proxy.proxyResolvesHost) {
                if (dnsCancel) { dnsCancel.cancel(); }
                update_node_icon_for_host(node, mainHost, [], []);
            } else if (mainHost.host !== lastMainHost) {
                //  Cancel existing lookup/callback
                if (dnsCancel) { dnsCancel.cancel(); }
                update_node_icon_for_host(node, mainHost, [], []);
                //  Trigger DNS lookup
                dnsCancel = dns_handler.resolve_remote_async(mainHost.host, function (ips) {
                    var ipv4s, ipv6s;
                    dnsCancel = null;
                    if (ips[0] === "FAIL") {
                        ipv6s = [];
                        ipv4s = [];
                    } else {
                        ipv6s = ips.filter(dns_handler.is_ip6);
                        ipv4s = ips.filter(dns_handler.is_ip4);
                    }
                    log("widget dns complete callback, ipv4s: " + ipv4s + ", ipv6s:" + ipv6s, 0);
                    update_node_icon_for_host(node, mainHost, ipv4s, ipv6s);
                });
            }
        }
        // Always update last main host
        lastMainHost = data.main;
    };

    onClick = function () {
        panel.setAttribute("hidden", false);
        panel.openPopup(node, panel.getAttribute("position"), 0, 0, false, false);
    };

    /* Create a panel to show details when clicked */
    panel = createPanel(win, node.id + "-panel");
    node.appendChild(panel);

    // Update greyscale property + icon
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
    }, win);
};
