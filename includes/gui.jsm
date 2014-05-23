/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2008-2014 Timothy Baldock. All Rights Reserved.
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
/*global gt, log, parse_exception, prefs, dns_handler, imagesrc, windowWatcher, unload, requests */

var CustomizableUIAvailable = true, e;
/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");
try {
    Components.utils.import("resource:///modules/CustomizableUI.jsm");
} catch (e) {
    CustomizableUIAvailable = false;
}
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/locale.jsm");
Components.utils.import("resource://sixornot/includes/prefs.jsm");
Components.utils.import("resource://sixornot/includes/requestcache.jsm");
Components.utils.import("resource://sixornot/includes/imagesrc.jsm");
Components.utils.import("resource://sixornot/includes/windowwatcher.jsm");
Components.utils.import("resource://sixornot/includes/dns.jsm");
/*jslint es5: false */

// Module globals
var EXPORTED_SYMBOLS = ["insert_code", "create_button", "set_addressbar_icon_visibility",
                        "set_greyscale_icons"];

// ID constants
var ADDRESSBAR_ICON_ID = "sixornot-addressbaricon";
var BUTTON_ID          = "sixornot-button";


/* Proxy to getElementById */
var gbi = function (node, child_id) {
    "use strict";
    if (node.getElementById) {
        return node.getElementById(child_id);
    } else {
        return node.querySelector("#" + child_id);
    }
};


// TODO
/*
    Handle all the same edge cases as before
    Find nice structure for organising the functions
    Move settings into panel
    Add tooltips for panel elements
    Allow expanding of panel items to show full detail for any item
        The main page always shows full details
*/

/* Returns the correct icon source entry for a given record */
// TODO
// Expand this to account for proxies
// Also account for error conditions, e.g. using v4 with no v4 in DNS
var get_icon_source = function (record) {
    if (record.address_family === 4) {
        if (record.ipv6s.length !== 0) {
            // Actual is v4, DNS is v4 + v6 -> Orange
            return imagesrc.get("4pot6");
        } else {
            // Actual is v4, DNS is v4 -> Red
            return imagesrc.get("4only");
        }
    } else if (record.address_family === 6) {
        if (record.ipv4s.length === 0) {
            // Actual is v6, DNS is v6 -> Blue
            return imagesrc.get("6only");
        } else {
            // Actual is v6, DNS is v4 + v6 -> Green
            return imagesrc.get("6and4");
        }
    } else if (record.address_family === 2) {
        // address family 2 is cached responses
        if (record.ipv6s.length === 0) {
            if (record.ipv4s.length === 0) {
                // No addresses, grey cache icon
                return imagesrc.get("other_cache");
            } else {
                // Only v4 addresses from DNS, red cache icon
                return imagesrc.get("4only_cache");
            }
        } else {
            if (record.ipv4s.length === 0) {
                // Only v6 addresses from DNS, blue cache icon
                return imagesrc.get("6only_cache");
            } else {
                // Both kinds of addresses from DNS, yellow cache icon
                return imagesrc.get("4pot6_cache");
            }
        }
    } else if (record.address_family === 1) {
        return imagesrc.get("other_cache");
    } else if (record.address_family === 0) {
        // This indicates that no addresses were available but request is not cached
        return imagesrc.get("error");
    }
};
var get_icon_class = function (record) {
    if (record.address_family === 4) {
        if (record.ipv6s.length !== 0) {
            // Actual is v4, DNS is v4 + v6 -> Orange
            return "sixornot_4pot6";
        } else {
            // Actual is v4, DNS is v4 -> Red
            return "sixornot_4only";
        }
    } else if (record.address_family === 6) {
        if (record.ipv4s.length === 0) {
            // Actual is v6, DNS is v6 -> Blue
            return "sixornot_6only";
        } else {
            // Actual is v6, DNS is v4 + v6 -> Green
            return "sixornot_6and4";
        }
    } else if (record.address_family === 2) {
        // address family 2 is cached responses
        if (record.ipv6s.length === 0) {
            if (record.ipv4s.length === 0) {
                // No addresses, grey cache icon
                return "sixornot_other_cache";
            } else {
                // Only v4 addresses from DNS, red cache icon
                return "sixornot_4only_cache";
            }
        } else {
            if (record.ipv4s.length === 0) {
                // Only v6 addresses from DNS, blue cache icon
                return "sixornot_6only_cache";
            } else {
                // Both kinds of addresses from DNS, yellow cache icon
                return "sixornot_4pot6_cache";
            }
        }
    } else if (record.address_family === 1) {
        return "sixornot_other_cache";
    } else if (record.address_family === 0) {
        // This indicates that no addresses were available but request is not cached
        return "sixornot_error";
    }
};

var sixornot_classes = ["sixornot_4only", "sixornot_4only_cache",
                        "sixornot_4pot6", "sixornot_4pot6_cache",
                        "sixornot_6and4", "sixornot_6and4_cache",
                        "sixornot_6only", "sixornot_6only_cache",
                        "sixornot_other", "sixornot_other_cache",
                        "sixornot_proxy", "sixornot_error"];
var remove_sixornot_classes_from = function (node) {
    sixornot_classes.forEach(function (item, index, items) {
        node.classList.remove(item);
    });
};
var add_class_to_node = function (new_item_class, node) {
    node.classList.add(new_item_class);
};
var add_greyscale_class_to_node = function (node) {
    node.classList.add("sixornot_grey");
};
var remove_greyscale_class_from_node = function (node) {
    node.classList.remove("sixornot_grey");
};


