/*
 * Copyright 2015 Timothy Baldock. All Rights Reserved.
 */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/utility.jsm");
Components.utils.import("resource://sixornot/includes/locale.jsm");
Components.utils.import("resource://sixornot/includes/prefs.jsm");
Components.utils.import("resource://sixornot/includes/windowwatcher.jsm");
Components.utils.import("resource://sixornot/includes/stylesheet.jsm");
Components.utils.import("resource://sixornot/includes/widget.jsm");
Components.utils.import("resource://sixornot/includes/addressbaricon.jsm");

var EXPORTED_SYMBOLS = [ "ui" ];

const FIREFOX_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
const ADDRESSBAR_ICON_ID = "sixornot-addressbaricon";
const BUTTON_ID          = "sixornot-button";


/* Stylesheet utility functions for legacy platforms */
var legacyStylesheets = {
    large: Services.io.newURI("resource://sixornot/css/large.css", null, null),
    customize_ffp29: Services.io.newURI("resource://sixornot/css/customize_pre29.css", null, null),
    customize_ffp29_linux: Services.io.newURI("resource://sixornot/css/customize_pre29_linux.css", null, null)
};

var get_customize_sheet_for_platform = function () {
    if (Services.appinfo.ID === FIREFOX_ID) {
        if (Services.appinfo.OS === "Linux") {
            return legacyStylesheets.customize_ffp29_linux;
        }
        return legacyStylesheets.customize_ffp29;
    }
    return legacyStylesheets.customize; // SeaMonkey etc.
};

var inject_into_new_windows_with_path = function (sheet, path) {
    function on_new_window (win, topic) {
        if (topic === "domwindowopened") {
            win.addEventListener("load", function load_once () {
                win.removeEventListener("load", load_once, false);
                if (win.document.documentURI === path) {
                    stylesheet.injectIntoWindow(win, sheet);
                }
            });
        }
    };

    // Could also use chrome-document-global-created events for this
    Services.ww.registerNotification(on_new_window);

    // Make sure to stop watching for windows if we're unloading
    unload(function () {
        Services.ww.unregisterNotification(on_new_window);
    });
};


/* UI for pre-Australis platforms */
var ui = {
    /* Call once at addon startup */
    setup: function () {
        inject_into_new_windows_with_path(
            get_customize_sheet_for_platform(),
            "chrome://global/content/customizeToolbar.xul");
    },
    /* Call once for each window of the browser */
    insert: function (win) {
        // Don't insert into windows that already have UI
        if (win.document.getElementById(ADDRESSBAR_ICON_ID)) {
            log("ui.insert (legacy): skipping window - UI already exists", 1);
            return;
        }

        // Add stylesheet
        stylesheet.injectIntoWindowWithUnload(win, stylesheet.sheets.base);

        // Create address bar icon
        log("ui.insert (legacy): add addressicon", 1);
        createAddressBarIcon(win, ADDRESSBAR_ICON_ID);

        // SeaMonkey and Linux FF need large icon sets
        if (Services.appinfo.ID !== FIREFOX_ID || Services.appinfo.OS === "Linux") {
            stylesheet.injectIntoWindowWithUnload(win, legacyStylesheets.large);
        }
        var customize_sheet = get_customize_sheet_for_platform();
        var on_beforecustomization = function (evt) {
            log("on_beforecustomization", 1);
            /* On pre-Australis platforms the panel for customisation of the toolbars
             * is a different XUL document. We need to inject our CSS modifications
             * into this document each time it is loaded */
            var iframe = win.document.getElementById("customizeToolbarSheetIFrame");
            if (iframe) {
                log("found customizeToolbarSheetIFrame - adding load callback", 1);
                stylesheet.injectIntoWindow(iframe.contentWindow, customize_sheet);
            } else {
                log("failed to find customizeToolbarSheetIFrame", 1);
            }
        };
        var on_aftercustomization = function (evt) {
            log("on_aftercustomization", 1);
            var iframe = win.document.getElementById("customizeToolbarSheetIFrame");
            if (iframe) {
                log("on_aftercustomization - found customizeToolbarSheetIFrame", 1);
                stylesheet.removeFromWindow(iframe.contentWindow, customize_sheet);
            } else {
                log("on_aftercustomization - failed to find customizeToolbarSheetIFrame", 1);
            }
        };

        win.addEventListener("beforecustomization", on_beforecustomization, false);
        win.addEventListener("aftercustomization", on_aftercustomization, false);

        unload(function () {
            log("legacy toolbar unload function", 2);
            win.removeEventListener("beforecustomization", on_beforecustomization, false);
            win.removeEventListener("aftercustomization", on_aftercustomization, false);
        }, win);

        log("ui.insert (legacy): add button", 1);
        // Create legacy button (only for non-Australis browsers)
        createButton(win);
    },
    teardown: function () {
        log("ui.teardown", 1);
    }
};

/* Create button for non-Australis browsers */
var createButton = function (win) {
    var button, doc, customize_handler,
        toolbar_id, toolbar, nextitem_id, nextitem;
    doc = win.document;
    /* Create the button */
    button = doc.createElement("toolbarbutton");

    /* Iconized button setup */
    button.setAttribute("id", BUTTON_ID);
    button.setAttribute("label", gt("label"));
    button.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional");
    button.setAttribute("tooltiptext", gt("tt_button"));
    button.setAttribute("type", "menu");
    button.setAttribute("orient", "horizontal");

    /* Add button to toolbox palette, since it needs a parent */
    gbi(doc, "navigator-toolbox").palette.appendChild(button);

    /* Move to location specified in prefs
       If location is blank, then it isn't moved (stays in toolbox palette) */
    toolbar_id = prefs.get_char("toolbar");
    if (toolbar_id !== "") {
        toolbar = gbi(doc, toolbar_id);

        nextitem_id = prefs.get_char("nextitem");
        if (nextitem_id === "") {
            // Add to end of the specified bar
            toolbar.insertItem(BUTTON_ID);
        } else {
            // Add to specified position, if nextID is found
            nextitem = gbi(doc, nextitem_id);
            if (nextitem && nextitem.parentNode.id === toolbar_id) {
                toolbar.insertItem(BUTTON_ID, nextitem);
            } else {
                toolbar.insertItem(BUTTON_ID);
            }
        }
    }

    /*
    * When button location is customised store the new location in preferences
    * so we can load into the same place next time
    */
    customize_handler = function (evt) {
        var button_parent, button_nextitem, toolbar_id, nextitem_id;
        log("createButton:customize_handler", 2);
        log("----- button customise, button parent id: " + button.parentNode.id, 1);
        if (button) {
            log("----- button customise, button exists", 1);
            button_parent = button.parentNode;
            button_nextitem = button.nextSibling;
            if (button_parent && button_parent.localName === "toolbar") {
                toolbar_id = button_parent.id;
                nextitem_id = button_nextitem && button_nextitem.id;
            }
        }
        prefs.set_char("toolbar", toolbar_id || "");
        prefs.set_char("nextitem", nextitem_id || "");
    };

    /* Add event listeners */
    win.addEventListener("aftercustomization", customize_handler, false);

    // Create Sixornot widget for this node
    createWidget(button, win);

    /* Add a callback to unload to remove the button */
    unload(function () {
        log("legacy button unload", 2);

        /* Clear event handlers */
        win.removeEventListener("aftercustomization", customize_handler, false);

        /* Remove UI */
        button.parentNode.removeChild(button);
    }, win);
};

