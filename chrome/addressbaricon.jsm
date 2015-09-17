/*
 * Copyright 2015 Timothy Baldock. All Rights Reserved.
 */

/* global gt, util, unload, prefs, createWidget */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://sixornot/content/utility.jsm");
Components.utils.import("chrome://sixornot/content/locale.jsm");
Components.utils.import("chrome://sixornot/content/prefs.jsm");
Components.utils.import("chrome://sixornot/content/windowwatcher.jsm");
Components.utils.import("chrome://sixornot/content/widget.jsm");

/* exported createAddressBarIcon */
var EXPORTED_SYMBOLS = ["createAddressBarIcon"];

var createAddressBarIcon = function (win, id) {
    var updateVisibility = function () {
        if (prefs.getBool("showaddressicon")) {
            icon.setAttribute("hidden", false);
        } else {
            icon.setAttribute("hidden", true);
        }
    };

    /* Create address bar icon */
    var doc = win.document;
    var icon = doc.createElement("box");
    icon.setAttribute("id", id);
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    icon.setAttribute("align", "center");
    icon.setAttribute("pack", "center");
    icon.setAttribute("tooltiptext", gt("tt_button"));
    /* Box must contain at least one child or it doesn't display */
    icon.appendChild(doc.createElement("image"));

    updateVisibility();

    /* Position the icon */
    var urlbaricons = util.gbi(doc, "urlbar-icons");
    var starbutton = util.gbi(doc, "star-button");
    /* If star icon visible, insert before it, otherwise just append to urlbaricons */
    if (!starbutton) {
        urlbaricons.appendChild(icon);
    } else {
        urlbaricons.insertBefore(icon, starbutton);
    }

    // Create Sixornot widget for this node
    createWidget(icon, win);

    var visibilityObserver = prefs.createObserver("extensions.sixornot.showaddressicon",
                                                  updateVisibility).register();

    /* Add unload callback to remove the icon */
    unload(function () {
        visibilityObserver.unregister();

        /* Remove UI */
        icon.parentNode.removeChild(icon);
    }, win);
};

