/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2014-2015 Timothy Baldock. All Rights Reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * 
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * 
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * 
 * 3. The name of the author may not be used to endorse or promote products derived from this software without specific prior written permission from the author.
 * 
 * 4. Products derived from this software may not be called "SixOrNot" nor may "SixOrNot" appear in their names without specific prior written permission from the author.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. 
 * 
 * ***** END LICENSE BLOCK ***** */

/*jslint white: true, maxerr: 100, indent: 4 */

// Provided by Firefox:
/*global Components, Services, ChromeWorker */

// Provided by Sixornot
/*global gt, log, parse_exception, prefs, windowWatcher, unload, requests, stylesheet */

var CustomizableUIAvailable = true, e;
/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");
try {
    Components.utils.import("resource:///modules/CustomizableUI.jsm");
} catch (e) {
    CustomizableUIAvailable = false;
}
Components.utils.import("resource://sixornot/includes/env.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/utility.jsm");
Components.utils.import("resource://sixornot/includes/locale.jsm");
Components.utils.import("resource://sixornot/includes/prefs.jsm");
Components.utils.import("resource://sixornot/includes/requestcache.jsm");
Components.utils.import("resource://sixornot/includes/windowwatcher.jsm");
Components.utils.import("resource://sixornot/includes/stylesheet.jsm");
Components.utils.import("resource://sixornot/includes/panel.jsm");
/*jslint es5: false */

// Module globals
var EXPORTED_SYMBOLS = ["insert_code",
                        "create_button",
                        "set_addressbar_icon_visibility",
                        "set_greyscale_icons"];

// ID constants
var ADDRESSBAR_ICON_ID = "sixornot-addressbaricon";
var BUTTON_ID          = "sixornot-button";