// Create widget which handles shared logic between button/addresbar icon
var create_sixornot_widget = function (node, win) {
    var panel, current_tab_inner_id, current_tab_outer_id,
        click_handler, page_change_handler, tabselect_handler,
        pageshow_handler, on_dns_complete;

    var current_host = function () {
        return win.content.document.location.hostname;
    };
    var set_current_tab_ids = function () {
        var domWindow, domWindowUtils;
        domWindow  = win.gBrowser.mCurrentBrowser.contentWindow;
        domWindowUtils = domWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                            .getInterface(Components.interfaces.nsIDOMWindowUtils);

        current_tab_inner_id = domWindowUtils.currentInnerWindowID;
        current_tab_outer_id = domWindowUtils.outerWindowID;
    };

    // Change icon via class (icon set via stylesheet)
    var update_icon_for_node = function (node) {
        var hosts = requests.cache[current_tab_inner_id];

        /* Parse array searching for the main host (which matches the current location) */
        if (!hosts || !hosts.some(function (item, index, items) {
            if (item.host === current_host()) {
                var new_icon_class = get_icon_class(item);
                if (!node.classList.contains(new_icon_class)) {
                    remove_sixornot_classes_from(node);
                    add_class_to_node(new_icon_class, node);
                }
                return true;
            }
        })) {
            // No matching entry for main host (probably a local file)
            remove_sixornot_classes_from(node);
            add_class_to_node("sixornot_other", node);
        }
    };

    click_handler = function () {
        panel.setAttribute("hidden", false);
        panel.openPopup(node, panel.getAttribute("position"), 0, 0, false, false);
    };

    tabselect_handler = function (evt) {
        log("Sixornot - widget:tabselect_handler", 2);
        set_current_tab_ids();
        update_icon_for_node(node);
    };

    pageshow_handler = function (evt) {
        log("Sixornot - widget:pageshow_handler", 2);
        set_current_tab_ids();
        update_icon_for_node(node);
    };

    /* Called whenever a Sixornot page change event is emitted */
    page_change_handler = function (evt) {
        log("Sixornot - widget:page_change_handler - evt.detail.outer_id: " + evt.detail.outer_id + ", evt.detail.inner_id: " + evt.detail.inner_id + ", current_tab_outer_id: " + current_tab_outer_id + ", current_tab_inner_id: " + current_tab_inner_id, 1);
        set_current_tab_ids();
        if (evt.detail.outer_id === current_tab_outer_id) {
            update_icon_for_node(node);
        }
    };

    /* Called whenever a Sixornot dns lookup event is heard */
    on_dns_complete = function (evt) {
        log("Sixornot - widget:on_dns_complete - evt.detail.outer_id: " + evt.detail.outer_id + ", evt.detail.inner_id: " + evt.detail.inner_id + ", current_tab_outer_id: " + current_tab_outer_id + ", current_tab_inner_id: " + current_tab_inner_id, 1);
        set_current_tab_ids();
        if (evt.detail.outer_id === current_tab_outer_id) {
            update_icon_for_node(node);
        }
    };

    /* Create a panel to show details when clicked */
    panel = create_panel(win, node.id + "-panel");
    node.appendChild(panel);

    // Ensure tab ID is set upon loading into window
    set_current_tab_ids();

    // Update greyscale property + icon
    if (prefs.get_bool("greyscaleicons")) {
        add_greyscale_class_to_node(node);
    } else {
        remove_greyscale_class_from_node(node);
    }
    update_icon_for_node(node);

    /* Add event listeners */
    node.addEventListener("click", click_handler, false);
    win.addEventListener("sixornot-page-change-event", page_change_handler, false);
    win.addEventListener("sixornot-dns-lookup-event", on_dns_complete, false);
    win.gBrowser.tabContainer.addEventListener("TabSelect", tabselect_handler, false);
    win.gBrowser.addEventListener("pageshow", pageshow_handler, false);

    unload(function () {
        log("Sixornot - widget unload function", 2);
        /* Clear event handlers */
        // win.removeEventListener("offline", onChangedOnlineStatus, false); TODO
        // win.removeEventListener("online", onChangedOnlineStatus, false); TODO
        node.removeEventListener("click", click_handler, false);
        win.removeEventListener("sixornot-page-change-event", page_change_handler, false);
        win.removeEventListener("sixornot-dns-lookup-event", on_dns_complete, false);
        win.gBrowser.tabContainer.removeEventListener("TabSelect", tabselect_handler, false);
        win.gBrowser.removeEventListener("pageshow", pageshow_handler, false);
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
        log("Sixornot - insert_code:create_button:customize_handler");
        log("Sixornot ----- button customise, button classList: " + button.classList, 1);
        log("Sixornot ----- button customise, button listStyleImage: " + button.style.listStyleImage, 1);
        log("Sixornot ----- button customise, button parent classList: " + button.parentNode.classList, 1);
        log("Sixornot ----- button customise, button parent id: " + button.parentNode.id, 1);
        if (button) {
            log("Sixornot ----- button customise, button exists", 1);
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
        log("Sixornot - legacy button unload", 2);

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
            log("Sixornot - button UI created", 2);

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
        log("Sixornot - address bar icon unload", 2);

        /* Remove UI */
        addressbar_icon.parentNode.removeChild(addressbar_icon);
    }, win);
};


/* Creates and sets up a panel to display information which can then be bound to an icon */
var create_panel = function (win, panel_id) {
    var panel, on_click, on_mouseover, on_mouseout,
    on_show_panel, on_page_change, on_new_host, on_address_change,
    pageshow_handler,
    on_count_change, on_dns_complete, on_tab_select,
    panel_vbox, remote_grid, remote_rows, remote_cols, title_remote,
    remote_anchor, title_local, settingslabel, urllabel, urlhbox,
    get_hosts, get_host, force_scrollbars, new_line, grid_contents, remove_all,
    generate_all;

    var doc = win.document;
    var currentTabInnerID = 0;
    var currentTabOuterID = 0;

    /* Return the host part of the current window's location */
    var current_host = function () {
        return win.content.document.location.hostname;
    };

    var set_current_tab_ids = function () {
        var domWindow, domWindowUtils;
        domWindow  = win.gBrowser.mCurrentBrowser.contentWindow;
        domWindowUtils = domWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                            .getInterface(Components.interfaces.nsIDOMWindowUtils);

        currentTabInnerID = domWindowUtils.currentInnerWindowID;
        currentTabOuterID = domWindowUtils.outerWindowID;
    };

    panel = doc.createElement("panel");
    //panel.setAttribute("noautohide", true);

    // This contains everything else in the panel, vertical orientation
    panel_vbox = doc.createElement("vbox");
    panel_vbox.setAttribute("flex", "1");
    panel_vbox.style.overflowY = "auto";
    panel_vbox.style.overflowX = "hidden";
    panel.appendChild(panel_vbox);

    // Build containing panel UI
    remote_grid = doc.createElement("grid");
    remote_rows = doc.createElement("rows");
    remote_cols = doc.createElement("columns");
    // 5 columns wide
    // icon, count, host, address, show/hide
    remote_cols.appendChild(doc.createElement("column"));
    remote_cols.appendChild(doc.createElement("column"));
    remote_cols.appendChild(doc.createElement("column"));
    remote_cols.appendChild(doc.createElement("column"));
    remote_cols.appendChild(doc.createElement("column"));
    remote_grid.appendChild(remote_cols);
    remote_grid.appendChild(remote_rows);
    panel_vbox.appendChild(remote_grid);

    // Add "Remote" title
    title_remote = doc.createElement("label");
    title_remote.setAttribute("value", gt("header_remote"));
    title_remote.setAttribute("style", "text-align: center; font-size: smaller;");
    remote_rows.appendChild(title_remote);
    // Add remote title anchor object
    remote_anchor = {
        add_after: function (element) {
            if (title_remote.nextSibling) {
                remote_rows.insertBefore(element, title_remote.nextSibling);
            } else {
                remote_rows.appendChild(element);
            }
        }
    };

    // Add "Local" title (TODO - replace with element with "hide" method)
    title_local = doc.createElement("label");
    title_local.setAttribute("value", gt("header_local"));
    title_local.setAttribute("style", "text-align: center; font-size: smaller;");
    title_local.setAttribute("hidden", true);
    remote_rows.appendChild(title_local);

    // Settings link
    settingslabel = doc.createElement("description");
    settingslabel.setAttribute("value", gt("header_settings"));
    settingslabel.setAttribute("tooltiptext", gt("tt_open_settings"));
    settingslabel.setAttribute("style", "text-align: center; font-size: smaller;");
    remote_rows.appendChild(settingslabel);

    settingslabel.sixornot_decorate = true;
    settingslabel.sixornot_openprefs = true;

    // Add link to Sixornot website to UI
    urllabel = doc.createElement("description");
    urllabel.setAttribute("value", gt("sixornot_web"));
    urllabel.setAttribute("crop", "none");
    urllabel.sixornot_decorate = true;
    urllabel.sixornot_hyperlink = gt("sixornot_weblink");
    urllabel.setAttribute("tooltiptext", gt("tt_gotowebsite"));
    urlhbox = doc.createElement("urlhbox");
    urlhbox.appendChild(urllabel);
    urlhbox.setAttribute("align", "end");
    panel_vbox.appendChild(urlhbox);


    /* Functions */

    /* Get the hosts list for the current window */
    get_hosts = function () {
        // Get IDs for lookup
        var currentWindowID = win.gBrowser.mCurrentBrowser.contentWindow
            .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIDOMWindowUtils)
            .currentInnerWindowID;
        if (requests.cache[currentWindowID] !== undefined) {
            return requests.cache[currentWindowID];
        }
    };

    /* Get a particular host entry for current window based on host name */
    get_host = function (hostname) {
        var currentWindowID, requestCacheLookup, i;
        // Get IDs for lookup
        currentWindowID = win.gBrowser.mCurrentBrowser.contentWindow
            .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIDOMWindowUtils)
            .currentInnerWindowID;
        requestCacheLookup = requests.cache[currentWindowID];

        // Locate the requested item in the lookup entry
        for (i = 0; i < requestCacheLookup.length; i += 1) {
            if (requestCacheLookup[i] !== undefined && requestCacheLookup[i].host === hostname) {
                return requestCacheLookup[i];
            }
        }
    };

    /* Ensure panel contents visible with scrollbars */
    force_scrollbars = function () {
        if (panel_vbox.clientHeight > panel.clientHeight) {
            panel_vbox.setAttribute("maxheight", panel.clientHeight - 50);
            // TODO if panel width changes after this is applied horizontal fit breaks
            //panel.setAttribute("minwidth", panel_vbox.clientWidth + 40);
        }
    };


    // Add a line, including local event handlers for show/hide
    //  Added in correct place in ordering (alphabetical, main site at top)

    // Remove all lines, including cleanup of callbacks etc.

    // (All filtered by innerwindowid)
    // Update line icon (index by host) - reference to main model, pass object
    // Update line connection count (index by host)
    // Update line connection address (index by host)
    // Update line additional addresses (index by host)

    // Summary or detail needs to be a property of the object representation so that it can persist between menu shows, or refreshing of the extended info fields
    // The ip address arrays can be rebuilt, meaning the elements would have to be removed and re-added


    /* Object representing one host entry in the panel
       Takes a reference to a member of the request cache as argument
       and links to that member to reflect its state
       Also takes a reference to the element to add this element after
       e.g. header or the preceeding list item */
    new_line = function (host, addafter) {
        var copy_full, create_header_row, header_row;
        log("Sixornot - new_line", 1);
        // Due to closure this is available to all functions defined inside this one
        copy_full = "";

        /* Create and return a new line item */
        create_header_row = function (addafter) {
            var create_showhide, create_icon, create_count, create_hostname,
                create_ips, row;
            log("Sixornot - create_header_row", 1);
            create_showhide = function (addto) {
                var showhide, update;
                log("Sixornot - create_showhide", 1);

                /* Create DOM UI elements */
                showhide = doc.createElement("label");
                showhide.setAttribute("value", "");
                showhide.setAttribute("style", "");

                showhide.sixornot_host = host.host;
                showhide.sixornot_showhide = true;
                showhide.sixornot_decorate = true;

                update = function () {
                    var count = 0;
                    host.ipv6s.forEach(function (address, index, addresses) {
                        if (address !== host.address) {
                            count += 1;
                        }
                    });
                    host.ipv4s.forEach(function (address, index, addresses) {
                        if (address !== host.address) {
                            count += 1;
                        }
                    });
                    if (count > 0) {
                        if (host.show_detail) {
                            showhide.setAttribute("value", "[" + gt("hide_text") + "]");
                            showhide.setAttribute("hidden", false);
                            showhide.setAttribute("tooltiptext", gt("tt_hide_detail"));
                        } else {
                            showhide.setAttribute("value", "[+" + count + "]");
                            showhide.setAttribute("hidden", false);
                            showhide.setAttribute("tooltiptext", gt("tt_show_detail"));
                        }
                    } else {
                        showhide.setAttribute("value", "");
                        showhide.setAttribute("hidden", true);
                    }
                };
                /* Update elements on create */
                update();
                addto.appendChild(showhide);
                /* Return object for interacting with DOM elements */
                return {
                    update: update,
                    remove: function () {
                        addto.removeChild(showhide);
                    }
                };
            };
            create_icon = function (addto) {
                var icon, update;
                log("Sixornot - create_icon", 1);
                /* Create DOM UI elements */
                icon = doc.createElement("image");
                icon.setAttribute("width", "16");
                icon.setAttribute("height", "16");
                icon.sixornot_decorate = false;
                update = function () {
                    icon.setAttribute("src", get_icon_source(host));
                };
                /* Update element on create */
                update();
                addto.appendChild(icon);
                /* Return object for interacting with DOM element */
                return {
                    update: update,
                    remove: function () {
                        addto.removeChild(icon);
                    }
                };
            };
            create_count = function (addto) {
                var count, update;
                log("Sixornot - create_count", 1);
                /* Create DOM UI elements */
                count = doc.createElement("label");

                count.setAttribute("tooltiptext", gt("tt_copycount"));
                update = function () {
                    if (host.count > 0) {
                        count.setAttribute("value", "(" + host.count + ")");
                        //count.sixornot_decorate = true;
                    } else {
                        count.setAttribute("value", "");
                        //count.sixornot_decorate = false;
                    }
                    // TODO Add real copy text here
                    //count.sixornot_copytext = "count copy text";
                };
                /* Update element on create */
                update();
                addto.appendChild(count);
                /* Return object for interacting with DOM element */
                return {
                    update: update,
                    remove: function () {
                        addto.removeChild(count);
                    }
                };
            };
            create_hostname = function (addto) {
                var hostname, update;
                log("Sixornot - create_hostname", 1);
                /* Create DOM UI elements */
                hostname = doc.createElement("label");
                hostname.setAttribute("value", host.host);
                if (host.host === current_host()) {
                    hostname.setAttribute("style", "font-weight: bold;");
                } else {
                    hostname.setAttribute("style", "font-weight: normal;");
                }

                hostname.setAttribute("tooltiptext", gt("tt_copydomclip"));
                update = function () {
                    var text = host.host + "," + host.address;
                    /* Sort the lists of addresses */
                    host.ipv6s.sort(function (a, b) {
                        return dns_handler.sort_ip6.call(dns_handler, a, b);
                    });
                    host.ipv4s.sort(function (a, b) {
                        return dns_handler.sort_ip4.call(dns_handler, a, b);
                    });
                    host.ipv6s.forEach(function (address, index, addresses) {
                        if (address !== host.address) {
                            text = text + "," + address;
                        }
                    });
                    host.ipv4s.forEach(function (address, index, addresses) {
                        if (address !== host.address) {
                            text = text + "," + address;
                        }
                    });
                    hostname.sixornot_copytext = text;
                    hostname.sixornot_decorate = true;
                };
                /* Update element on create */
                update();
                addto.appendChild(hostname);
                /* Return object for interacting with DOM element */
                return {
                    update: update,
                    remove: function () {
                        addto.removeChild(hostname);
                    }
                };
            };

            /* Creates an element containing a listing of IP addresses
               The first one will be the connection IP
               The rest are IP addresses looked up from DNS */
            create_ips = function (addto) {
                var update, address_box;
                log("Sixornot - create_conip", 1);
                /* Create DOM UI elements */
                address_box = doc.createElement("vbox");

                update = function () {
                    var conipaddr;
                    // Remove all existing addresses
                    while (address_box.firstChild) {
                        address_box.removeChild(address_box.firstChild);
                    }
                    // Add the first entry (connection IP)
                    conipaddr = doc.createElement("label");
                    conipaddr.sixornot_host = host.host;
                    if (host.address_family === 6) {
                        conipaddr.setAttribute("value", host.address);
                        conipaddr.sixornot_copytext = host.address;
                        //conipaddr.setAttribute("style", "color: #0F0;");
                        conipaddr.setAttribute("tooltiptext", gt("tt_copyaddr"));
                        conipaddr.sixornot_decorate = true;
                    } else if (host.address_family === 4) {
                        conipaddr.setAttribute("value", host.address);
                        conipaddr.sixornot_copytext = host.address;
                        //conipaddr.setAttribute("style", "color: #F00;");
                        conipaddr.setAttribute("tooltiptext", gt("tt_copyaddr"));
                        conipaddr.sixornot_decorate = true;
                    } else if (host.address_family === 2) {
                        conipaddr.setAttribute("value", gt("addr_cached"));
                        conipaddr.sixornot_copytext = "";
                        //conipaddr.setAttribute("style", "color: #00F;");
                        conipaddr.sixornot_decorate = false;
                    } else {
                        conipaddr.setAttribute("value", gt("addr_unavailable"));
                        conipaddr.sixornot_copytext = "";
                        //conipaddr.setAttribute("style", "color: #000;");
                        conipaddr.sixornot_decorate = false;
                    }
                    address_box.appendChild(conipaddr);

                    if (host.show_detail) {
                        // Add the other addresses (if any)
                        host.ipv6s.sort(function (a, b) {
                            return dns_handler.sort_ip6.call(dns_handler, a, b);
                        });
                        host.ipv4s.sort(function (a, b) {
                            return dns_handler.sort_ip4.call(dns_handler, a, b);
                        });
                        host.ipv6s.forEach(function (address, index, addresses) {
                            if (address !== host.address) {
                                var detailaddr = doc.createElement("label");
                                detailaddr.setAttribute("value", address);
                                detailaddr.sixornot_copytext = address;
                                //detailaddr.setAttribute("style", "color: #0F0;");
                                detailaddr.setAttribute("tooltiptext", gt("tt_copyaddr"));
                                detailaddr.sixornot_decorate = true;
                                detailaddr.sixornot_host = host.host;
                                address_box.appendChild(detailaddr);
                            }
                        });
                        host.ipv4s.forEach(function (address, index, addresses) {
                            if (address !== host.address) {
                                var detailaddr = doc.createElement("label");
                                detailaddr.setAttribute("value", address);
                                detailaddr.sixornot_copytext = address;
                                //detailaddr.setAttribute("style", "color: #F00;");
                                detailaddr.setAttribute("tooltiptext", gt("tt_copyaddr"));
                                detailaddr.sixornot_decorate = true;
                                detailaddr.sixornot_host = host.host;
                                address_box.appendChild(detailaddr);
                            }
                        });
                    }

                };
                /* Update element on create */
                update();
                address_box.sixornot_host = host.host;
                addto.appendChild(address_box);
                /* Return object for interacting with DOM element */
                return {
                    update: update,
                    remove: function () {
                        addto.removeChild(address_box);
                    }
                };
            };

            // Create row
            row = doc.createElement("row");
            row.setAttribute("align", "start");
            /* Add this element after the last one */
            addafter.add_after(row);

            /* Object representing header row of entry */
            return {
                icon: create_icon(row),
                count: create_count(row),
                hostname: create_hostname(row),
                ips: create_ips(row),
                showhide: create_showhide(row),
                /* Remove this element and all children */
                remove: function () {
                    // Remove children
                    this.icon.remove();
                    this.count.remove();
                    this.hostname.remove();
                    this.ips.remove();
                    this.showhide.remove();
                    // Remove self
                    row.parentNode.removeChild(row);
                },
                add_after: function (element) {
                    /* Add the element specified immediately after this one in the DOM */
                    if (row.nextSibling) {
                        row.parentNode.insertBefore(element, row.nextSibling);
                    } else {
                        row.parentNode.appendChild(element);
                    }
                }
            };
        };

        // Bind onclick events here TODO
        header_row = create_header_row(addafter);

        return {
            host: host,
            header_row: header_row,
            copy_full: copy_full,
            remove: function () {
                header_row.remove();
            },
            show_detail: function () {
                this.header_row.showhide.update();
            },
            hide_detail: function () {
                this.header_row.showhide.update();
            },
            update_address: function () {
                // TODO optimisation - only update connection IP
                this.header_row.ips.update();
                this.header_row.icon.update();
            },
            update_ips: function () {
                // TODO optimisation - only update DNS IPs
                this.header_row.ips.update();
                this.header_row.showhide.update();
                this.header_row.icon.update();
            },
            update_count: function () {
                this.header_row.count.update();
            },

            /* Return the last element, useful for inserting another element after this one */
            get_last_element: function () {
                return this.header_row;
            },
            /* Adds the contents of this object after the specified element */
            add_after: function (element) {
                if (header_row.nextSibling) {
                    header_row.parentNode.insertBefore(element, header_row.nextSibling);
                } else {
                    header_row.parentNode.appendChild(element);
                }
            }
        };
    };

    grid_contents = [];

    remove_all = function () {
        log("Sixornot - panel:remove_all", 2);
        grid_contents.forEach(function (item, index, items) {
            try {
                item.remove();
            } catch (e) {
                Components.utils.reportError(e);
            }
        });
        grid_contents = [];

    };
    generate_all = function () {
        log("Sixornot - panel:generate_all", 2);
        var hosts = get_hosts();

        // In this case we're on a page which has no cached info
        if (hosts === undefined) {
            // TODO - Add logic here to display useful messages for other pages
            // TODO - If we're on a page which we have no cached data for, but which has
            //        a domain, do DNS lookups and add data to cache etc. (fallback behaviour)
        } else {
            hosts.forEach(function (host, index, items) {
                // For each host in hosts add a line object to the grid_contents array
                // These will be added to the DOM after the previous one, or after the
                // anchor element if none have been created yet
                try {
                    if (grid_contents.length > 0) {
                        grid_contents.push(new_line(host, grid_contents[grid_contents.length - 1].get_last_element()));
                    } else {
                        grid_contents.push(new_line(host, remote_anchor));
                    }
                } catch (e) {
                    Components.utils.reportError(e);
                }
            });
        }
    };

    /* Handles mouseover events on any panel element */
    on_mouseover = function (evt) {
        if (evt.target.sixornot_decorate) {
            evt.target.style.textDecoration = "underline";
            evt.target.style.cursor="pointer";
        }
    };
    /* Handles mouseout events on any panel element */
    on_mouseout = function (evt) {
        if (evt.target.sixornot_decorate) {
            evt.target.style.textDecoration = "none";
            evt.target.style.cursor="default";
        }
    };

    /* Handles click events on any panel element
       Actions are defined by custom properties applied to the event target element
       One or more of these can be triggered */
    on_click = function (evt) {
        var currentWindow, currentBrowser;
        log("Sixornot - panel:on_click", 1);
        /* If element has sixornot_copytext, then copy it to clipboard */
        if (evt.target.sixornot_copytext) {
            try {
                evt.stopPropagation();
                log("Sixornot - panel:on_click - sixornot_copytext '" + evt.target.sixornot_copytext + "' to clipboard", 0);
                Components.classes["@mozilla.org/widget/clipboardhelper;1"]     // TODO use of getService
                    .getService(Components.interfaces.nsIClipboardHelper)
                    .copyString(evt.target.sixornot_copytext);
            } catch (e_copytext) {
                Components.utils.reportError(e_copytext);
            }
        }
        /* If element has show/hide behaviour, toggle and trigger refresh */
        if (evt.target.sixornot_showhide) {
            try {
                evt.stopPropagation();
                log("Sixornot - panel:on_click - showhide", 1);
                // Locate matching element and trigger refresh
                if (!grid_contents.some(function (item, index, items) {
                    if (item.host.host === evt.target.sixornot_host) {
                        log("Sixornot - panel:on_click - ", 1);
                        item.host.show_detail = !item.host.show_detail;
                        item.update_ips();
                        return true;
                    }
                })) {
                        log("Sixornot - panel:on_click - no matching host found", 1);
                }
            } catch (e_showhide) {
                Components.utils.reportError(e_showhide);
            }
        }
        /* Element should open preferences when clicked */
        if (evt.target.sixornot_openprefs) {
            try {
                evt.stopPropagation();
                panel.hidePopup();
                log("Sixornot - panel:on_click - openprefs", 1);
                // Add tab to most recent window, regardless of where this function was called from
                currentWindow = Services.wm.getMostRecentWindow("navigator:browser");
                currentWindow.focus();
                currentBrowser = currentWindow.getBrowser();
                currentBrowser.selectedTab = currentBrowser.addTab("about:addons");
                // TODO link should open Sixornot, but this isn't currently possible
                //currentWindow.getBrowser().contentWindow.wrappedJSObject.loadView("addons://detail/sixornot@entropy.me.uk");
            } catch (e_openprefs) {
                Components.utils.reportError(e_openprefs);
            }
        }
        /* Element should open hyperlink when clicked */
        if (evt.target.sixornot_hyperlink) {
            try {
                log("Sixornot - panel:on_click - open hyperlink", 1);
                evt.stopPropagation();
                panel.hidePopup();
                // Add tab to most recent window, regardless of where this function was called from
                currentWindow = Services.wm.getMostRecentWindow("navigator:browser");
                currentWindow.focus();
                currentBrowser = currentWindow.getBrowser();
                currentBrowser.selectedTab = currentBrowser.addTab(evt.target.sixornot_hyperlink);
            } catch (e_hyperlink) {
                Components.utils.reportError(e_hyperlink);
            }
        }
    };

    // On show panel
    // If so remove all entries in grid_contents list
    // Then create a new entry in grid_contents (new_grid_line()) for each element
    // in the cache matching this page
    // 
    on_show_panel = function (evt) {
        log("Sixornot - panel:on_show_panel", 1);
        try {
            remove_all();
            generate_all();
        } catch (e) {
            Components.utils.reportError(e);
        }
    };

    // On page change
    // Check if tab innerID matches event innerID
    // If so repopulate grid_contents list as per show panel
    on_page_change = function (evt) {
        log("Sixornot - panel:on_page_change", 1);
        log("evt.detail: " + JSON.stringify(evt.detail) + ", currentTabOuterID: " + currentTabOuterID + ", currentTabInnerID: " + currentTabInnerID, 2);
        if (panel.state !== "open") {
            log("Sixornot - on_page_change - skipping (panel is closed)", 2);
            return;
        }
        if (evt.detail.outer_id !== currentTabOuterID) {
            log("Sixornot - on_page_change - skipping (outer ID mismatch)", 2);
            return;
        }
        set_current_tab_ids();
        if (evt.detail.inner_id !== currentTabInnerID) {
            log("Sixornot - on_page_change - skipping (inner ID mismatch)", 2);
            return;
        }
        remove_all();
        generate_all();
        force_scrollbars();
    };

    // On new host
    // Check if innerID matches
    // Check if mainhost matches
    // If so add a new host into grid_contents (in correct sort position)
    on_new_host = function (evt) {
        log("Sixornot - panel:on_new_host", 2);
        log("evt.detail: " + JSON.stringify(evt.detail) + ", currentTabOuterID: " + currentTabOuterID + ", currentTabInnerID: " + currentTabInnerID, 2);
        if (panel.state !== "open") {
            log("Sixornot - on_new_host - skipping (panel is closed)", 2);
            return;
        }
        if (evt.detail.inner_id !== currentTabInnerID) {
            log("Sixornot - on_new_host - skipping (inner ID mismatch)", 2);
            return;
        }

        try {
            // TODO put this in the right position based on some ordering
            if (grid_contents.length > 0) {
                if (!grid_contents.some(function (item, index, items) {
                    // TODO - this shouldn't be able to happen!
                    // If item is already in the array, don't add a duplicate
                    // Just update the existing one instead
                    if (item.host.host === evt.detail.host) {
                        log("Adding duplicate!!", 0);
                        item.update_address();
                        item.update_ips();
                        item.update_count();
                        return true;
                    }
                })) {
                    // Add new entry
                    log("Adding new entry!!", 0);
                    grid_contents.push(new_line(get_host(evt.detail.host), grid_contents[grid_contents.length - 1].get_last_element()));
                }
            } else {
                // Push first item onto grid
                log("Adding initial!!", 0);
                grid_contents.push(new_line(get_host(evt.detail.host), remote_anchor));
            }
        } catch (e) {
            Components.utils.reportError(e);
        }
        force_scrollbars();
    };

    // On address change
    // Check if innerID matches
    // Check if mainhost matches
    // If so look up matching host entry in grid_contents + update its connection IP
    // And update its icon
    on_address_change = function (evt) {
        log("Sixornot - panel:on_address_change", 1);
        log("evt.detail: " + JSON.stringify(evt.detail) + ", currentTabOuterID: " + currentTabOuterID + ", currentTabInnerID: " + currentTabInnerID, 1);
        if (panel.state !== "open") {
            log("Sixornot - on_address_change - skipping (panel is closed)", 2);
            return;
        }
        if (evt.detail.inner_id !== currentTabInnerID) {
            log("Sixornot - on_address_change - skipping (inner ID mismatch)", 2);
            return;
        }
        try {
            if (!grid_contents.some(function (item, index, items) {
                if (item.host.host === evt.detail.host) {
                    item.update_address();
                    return true;
                }
            })) {
                    log("Sixornot - on_address_change - matching host not found!", 1);
            }
        } catch (e) {
            Components.utils.reportError(e);
        }
    };

    // On count change
    // Check innerID + mainhost match
    // Look up matching host entry in grid_contents and update its count
    on_count_change = function (evt) {
        log("Sixornot - panel:on_count_change", 1);
        log("evt.detail: " + JSON.stringify(evt.detail) + ", currentTabOuterID: " + currentTabOuterID + ", currentTabInnerID: " + currentTabInnerID, 2);
        if (panel.state !== "open") {
            log("Sixornot - on_count_change - skipping (panel is closed)", 2);
            return;
        }
        if (evt.detail.inner_id !== currentTabInnerID) {
            log("Sixornot - on_count_change - skipping (inner ID mismatch)", 2);
            return;
        }
        try {
            if (!grid_contents.some(function (item, index, items) {
                if (item.host.host === evt.detail.host) {
                    item.update_count();
                    return true;
                }
            })) {
                    log("Sixornot - on_count_change - matching host not found!", 1);
            }
        } catch (e) {
            Components.utils.reportError(e);
        }
    };

    // On DNS lookup completion event
    // Check innerID + mainhost match
    // Look up matching host entry + call update_ips() which rebuilds the set of addresses
    // Update icon
    on_dns_complete = function (evt) {
        log("Sixornot - panel:on_dns_complete", 1);
        log("evt.detail: " + JSON.stringify(evt.detail) + ", currentTabOuterID: " + currentTabOuterID + ", currentTabInnerID: " + currentTabInnerID, 2);

        // TODO - unsubscribe from events when panel is closed to avoid this check
        if (panel.state !== "open") {
            log("Sixornot - on_dns_complete - skipping (panel is closed)", 2);
            return;
        }
        if (evt.detail.inner_id !== currentTabInnerID) {
            log("Sixornot - on_dns_complete - skipping (inner ID mismatch)", 2);
            return;
        }
        try {
            if (!grid_contents.some(function (item, index, items) {
                if (item.host.host === evt.detail.host) {
                    log("Sixornot - on_dns_complete - updating ips and icon", 1);
                        item.update_ips();
                    return true;
                }
            })) {
                    log("Sixornot - on_dns_complete - matching host not found!", 1);
            }
        } catch (e) {
            Components.utils.reportError(e);
        }
        // TODO optimisation - this only needs to be called if the height is changed (e.g. if showing full detail for this host)
        force_scrollbars();
    };

    // On Tab selection by user
    on_tab_select = function (evt) {
        log("Sixornot - panel:on_tab_select", 1);
        // TODO - unsubscribe from events when panel is closed to avoid this check
        if (panel.state !== "open") {
            log("Sixornot - on_tab_select - skipping (panel is closed)", 2);
            return;
        }
        set_current_tab_ids();

        remove_all();
        generate_all();
        force_scrollbars();
    };

    /*
     * pageshow event triggered
     *  This event occurs on back/forward navigation
     */
    pageshow_handler = function (evt) {
        log("Sixornot - panel:pageshow_handler", 1);
        // TODO - unsubscribe from events when panel is closed to avoid this check
        if (panel.state !== "open") {
            log("Sixornot - panel:pageshow_handler - skipping (panel is closed)", 2);
            return;
        }
        set_current_tab_ids();

        remove_all();
        generate_all();
        force_scrollbars();
    };


    // Panel setup
    panel.setAttribute("type", "arrow");
    panel.setAttribute("id", panel_id);
    panel.setAttribute("hidden", true);
    panel.setAttribute("position", "bottomcenter topright");

    // This must be set so that panel's children don't inherit this style!
    panel.style.listStyleImage = "none";

    // Add event listeners for children
    panel.addEventListener("mouseover", on_mouseover, false);
    panel.addEventListener("mouseout", on_mouseout, false);
    panel.addEventListener("click", on_click, false);
    // Event listener to update panel contents when it is shown
    panel.addEventListener("popupshowing", on_show_panel, false);
    win.addEventListener("sixornot-page-change-event", on_page_change, false);
    win.addEventListener("sixornot-new-host-event", on_new_host, false);
    win.addEventListener("sixornot-address-change-event", on_address_change, false);
    win.addEventListener("sixornot-count-change-event", on_count_change, false);
    win.addEventListener("sixornot-dns-lookup-event", on_dns_complete, false);
    win.gBrowser.tabContainer.addEventListener("TabSelect", on_tab_select, false);
    // TODO - add/remove this event listener when the tab changes
    // bind only to the window which is active, so we don't get events for
    // windows which aren't showing
    win.gBrowser.addEventListener("pageshow", pageshow_handler, false);
    //win.gBrowser.addEventListener("DOMContentLoaded", on_page_change, false);

    // Add a callback to our unload list to remove the UI when addon is disabled
    unload(function () {
        log("Sixornot - Unload panel callback", 2);
        // Remove event listeners for children
        panel.removeEventListener("mouseover", on_mouseover, false);
        panel.removeEventListener("mouseout", on_mouseout, false);
        panel.removeEventListener("click", on_click, false);
        // Remove event listeners
        panel.removeEventListener("popupshowing", on_show_panel, false);
        win.removeEventListener("sixornot-page-change-event", on_page_change, false);
        win.removeEventListener("sixornot-new-host-event", on_new_host, false);
        win.removeEventListener("sixornot-address-change-event", on_address_change, false);
        win.removeEventListener("sixornot-count-change-event", on_count_change, false);
        win.removeEventListener("sixornot-dns-lookup-event", on_dns_complete, false);
        win.gBrowser.tabContainer.removeEventListener("TabSelect", on_tab_select, false);
        win.gBrowser.removeEventListener("pageshow", pageshow_handler, false);
        //win.gBrowser.removeEventListener("DOMContentLoaded", on_page_change, false);
        // Remove UI
        if (panel.parentNode) {
            panel.parentNode.removeChild(panel);
        }
    }, win);

    return panel;
};


