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

    // Change icon via class (icon set via stylesheet)
    updateIconForNode = function (data, node) {
        if (data.main === "") {
            // No matching entry for main host (probably a local file)
            remove_sixornot_classes_from(node);
            add_class_to_node("sixornot_other", node);
        } else {
            var mainHost = data.entries.find(function (element, index, array) {
                return element.host === data.main;
            });
            //log("mainHost: " + JSON.stringify(mainHost), 1);
            update_node_icon_for_host(node, mainHost);
        }
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