// Create widget which handles shared logic between button/addresbar icon
var create_sixornot_widget = function (node, win) {
    var panel, current_tab_ids,
        update_icon_for_node,
        on_click, on_page_change, on_tab_select, on_tab_open,
        on_content_script_loaded, on_pageshow, on_dns_complete;


    // TODO - split all the MM stuff out into its own object

    // Called by content script of active tab
    // Message contains data to update icon/UI
    var on_update_ui_message = function (message) {
        log("gui on_update_ui_message: data: " + message.data, 2);
        update_icon_for_node(JSON.parse(message.data), node);
    };

    on_content_script_loaded = function (message) {
        log("on_content_script_loaded, id: " + message.data.id, 1);
        subscribe_to_current();
    };

    var currentBrowserMM;
    var windowMM = win.messageManager;

    /* TabOpen event gets fired with a blank <browser>, and the page gets loaded into
     * a different one. Detect initialisation of content script loaded into <browser>s
     * and ensure we are pointed at the correct one to update the UI */
    windowMM.addMessageListener("sixornot@baldock.me:content-script-loaded", on_content_script_loaded); // TODO unsubscribe on unload

    var subscribe_to_current = function () {
        subscribe_to(win.gBrowser.mCurrentBrowser);// TODO use selectedBrowser?
    };

    // TODO unsubscribe on unload
    var unsubscribe = function () {
        if (currentBrowserMM) {
            currentBrowserMM.removeMessageListener("sixornot@baldock.me:update-ui", on_update_ui_message);
        }
    };
    var subscribe_to = function (browser) {
        unsubscribe();
        currentBrowserMM = browser.messageManager;
        currentBrowserMM.addMessageListener("sixornot@baldock.me:update-ui", on_update_ui_message);
    };

    // Ask active content script to send us an update, e.g. when switching tabs
    var request_update = function () {
        currentBrowserMM.sendAsyncMessage("sixornot@baldock.me:update-ui");
    };


    // Change icon via class (icon set via stylesheet)
    update_icon_for_node = function (data, node) {
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

    on_click = function () {
        panel.setAttribute("hidden", false);
        panel.openPopup(node, panel.getAttribute("position"), 0, 0, false, false);
    };

    on_tab_select = function (evt) {
        log("widget:on_tab_select", 1);
        subscribe_to(win.gBrowser.getBrowserForTab(evt.target));
        request_update();
    };
    on_tab_open = function (evt) {
        log("widget:on_tab_open", 1);
        subscribe_to(win.gBrowser.getBrowserForTab(evt.target));
        request_update();
    };

    on_pageshow = function (evt) {
        log("widget:on_pageshow", 1);
        subscribe_to_current();
        request_update();
    };

    /* Create a panel to show details when clicked */
    panel = create_panel(win, node.id + "-panel");
    node.appendChild(panel);

    // Update greyscale property + icon
    if (prefs.get_bool("greyscaleicons")) {
        add_greyscale_class_to_node(node);
    } else {
        remove_greyscale_class_from_node(node);
    }

    // Ensure tab ID is set upon loading into window
    subscribe_to_current();
    request_update();

    /* Add event listeners */
    node.addEventListener("click", on_click, false);
    win.gBrowser.tabContainer.addEventListener("TabOpen", on_tab_open, false);
    win.gBrowser.tabContainer.addEventListener("TabSelect", on_tab_select, false);
    win.gBrowser.addEventListener("pageshow", on_pageshow, false);
    win.gBrowser.addEventListener("pageshow", on_pageshow, false);

    unload(function () {
        log("widget unload function", 2);
        /* Clear messageManager subscriptions */
        windowMM.removeMessageListener("sixornot@baldock.me:content-script-loaded", on_content_script_loaded);
        unsubscribe();
        /* Clear event handlers */
        node.removeEventListener("click", on_click, false);
        win.gBrowser.tabContainer.removeEventListener("TabOpen", on_tab_open, false);
        win.gBrowser.tabContainer.removeEventListener("TabSelect", on_tab_select, false);
        win.gBrowser.removeEventListener("pageshow", on_pageshow, false);
    }, win);
};

/* Create button for non-Australis browsers */
var create_legacy_button = function (win) {
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
        log("insert_code:create_button:customize_handler", 2);
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
    create_sixornot_widget(button, win);

    /* Add a callback to unload to remove the button */
    unload(function () {
        log("legacy button unload", 2);

        /* Clear event handlers */
        win.removeEventListener("aftercustomization", customize_handler, false);

        /* Remove UI */
        button.parentNode.removeChild(button);
    }, win);
};

/* Create button widget specification for CustomizableUI */
var create_button = function () {
    return {
        id : BUTTON_ID,
        type : "button",
        defaultArea : CustomizableUI.AREA_NAVBAR,
        label : gt("label"),
        tooltiptext : gt("tt_button"),
        onCreated : function (node) {
            var win = node.ownerDocument.defaultView;
            log("button UI created", 2);

            // Create Sixornot widget for this node
            create_sixornot_widget(node, win);
        }
    };
};

/* Create address bar icon (all browsers) */
var create_addressbaricon = function (win) {
    var addressbar_icon, urlbaricons, starbutton, doc;

    /* Create address bar icon */
    doc = win.document;
    addressbar_icon = doc.createElement("box");
    addressbar_icon.setAttribute("id", ADDRESSBAR_ICON_ID);
    addressbar_icon.setAttribute("width", "16");
    addressbar_icon.setAttribute("height", "16");
    addressbar_icon.setAttribute("align", "center");
    addressbar_icon.setAttribute("pack", "center");
    addressbar_icon.setAttribute("tooltiptext", gt("tt_button"));
    if (!prefs.get_bool("showaddressicon")) {
        addressbar_icon.setAttribute("hidden", true);
    }
    /* Box must contain at least one child or it doesn't display */
    addressbar_icon.appendChild(doc.createElement("image"));

    /* Position the icon */
    urlbaricons = gbi(doc, "urlbar-icons");
    starbutton = gbi(doc, "star-button");
    /* If star icon visible, insert before it, otherwise just append to urlbaricons */
    if (!starbutton) {
        urlbaricons.appendChild(addressbar_icon);
    } else {
        urlbaricons.insertBefore(addressbar_icon, starbutton);
    }

    // Create Sixornot widget for this node
    create_sixornot_widget(addressbar_icon, win);

    /* Add unload callback to remove the icon */
    unload(function () {
        log("address bar icon unload", 2);

        /* Remove UI */
        addressbar_icon.parentNode.removeChild(addressbar_icon);
    }, win);
};

/* Creates and sets up a panel to display information which can then be bound to an icon */
var create_panel = function (win, panel_id) {
    var doc, panel, register_callbacks, unregister_callbacks,
    panel_vbox, grid, grid_rows, grid_cols,
    remote_anchor, local_anchor,
    force_scrollbars,
    on_click, on_popupshowing, on_popuphiding, on_page_change,
    on_new_host, on_address_change, on_pageshow,
    on_count_change, on_dns_complete, on_tab_select;

    doc = win.document;

    /* Ensure panel contents visible with scrollbars */
    force_scrollbars = function () {
        if (panel_vbox.clientHeight > panel.clientHeight) {
            panel_vbox.setAttribute("maxheight", panel.clientHeight - 50);
            // TODO if panel width changes after this is applied horizontal fit breaks
            //panel.setAttribute("minwidth", panel_vbox.clientWidth + 40);
        }
    };

    // Called by content script of active tab
    // Message contains data to update icon/UI
    var on_update_ui_message = function (message) {
        remote_anchor.update_model(JSON.parse(message.data));
        force_scrollbars();
    };

    /* Event handlers */
    var currentBrowserMM;
    var subscribe_to_current = function () {
        if (currentBrowserMM) {
            currentBrowserMM.removeMessageListener("sixornot@baldock.me:update-ui", on_update_ui_message);
        }
        currentBrowserMM = win.gBrowser.mCurrentBrowser.messageManager;
        currentBrowserMM.addMessageListener("sixornot@baldock.me:update-ui", on_update_ui_message);
    };

    // Ask active content script to send us an update, e.g. when switching tabs
    var request_update = function () {
        currentBrowserMM.sendAsyncMessage("sixornot@baldock.me:update-ui");
    };

    unregister_callbacks = function () {
        win.gBrowser.tabContainer.removeEventListener("TabSelect", on_tab_select, false);
        win.gBrowser.removeEventListener("pageshow", on_pageshow, false);
    };
    register_callbacks = function () {
        win.gBrowser.tabContainer.addEventListener("TabSelect", on_tab_select, false);
        win.gBrowser.addEventListener("pageshow", on_pageshow, false);
    };

    on_popupshowing = function (evt) {
        log("panel:on_popupshowing", 2);
        register_callbacks();
        subscribe_to_current();
        request_update();
        local_anchor.update_local_address_display();
    };

    on_popuphiding = function (evt) {
        log("panel:on_popuphiding", 2);
        unregister_callbacks();
        // TODO unsubscribe from current
    };

    on_tab_select = function (evt) {
        log("panel:on_tab_select", 1);
        subscribe_to_current();
        request_update();
    };

    on_pageshow = function (evt) {
        log("panel:on_pageshow", 1);
        subscribe_to_current();
        request_update();
    };

    /* Actions are defined by custom properties applied to the event target element
       One or more of these can be triggered */
    on_click = function (evt) {
        log("panel:on_click", 1);
        if (evt.target.sixornot_showhide_local) {
            log("panel:on_click - showhide_local", 2);
            local_anchor.toggle_local_address_display();
            evt.stopPropagation();
        }
    };

    /* Panel UI */
    panel = doc.createElement("panel");
    panel.setAttribute("type", "arrow");
    panel.setAttribute("id", panel_id);
    panel.setAttribute("hidden", true);
    panel.setAttribute("position", "bottomcenter topright");
    panel.classList.add("sixornot-panel");

    /* Contains all other elements in panel */
    panel_vbox = doc.createElement("vbox");
    panel_vbox.setAttribute("flex", "1");
    panel_vbox.style.overflowY = "auto";
    panel_vbox.style.overflowX = "hidden";
    panel.appendChild(panel_vbox);

    /* Grid into which address entries are put */
    grid = doc.createElement("grid");
    grid_rows = doc.createElement("rows");
    grid_cols = doc.createElement("columns");
    // 5 columns wide - icon, count, host, address, show/hide
    grid_cols.appendChild(doc.createElement("column"));
    grid_cols.appendChild(doc.createElement("column"));
    grid_cols.appendChild(doc.createElement("column"));
    grid_cols.appendChild(doc.createElement("column"));
    grid_cols.appendChild(doc.createElement("column"));
    grid.appendChild(grid_cols);
    grid.appendChild(grid_rows);
    panel_vbox.appendChild(grid);

    /* Anchors are locations to insert entries into grid */
    remote_anchor = create_remote_anchor(doc, grid_rows);
    local_anchor = create_local_anchor(doc, grid_rows);

    /* Links at bottom of panel */
    var settingsLink, docLink, spacer, urlhbox,
        make_spacer;

    /* Settings */
    var onClickSettingsLink = function (evt) {
        panel.hidePopup();
        open_preferences();
        evt.stopPropagation();
    };
    settingsLink = doc.createElement("label");
    settingsLink.setAttribute("value", gt("header_settings"));
    settingsLink.setAttribute("tooltiptext", gt("tt_open_settings"));
    settingsLink.classList.add("sixornot-link");
    settingsLink.classList.add("sixornot-title");
    settingsLink.addEventListener("click", onClickSettingsLink, false);

    /* Documentation link */
    var onClickDocLink = function (evt) {
        panel.hidePopup();
        open_hyperlink(gt("sixornot_weblink"));
        evt.stopPropagation();
    };
    docLink = doc.createElement("label");
    docLink.setAttribute("value", gt("sixornot_documentation"));
    docLink.classList.add("sixornot-link");
    docLink.classList.add("sixornot-title");
    docLink.setAttribute("tooltiptext", gt("tt_gotowebsite"));
    docLink.addEventListener("click", onClickDocLink, false);

    spacer = doc.createElement("label");
    spacer.setAttribute("value", " - ");
    spacer.classList.add("sixornot-title");

    make_spacer = function () {
        var spacer = doc.createElement("spacer");
        spacer.setAttribute("flex", "1");
        return spacer;
    };

    urlhbox = doc.createElement("hbox");
    urlhbox.appendChild(make_spacer());
    urlhbox.appendChild(settingsLink);
    urlhbox.appendChild(spacer);
    urlhbox.appendChild(docLink);
    urlhbox.appendChild(make_spacer());
    urlhbox.setAttribute("align", "center");
    urlhbox.style.marginTop = "3px";
    grid_rows.appendChild(urlhbox);

    panel.addEventListener("click", on_click, false);
    panel.addEventListener("popupshowing", on_popupshowing, false);
    panel.addEventListener("popuphiding", on_popuphiding, false);

    unload(function () {
        log("Unload panel", 2);
        remote_anchor.remove(); // Removes child event listeners
        local_anchor.remove(); // Removes child event listeners
        settingsLink.removeEventListener("click", onClickSettingsLink, false);
        docLink.removeEventListener("click", onClickDocLink, false);
        panel.removeEventListener("click", on_click, false);
        panel.removeEventListener("popupshowing", on_popupshowing, false);
        panel.removeEventListener("popuphiding", on_popuphiding, false);

        // If panel is open at time of unload unregister callbacks
        unregister_callbacks();

        // Remove UI
        if (panel.parentNode) {
            panel.parentNode.removeChild(panel);
        }
    }, win);

    return panel;
};

var legacy_insert_code = function (win) {
    // SeaMonkey and Linux FF need large icon sets
    if (env.application() === "seamonkey" || env.os() === "Linux") {
        stylesheet.inject_into_window_with_unload(win, stylesheet.sheets.large);
    }
    var customize_sheet = stylesheet.get_customize_sheet_for_platform();
    var on_beforecustomization = function (evt) {
        log("on_beforecustomization", 1);
        /* On pre-Australis platforms the panel for customisation of the toolbars
         * is a different XUL document. We need to inject our CSS modifications
         * into this document each time it is loaded */
        var iframe = win.document.getElementById("customizeToolbarSheetIFrame");
        if (iframe) {
            log("found customizeToolbarSheetIFrame - adding load callback", 1);
            stylesheet.inject_into_window(iframe.contentWindow, customize_sheet);
        } else {
            log("failed to find customizeToolbarSheetIFrame", 1);
        }
    };
    var on_aftercustomization = function (evt) {
        log("on_aftercustomization", 1);
        var iframe = win.document.getElementById("customizeToolbarSheetIFrame");
        if (iframe) {
            log("on_aftercustomization - found customizeToolbarSheetIFrame", 1);
            stylesheet.remove_from_window(iframe.contentWindow, customize_sheet);
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

    log("insert_code: add legacy button", 1);
    // Create legacy button (only for non-Australis browsers)
    create_legacy_button(win);
};

/* Should be called once for each window of the browser */
var insert_code = function (win) {
    "use strict";
    // Don't insert into windows that already have UI
    if (win.document.getElementById(ADDRESSBAR_ICON_ID)) {
        log("insert_code: skipping window - UI already exists", 1);
        return;
    }

    // Add stylesheet
    stylesheet.inject_into_window_with_unload(win, stylesheet.sheets.base);

    // Create address bar icon
    log("insert_code: add addressicon", 1);
    create_addressbaricon(win);

    // UI only required for pre-Australis browsers
    if (CustomizableUIAvailable) {
        stylesheet.inject_into_window_with_unload(win, stylesheet.sheets.customize);
    } else {
        legacy_insert_code(win);
    }
};

var set_addressbar_icon_visibility = function (win) {
    var addressbar_icon = win.document.getElementById(ADDRESSBAR_ICON_ID);
    if (prefs.get_bool("showaddressicon")) {
        addressbar_icon.setAttribute("hidden", false);
    } else {
        addressbar_icon.setAttribute("hidden", true);
    }
};

var set_greyscale_icons = function (win) {
    var addressbar_icon = win.document.getElementById(ADDRESSBAR_ICON_ID);
    var button = win.document.getElementById(BUTTON_ID);
    if (prefs.get_bool("greyscaleicons")) {
        add_greyscale_class_to_node(addressbar_icon);
        add_greyscale_class_to_node(button);
    } else {
        remove_greyscale_class_from_node(addressbar_icon);
        remove_greyscale_class_from_node(button);
    }
};