/* Should be called once for each window of the browser */
var insert_code = function (win) {
    "use strict";
    var uri;

    // Add stylesheet
    // TODO - can we build an nsIURI directly from a resource:// URL to avoid
    //        needing to have a chrome.manifest with a skin in it?
    uri = Services.io.newURI("chrome://sixornot/skin/toolbar.css", null, null);
    win.QueryInterface(Components.interfaces.nsIInterfaceRequestor).
        getInterface(Components.interfaces.nsIDOMWindowUtils).loadSheet(uri, 1);

    // Create address bar icon
    log("Sixornot - insert_code: add addressicon", 1);
    create_addressbaricon(win);

    // UI only required for pre-Australis browsers
    if (!CustomizableUIAvailable) {
        /* On pre-Australis platforms the panel for customisation of the toolbars
         * is a different XUL document. We need to inject our CSS modifications
         * into this document each time it is loaded */
        var injectStyleSheet = function (evt) {
            //var doc = evt.originalTarget;
            //log("Sixornot --- page load into iframe", 1);
            //log("Sixornot --- docURI: " + doc.documentURI, 1);
            var win = evt.originalTarget.defaultView;
            win.QueryInterface(Components.interfaces.nsIInterfaceRequestor).
                getInterface(Components.interfaces.nsIDOMWindowUtils).loadSheet(uri, 1);
            log("Sixornot --- loaded stylesheet into toolbar customizer", 1);
        };
        var iframe = win.document.getElementById("customizeToolbarSheetIFrame");
        iframe.addEventListener('load', injectStyleSheet, true); 
        //var panel = win.document.getElementById("customizeToolbarSheetPopup");
        //panel.addEventListener("popupshown", temp2, false);

        log("Sixornot - insert_code: add legacy button", 1);
        // Create legacy button (only for non-Australis browsers)
        create_legacy_button(win);
    }

    unload(function () {
        log("Sixornot - stylesheet unload function", 2);
        win.QueryInterface(Components.interfaces.nsIInterfaceRequestor).
            getInterface(Components.interfaces.nsIDOMWindowUtils).removeSheet(uri, 1);

        iframe.removeEventListener("load", injectStyleSheet, true);
    }, win);
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
    // This doesn't update the tooltip, if preferences are moved into the tooltip then it should
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





    // TODO

// Warnings
// TODO add this to the panel before the rows
/* if (dns_handler.is_ip6_disabled()) {
    add_warning_line(gt("warn_ip6_disabled"));
} */

// TODO - this needs to be done for each host we lookup
/* if (dns_handler.is_ip4only_domain(host)) {
    add_warning_line(gt("warn_ip4only_domain"));
} */
