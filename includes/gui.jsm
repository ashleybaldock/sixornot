/*
 * Copyright 2014-2015 Timothy Baldock. All Rights Reserved.
 */

/*global CustomizableUI, gt, log, stylesheet, createAddressBarIcon, createWidget */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/CustomizableUI.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/locale.jsm");
Components.utils.import("resource://sixornot/includes/stylesheet.jsm");
Components.utils.import("resource://sixornot/includes/widget.jsm");
Components.utils.import("resource://sixornot/includes/addressbaricon.jsm");

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
            log("button UI created", 2);
            createWidget(node, win);
        }
    };
};

var ui = {
    /* Call once at addon startup */
    setup: function () {
        log("ui.setup", 1);
        CustomizableUI.createWidget(createButton());
    },
    /* Call once for each window of the browser */
    insert: function (win) {
        // Don't insert into windows that already have UI
        if (win.document.getElementById(ADDRESSBAR_ICON_ID)) {
            log("ui.insert: skipping window - UI already exists", 1);
            return;
        }

        // Add stylesheets
        stylesheet.injectIntoWindowWithUnload(win, stylesheet.sheets.base);
        stylesheet.injectIntoWindowWithUnload(win, stylesheet.sheets.customize);

        // Create address bar icon
        createAddressBarIcon(win, ADDRESSBAR_ICON_ID);
    },
    teardown: function () {
        log("ui.teardown", 1);
        CustomizableUI.destroyWidget(BUTTON_ID);
    }
};
