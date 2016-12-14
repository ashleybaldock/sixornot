/*
 * Copyright 2014-2016 Ashley Baldock. All Rights Reserved.
 */

/*global CustomizableUI, gt, stylesheet, createAddressBarIcon, createWidget */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/CustomizableUI.jsm");
Components.utils.import("chrome://sixornot/content/locale.jsm");
Components.utils.import("chrome://sixornot/content/stylesheet.jsm");
Components.utils.import("chrome://sixornot/content/widget.jsm");
Components.utils.import("chrome://sixornot/content/addressbaricon.jsm");

/* exported ui */
var EXPORTED_SYMBOLS = ["ui"];

const ADDRESSBAR_ICON_ID = "sixornot-addressbaricon";
const BUTTON_ID          = "sixornot-button";

/* Create button widget specification for CustomizableUI */
var createButton = function () {
    return {
        id : BUTTON_ID,
        type : "button",
        defaultArea : CustomizableUI.AREA_NAVBAR,
        label : gt("label"),
        tooltiptext : gt("tt_button"),
        onCreated : function (node) {
            var win = node.ownerDocument.defaultView;
            createWidget(node, win);
        }
    };
};

var ui = {
    /* Call once at addon startup */
    setup: function () {
        CustomizableUI.createWidget(createButton());
    },
    /* Call once for each window of the browser */
    insert: function (win) {
        // Don't insert into windows that already have UI
        if (win.document.getElementById(ADDRESSBAR_ICON_ID)) {
            return;
        }

        // Add stylesheets
        stylesheet.injectIntoWindowWithUnload(win, stylesheet.sheets.base);
        stylesheet.injectIntoWindowWithUnload(win, stylesheet.sheets.customize);

        // Create address bar icon
        createAddressBarIcon(win, ADDRESSBAR_ICON_ID);
    },
    teardown: function () { // TODO replace with global unload() callback?
        CustomizableUI.destroyWidget(BUTTON_ID);
    }
};
