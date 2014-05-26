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
/*global gt, log, parse_exception, prefs, dns_handler, windowWatcher, unload, requests */

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

var get_hosts_for_inner_window = function (inner_window) {
    return requests.cache[inner_window]; // May be undefined
};
var get_host_by_hostname_from_inner_window = function (inner_window, hostname) {
    var matching_hosts, hosts = requests.cache[inner_window];
    if (hosts) {
        matching_hosts = hosts.filter(function (item) {
            return item.host === hostname;
        });
        if (matching_hosts.length > 0) {
            return matching_hosts[0];
        }
    }
    return undefined;
};

// Utility functions (move into own module?)
var open_preferences = function () {
    var currentWindow, currentBrowser, e;
    // Add tab to most recent window, regardless of where this function was called from
    try {
        currentWindow = Services.wm.getMostRecentWindow("navigator:browser");
        currentWindow.focus();
        if (currentWindow.toEM) {
            currentWindow.toEM("addons://detail/sixornot@entropy.me.uk");
        } else if (currentWindow.BrowserOpenAddonsMgr) {
            currentWindow.BrowserOpenAddonsMgr("addons://detail/sixornot@entropy.me.uk");
        } else {
            currentBrowser = currentWindow.getBrowser();
            currentBrowser.selectedTab = currentBrowser.addTab("about:addons");
        }
    } catch (e) {
        Components.utils.reportError(e);
    }
};
var open_hyperlink = function (link) {
    var currentWindow, currentBrowser, e;
    // Add tab to most recent window, regardless of where this function was called from
    try {
        currentWindow = Services.wm.getMostRecentWindow("navigator:browser");
        currentWindow.focus();
        currentBrowser = currentWindow.getBrowser();
        currentBrowser.selectedTab = currentBrowser.addTab(link);
    } catch (e) {
        Components.utils.reportError(e);
    }
};
var copy_to_clipboard = function (text) {
    var e;
    log("Sixornot - copy_to_clipboard: '" + text + "'", 2);
    try {
        Components.classes["@mozilla.org/widget/clipboardhelper;1"]
            .getService(Components.interfaces.nsIClipboardHelper)
            .copyString(text);
    } catch (e) {
        Components.utils.reportError(e);
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

var create_local_address_info = function () {
    var on_returned_ips, dns_cancel, new_local_host_info;
    dns_cancel = null;
    new_local_host_info = function () {
        return {
            ipv4s          : [],
            ipv6s          : [],
            host           : "",
            address        : "",
            address_family : 0,
            show_detail    : true,
            dns_status     : "pending"
        };
    };
    on_returned_ips = function (ips, callback) {
        var local_host_info = new_local_host_info();
        log("Sixornot - panel:local_address_info:on_returned_ips - ips: " + ips, 1);
        local_dns_cancel = null;
        local_host_info.host = dns_handler.get_local_hostname();
        if (ips[0] === "FAIL") {
            local_host_info.dns_status = "failure";
        } else {
            if (prefs.get_bool("showallips")) {
                local_host_info.ipv6s = ips.filter(dns_handler.is_ip6);
                local_host_info.ipv4s = ips.filter(dns_handler.is_ip4);
            } else {
                local_host_info.ipv6s = ips.filter(function (addr) {
                    return (dns_handler.is_ip6(addr)
                        && ["6to4", "teredo", "global"]
                            .indexOf(dns_handler.typeof_ip6(addr)) != -1);
                });
                local_host_info.ipv4s = ips.filter(function (addr) {
                    return (dns_handler.is_ip4(addr)
                        && ["rfc1918", "6to4relay", "global"]
                            .indexOf(dns_handler.typeof_ip4(addr)) != -1);
                });
            }
            local_host_info.dns_status = "complete";
        }

        callback(local_host_info);
    };
    return {
        get_local_host_info: function (callback) {
            this.cancel();
            dns_cancel = dns_handler.resolve_local_async(function (ips) {
                on_returned_ips(ips, callback);
            });
        },
        cancel: function () {
            if (dns_cancel) {
                dns_cancel.cancel();
            }
        }
    };
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
var update_node_icon_for_host = function (node, host_record) {
    var new_icon_class = get_icon_class(host_record);
    if (!node.classList.contains(new_icon_class)) {
        remove_sixornot_classes_from(node);
        add_class_to_node(new_icon_class, node);
    }
};
var add_greyscale_class_to_node = function (node) {
    node.classList.add("sixornot_grey");
};
var remove_greyscale_class_from_node = function (node) {
    node.classList.remove("sixornot_grey");
};

var create_current_tab_ids = function (win) {
    return {
        inner: 0,
        outer: 0,
        set: function () {
            var domWindow, domWindowUtils;
            domWindow  = win.gBrowser.mCurrentBrowser.contentWindow;
            domWindowUtils = domWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                .getInterface(Components.interfaces.nsIDOMWindowUtils);

            this.inner = domWindowUtils.currentInnerWindowID;
            this.outer = domWindowUtils.outerWindowID;
        }
    };
};

// Create widget which handles shared logic between button/addresbar icon
var create_sixornot_widget = function (node, win) {
    var panel, current_tab_ids,
        update_icon_for_node,
        on_click, on_page_change, on_tab_select,
        on_pageshow, on_dns_complete;

    current_tab_ids = create_current_tab_ids(win);

    // Change icon via class (icon set via stylesheet)
    update_icon_for_node = function (node) {
        var hosts = requests.cache[current_tab_ids.inner];

        /* Parse array searching for the main host (which matches the current location) */
        if (!hosts || !hosts.some(function (item, index, items) {
            if (item.host === win.content.document.location.hostname) {
                update_node_icon_for_host(node, item);
                return true;
            }
        })) {
            // No matching entry for main host (probably a local file)
            remove_sixornot_classes_from(node);
            add_class_to_node("sixornot_other", node);
        }
    };

    on_click = function () {
        panel.setAttribute("hidden", false);
        panel.openPopup(node, panel.getAttribute("position"), 0, 0, false, false);
    };

    on_tab_select = function (evt) {
        log("Sixornot - widget:on_tab_select", 2);
        current_tab_ids.set();
        update_icon_for_node(node);
    };

    on_pageshow = function (evt) {
        log("Sixornot - widget:on_pageshow", 2);
        current_tab_ids.set();
        update_icon_for_node(node);
    };

    /* Called whenever a Sixornot page change event is emitted */
    on_page_change = function (evt) {
        log("Sixornot - widget:on_page_change - evt.detail.outer_id: " + evt.detail.outer_id + ", evt.detail.inner_id: " + evt.detail.inner_id + ", current_tab_ids.outer: " + current_tab_ids.outer + ", current_tab_ids.inner: " + current_tab_ids.inner, 1);
        current_tab_ids.set();
        if (evt.detail.outer_id === current_tab_ids.outer) {
            update_icon_for_node(node);
        }
    };

    /* Called whenever a Sixornot dns lookup event is heard */
    on_dns_complete = function (evt) {
        log("Sixornot - widget:on_dns_complete - evt.detail.outer_id: " + evt.detail.outer_id + ", evt.detail.inner_id: " + evt.detail.inner_id + ", current_tab_ids.outer: " + current_tab_ids.outer + ", current_tab_ids.inner: " + current_tab_ids.inner, 1);
        current_tab_ids.set();
        if (evt.detail.outer_id === current_tab_ids.outer) {
            update_icon_for_node(node);
        }
    };

    /* Create a panel to show details when clicked */
    panel = create_panel(win, node.id + "-panel");
    node.appendChild(panel);

    // Ensure tab ID is set upon loading into window
    current_tab_ids.set();

    // Update greyscale property + icon
    if (prefs.get_bool("greyscaleicons")) {
        add_greyscale_class_to_node(node);
    } else {
        remove_greyscale_class_from_node(node);
    }
    update_icon_for_node(node);

    /* Add event listeners */
    node.addEventListener("click", on_click, false);
    win.addEventListener("sixornot-page-change-event", on_page_change, false);
    win.addEventListener("sixornot-dns-lookup-event", on_dns_complete, false);
    win.gBrowser.tabContainer.addEventListener("TabSelect", on_tab_select, false);
    win.gBrowser.addEventListener("pageshow", on_pageshow, false);

    unload(function () {
        log("Sixornot - widget unload function", 2);
        /* Clear event handlers */
        // win.removeEventListener("offline", onChangedOnlineStatus, false); TODO
        // win.removeEventListener("online", onChangedOnlineStatus, false); TODO
        node.removeEventListener("click", on_click, false);
        win.removeEventListener("sixornot-page-change-event", on_page_change, false);
        win.removeEventListener("sixornot-dns-lookup-event", on_dns_complete, false);
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
        log("Sixornot - insert_code:create_button:customize_handler", 2);
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

var panel_ui = {
    create_ips: function (doc, addto, host) {
        var update, address_box;
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
                conipaddr.setAttribute("tooltiptext", gt("tt_copyaddr"));
                conipaddr.classList.add("sixornot-link");
            } else if (host.address_family === 4) {
                conipaddr.setAttribute("value", host.address);
                conipaddr.sixornot_copytext = host.address;
                conipaddr.setAttribute("tooltiptext", gt("tt_copyaddr"));
                conipaddr.classList.add("sixornot-link");
            } else if (host.address_family === 2) {
                conipaddr.setAttribute("value", gt("addr_cached"));
                conipaddr.sixornot_copytext = "";
            } else {
                conipaddr.setAttribute("value", gt("addr_unavailable"));
                conipaddr.sixornot_copytext = "";
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
                        detailaddr.setAttribute("tooltiptext", gt("tt_copyaddr"));
                        detailaddr.classList.add("sixornot-link");
                        detailaddr.sixornot_host = host.host;
                        address_box.appendChild(detailaddr);
                    }
                });
                host.ipv4s.forEach(function (address, index, addresses) {
                    if (address !== host.address) {
                        var detailaddr = doc.createElement("label");
                        detailaddr.setAttribute("value", address);
                        detailaddr.sixornot_copytext = address;
                        detailaddr.setAttribute("tooltiptext", gt("tt_copyaddr"));
                        detailaddr.classList.add("sixornot-link");
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
    },
    create_showhide: function (doc, addto, host) {
        var showhide, update;

        /* Create DOM UI elements */
        showhide = doc.createElement("label");
        showhide.setAttribute("value", "");

        showhide.sixornot_host = host.host;
        showhide.sixornot_showhide = true;
        showhide.classList.add("sixornot-link");

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
    },
    create_icon: function (doc, addto, host) {
        var icon, update;
        /* Create DOM UI elements */
        icon = doc.createElement("image");
        icon.setAttribute("width", "16");
        icon.setAttribute("height", "16");
        update = function () {
            update_node_icon_for_host(icon, host);
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
    },
    create_count: function (doc, addto, host) {
        var count, update;
        /* Create DOM UI elements */
        count = doc.createElement("label");

        count.setAttribute("tooltiptext", gt("tt_copycount"));
        update = function () {
            if (host.count > 0) {
                count.setAttribute("value", "(" + host.count + ")");
            } else {
                count.setAttribute("value", "");
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
    },
    create_hostname: function (doc, addto, host) {
        var hostname, update;
        /* Create DOM UI elements */
        hostname = doc.createElement("label");
        hostname.setAttribute("value", host.host);
        if (host.host === doc.defaultView.content.document.location.hostname) {
            hostname.classList.add("sixornot-bold");
        } else {
            hostname.classList.remove("sixornot-bold");
        }

        hostname.setAttribute("tooltiptext", gt("tt_copydomclip"));
        update = function () {
            var text = host.host;
            if (host.address !== "") {
                text = text + "," + host.address;
            }
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
            hostname.classList.add("sixornot-link");
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
    },
    create_local_listing_row: function (doc, addafter, host_info) {
        var row = doc.createElement("row");
        row.setAttribute("align", "start");
        var update_row_visibility = function () {
            if (prefs.get_bool("showlocal")) {
                row.classList.remove("sixornot-invisible");
            } else {
                row.classList.add("sixornot-invisible");
            }
        };
        update_row_visibility();
        /* Add this element after the last one */
        addafter.add_after(row);
        row.appendChild(doc.createElement("label"));
        row.appendChild(doc.createElement("label"));

        return {
            host_info: host_info,
            hostname: panel_ui.create_hostname(doc, row, host_info),
            ips: panel_ui.create_ips(doc, row, host_info),
            remove: function () {
                this.hostname.remove();
                this.ips.remove();
                row.parentNode.removeChild(row);
            },
            /* Adds the contents of this object after the specified element */
            add_after: function (element) {
                if (this.row.nextSibling) {
                    this.row.parentNode.insertBefore(element, this.row.nextSibling);
                } else {
                    this.row.parentNode.appendChild(element);
                }
            },
            update_visibility: function () {
                update_row_visibility();
            }
        };
    },
    /* Object representing one host entry in the panel
       Takes a reference to a member of the request cache as argument
       and links to that member to reflect its state
       Also takes a reference to the element to add this element after
       e.g. header or the preceeding list item */
    create_remote_listing_row: function (doc, addafter, host) {
        var row = doc.createElement("row");
        row.setAttribute("align", "start");
        /* Add this element after the last one */
        addafter.add_after(row);

        /* Object representing row of entry */
        return {
            host: host,
            icon: panel_ui.create_icon(doc, row, host),
            count: panel_ui.create_count(doc, row, host),
            hostname: panel_ui.create_hostname(doc, row, host),
            ips: panel_ui.create_ips(doc, row, host),
            showhide: panel_ui.create_showhide(doc, row, host),
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
            },
            update_ips: function () {
                // TODO optimisation - only update DNS IPs
                this.ips.update();
                this.showhide.update();
                this.icon.update();
            },
            update_address: function () {
                // TODO optimisation - only update connection IP
                this.ips.update();
                this.icon.update();
            },
            update_count: function () {
                this.count.update();
            }
        };
    },
    create_remote_anchor: function (doc, parent_element) {
        // Add "Remote" title
        var title_remote = doc.createElement("label");
        title_remote.setAttribute("value", gt("header_remote"));
        title_remote.classList.add("sixornot-title");
        parent_element.appendChild(title_remote);
        return {
            entries: [],
            add_after: function (element) {
                if (title_remote.nextSibling) {
                    parent_element.insertBefore(element, title_remote.nextSibling);
                } else {
                    parent_element.appendChild(element);
                }
            },
            remove_all_entries: function () {
                log("Sixornot - remote_anchor:remove_all_entries", 2);
                this.entries.forEach(function (item, index, items) {
                    try {
                        item.remove();
                    } catch (e) {
                        Components.utils.reportError(e);
                    }
                });
                this.entries = [];
            },
            generate_entries_for_hosts: function (hosts) {
                log("Sixornot - remote_anchor:generate_entries_for_hosts: " + hosts, 2);
                // In this case we're on a page which has no cached info
                if (hosts === undefined) {
                    // TODO - Add logic here to display useful messages for other pages
                    // TODO - If we're on a page which we have no cached data for, but which has
                    //        a domain, do DNS lookups and add data to cache etc. (fallback behaviour)
                } else {
                    hosts.forEach(function (host) {
                        this.generate_entry_for_host(host);
                        /*if (this.entries.length > 0) {
                            this.entries.push(panel_ui.create_remote_listing_row(doc, 
                                this.entries[this.entries.length - 1], host));
                        } else {
                            this.entries.push(panel_ui.create_remote_listing_row(doc, this, host));
                        }*/
                    }, this);
                }
            },
            generate_entry_for_host: function (host) {
                log("Sixornot - remote_anchor:generate_entry_for_host: " + host, 2);
                // TODO put this in the right position based on some ordering
                if (this.entries.length > 0) {
                    if (!this.entries.some(function (item) {
                        // TODO - this shouldn't be able to happen!
                        // If item is already in the array, don't add a duplicate
                        // Just update the existing one instead
                        if (item.host.host === host.host) {
                            log("Adding duplicate!!", 1);
                            item.update_address();
                            item.update_ips();
                            item.update_count();
                            return true;
                        }
                    })) {
                        // Add new entry
                        this.entries.push(panel_ui.create_remote_listing_row(doc, 
                            this.entries[this.entries.length - 1], host));
                    }
                } else {
                    // Push first item onto grid
                    this.entries.push(panel_ui.create_remote_listing_row(doc, this, host));
                }
            },
            update_address_for_host: function (host_name) {
                if (!this.entries.some(function (item, index, items) {
                    if (item.host.host === host_name) {
                        item.update_address();
                        return true;
                    }
                })) {
                    log("Sixornot - remote_anchor:update_address_for_host - host matching '" + host_name + "' not found in entries", 1);
                }
            },
            update_count_for_host: function (host_name) {
                if (!this.entries.some(function (item, index, items) {
                    if (item.host.host === host_name) {
                        item.update_count();
                        return true;
                    }
                })) {
                    log("Sixornot - remote_anchor:update_count_for_host - host matching '" + host_name + "' not found in entries", 1);
                }
            },
            update_ips_for_host: function (host_name) {
                if (!this.entries.some(function (item, index, items) {
                    if (item.host.host === host_name) {
                        item.update_ips();
                        return true;
                    }
                })) {
                    log("Sixornot - remote_anchor:update_ips_for_host - host matching '" + host_name + "' not found in entries", 1);
                }
            },
            toggle_detail_for_host: function (host_name) {
                if (!this.entries.some(function (item, index, items) {
                    if (item.host.host === host_name) {
                        item.host.show_detail = !item.host.show_detail;
                        item.update_ips();
                        return true;
                    }
                })) {
                    log("Sixornot - remote_anchor:toggle_detail_for_host - host matching '" + host_name + "' not found in entries", 1);
                }
            }
        };
    },
    create_local_anchor: function (doc, parent_element) {
        // Add "Local" title (TODO - replace with element with "hide" method)
        var title_local = doc.createElement("label");
        title_local.setAttribute("value", gt("header_local"));
        title_local.classList.add("sixornot-title");
        var make_spacer = function () {
            var spacer = doc.createElement("spacer");
            spacer.setAttribute("flex", "1");
            return spacer;
        };
        var showhide_local = doc.createElement("label");
        showhide_local.classList.add("sixornot-title");
        showhide_local.classList.add("sixornot-link");
        showhide_local.sixornot_showhide_local = true;
        var showhide_spacer = doc.createElement("label");
        showhide_spacer.classList.add("sixornot-title");
        showhide_spacer.classList.add("sixornot-hidden");
        var set_showhide_text = function () {
            if (prefs.get_bool("showlocal")) {
                showhide_local.setAttribute("value", "[" + gt("hide_text") + "]");
                showhide_spacer.setAttribute("value", "[" + gt("hide_text") + "]");
            } else {
                showhide_local.setAttribute("value", "[" + gt("show_text") + "]");
                showhide_spacer.setAttribute("value", "[" + gt("hide_text") + "]");
            }
        };
        set_showhide_text();
        var hbox = doc.createElement("hbox");
        hbox.appendChild(showhide_spacer);
        hbox.appendChild(make_spacer());
        hbox.appendChild(title_local);
        hbox.appendChild(make_spacer());
        hbox.appendChild(showhide_local);
        hbox.setAttribute("align", "center");
        parent_element.appendChild(hbox);
        return {
            entries: [],
            add_after: function (element) {
                if (hbox.nextSibling) {
                    parent_element.insertBefore(element, hbox.nextSibling);
                } else {
                    parent_element.appendChild(element);
                }
            },
            remove_all_entries: function () {
                log("Sixornot - panel:local_anchor:remove_all_entries", 2);
                this.entries.forEach(function (item) {
                    item.remove();
                });
                this.entries = [];
            },
            generate_entry_for_host: function (host_info) {
                log("Sixornot - panel:local_anchor:generate_entry_for_host", 2);
                this.entries.push(panel_ui.create_local_listing_row(doc, this, host_info));
            },
            toggle_local_address_display: function () {
                // Toggle preference setting
                prefs.set_bool("showlocal", !prefs.get_bool("showlocal"));
                this.update_local_address_display();
            },
            update_local_address_display: function () {
                // Update display to match preference setting
                set_showhide_text();
                this.entries.forEach(function (item) {
                    item.update_visibility();
                });
            }
        };
    },
    create_panel_links: function (doc, parent_element) {
        var settingslabel, urllabel, spacer, urlhbox,
            make_spacer;
        // Settings link
        settingslabel = doc.createElement("label");
        settingslabel.setAttribute("value", gt("header_settings"));
        settingslabel.setAttribute("tooltiptext", gt("tt_open_settings"));
        settingslabel.classList.add("sixornot-link");
        settingslabel.classList.add("sixornot-title");
        settingslabel.sixornot_openprefs = true;

        urllabel = doc.createElement("label");
        urllabel.setAttribute("value", gt("sixornot_documentation"));
        urllabel.classList.add("sixornot-link");
        urllabel.classList.add("sixornot-title");
        urllabel.sixornot_hyperlink = gt("sixornot_weblink");
        urllabel.setAttribute("tooltiptext", gt("tt_gotowebsite"));

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
        urlhbox.appendChild(settingslabel);
        urlhbox.appendChild(spacer);
        urlhbox.appendChild(urllabel);
        urlhbox.appendChild(make_spacer());
        urlhbox.setAttribute("align", "center");
        parent_element.appendChild(urlhbox);
    }
};

/* Creates and sets up a panel to display information which can then be bound to an icon */
var create_panel = function (win, panel_id) {
    var doc, panel, register_callbacks, unregister_callbacks,
    panel_vbox, grid, grid_rows, grid_cols,
    remote_anchor, local_anchor,
    force_scrollbars, current_tab_ids, local_address_info,
    on_click, on_popupshowing, on_popuphiding, on_page_change,
    on_new_host, on_address_change, on_pageshow,
    on_count_change, on_dns_complete, on_tab_select;

    doc = win.document;
    current_tab_ids = create_current_tab_ids(win);
    local_address_info = create_local_address_info();

    /* Ensure panel contents visible with scrollbars */
    force_scrollbars = function () {
        if (panel_vbox.clientHeight > panel.clientHeight) {
            panel_vbox.setAttribute("maxheight", panel.clientHeight - 50);
            // TODO if panel width changes after this is applied horizontal fit breaks
            //panel.setAttribute("minwidth", panel_vbox.clientWidth + 40);
        }
    };

    /* Event handlers */

    unregister_callbacks = function () {
        win.removeEventListener("sixornot-page-change-event", on_page_change, false);
        win.removeEventListener("sixornot-new-host-event", on_new_host, false);
        win.removeEventListener("sixornot-address-change-event", on_address_change, false);
        win.removeEventListener("sixornot-count-change-event", on_count_change, false);
        win.removeEventListener("sixornot-dns-lookup-event", on_dns_complete, false);
        win.gBrowser.tabContainer.removeEventListener("TabSelect", on_tab_select, false);
        win.gBrowser.removeEventListener("pageshow", on_pageshow, false);
    };
    register_callbacks = function () {
        win.addEventListener("sixornot-page-change-event", on_page_change, false);
        win.addEventListener("sixornot-new-host-event", on_new_host, false);
        win.addEventListener("sixornot-address-change-event", on_address_change, false);
        win.addEventListener("sixornot-count-change-event", on_count_change, false);
        win.addEventListener("sixornot-dns-lookup-event", on_dns_complete, false);
        win.gBrowser.tabContainer.addEventListener("TabSelect", on_tab_select, false);
        win.gBrowser.addEventListener("pageshow", on_pageshow, false);
    };

    on_popupshowing = function (evt) {
        log("Sixornot - panel:on_popupshowing", 2);
        register_callbacks();
        current_tab_ids.set();

        remote_anchor.remove_all_entries();
        remote_anchor.generate_entries_for_hosts(
            get_hosts_for_inner_window(current_tab_ids.inner));

        local_anchor.update_local_address_display();
        local_address_info.get_local_host_info(function (host_info) {
            local_anchor.remove_all_entries();
            local_anchor.generate_entry_for_host(host_info);
        });
    };

    on_popuphiding = function (evt) {
        log("Sixornot - panel:on_popuphiding", 2);
        unregister_callbacks();
        local_address_info.cancel();
    };

    /* Actions are defined by custom properties applied to the event target element
       One or more of these can be triggered */
    on_click = function (evt) {
        log("Sixornot - panel:on_click", 1);
        /* If element has sixornot_copytext, then copy it to clipboard */
        if (evt.target.sixornot_copytext) {
            log("Sixornot - panel:on_click - sixornot_copytext", 2);
            copy_to_clipboard(evt.target.sixornot_copytext);
            evt.stopPropagation();
        }
        /* If element has show/hide behaviour, toggle and trigger refresh */
        if (evt.target.sixornot_showhide) {
            log("Sixornot - panel:on_click - showhide", 2);
            remote_anchor.toggle_detail_for_host(evt.target.sixornot_host);
            evt.stopPropagation();
        }
        /* Toggle local address display */
        if (evt.target.sixornot_showhide_local) {
            log("Sixornot - panel:on_click - showhide_local", 2);
            local_anchor.toggle_local_address_display();
            evt.stopPropagation();
        }
        /* Element should open preferences when clicked */
        if (evt.target.sixornot_openprefs) {
            log("Sixornot - panel:on_click - openprefs", 2);
            panel.hidePopup();
            open_preferences();
            evt.stopPropagation();
        }
        /* Element should open hyperlink when clicked */
        if (evt.target.sixornot_hyperlink) {
            log("Sixornot - panel:on_click - open hyperlink", 2);
            panel.hidePopup();
            open_hyperlink(evt.target.sixornot_hyperlink);
            evt.stopPropagation();
        }
    };

    on_page_change = function (evt) {
        log("Sixornot - panel:on_page_change - evt.detail: " + JSON.stringify(evt.detail) + ", current_tab_ids.outer: " + current_tab_ids.outer + ", current_tab_ids.inner: " + current_tab_ids.inner, 2);

        if (evt.detail.outer_id !== current_tab_ids.outer) {
            log("Sixornot - on_page_change - skipping (outer ID mismatch)", 2);
            return;
        }
        current_tab_ids.set();
        if (evt.detail.inner_id !== current_tab_ids.inner) {
            log("Sixornot - on_page_change - skipping (inner ID mismatch)", 2);
            return;
        }
        remote_anchor.remove_all_entries();
        remote_anchor.generate_entries_for_hosts(
            get_hosts_for_inner_window(current_tab_ids.inner));
        force_scrollbars();
    };

    on_new_host = function (evt) {
        log("Sixornot - panel:on_new_host - evt.detail: " + JSON.stringify(evt.detail) + ", current_tab_ids.outer: " + current_tab_ids.outer + ", current_tab_ids.inner: " + current_tab_ids.inner, 2);

        if (evt.detail.inner_id !== current_tab_ids.inner) {
            log("Sixornot - on_new_host - skipping (inner ID mismatch)", 2);
            return;
        }

        var host = get_host_by_hostname_from_inner_window(current_tab_ids.inner, evt.detail.host);
        if (host) {
            remote_anchor.generate_entry_for_host(host);
            force_scrollbars();
        }
    };

    on_address_change = function (evt) {
        log("Sixornot - panel:on_address_change - evt.detail: " + JSON.stringify(evt.detail) + ", current_tab_ids.outer: " + current_tab_ids.outer + ", current_tab_ids.inner: " + current_tab_ids.inner, 1);

        if (evt.detail.inner_id !== current_tab_ids.inner) {
            log("Sixornot - on_address_change - skipping (inner ID mismatch)", 2);
            return;
        }
        remote_anchor.update_address_for_host(evt.detail.host)
    };

    on_count_change = function (evt) {
        log("Sixornot - panel:on_count_change - evt.detail: " + JSON.stringify(evt.detail) + ", current_tab_ids.outer: " + current_tab_ids.outer + ", current_tab_ids.inner: " + current_tab_ids.inner, 2);

        if (evt.detail.inner_id !== current_tab_ids.inner) {
            log("Sixornot - on_count_change - skipping (inner ID mismatch)", 2);
            return;
        }
        remote_anchor.update_count_for_host(evt.detail.host)
    };

    on_dns_complete = function (evt) {
        log("Sixornot - panel:on_dns_complete - evt.detail: " + JSON.stringify(evt.detail) + ", current_tab_ids.outer: " + current_tab_ids.outer + ", current_tab_ids.inner: " + current_tab_ids.inner, 2);

        if (evt.detail.inner_id !== current_tab_ids.inner) {
            log("Sixornot - on_dns_complete - skipping (inner ID mismatch)", 2);
            return;
        }
        remote_anchor.update_ips_for_host(evt.detail.host)
        // TODO optimisation - this only needs to be called if the height is changed (e.g. if showing full detail for this host)
        force_scrollbars();
    };

    on_tab_select = function (evt) {
        log("Sixornot - panel:on_tab_select", 1);
        current_tab_ids.set();
        remote_anchor.remove_all_entries();
        remote_anchor.generate_entries_for_hosts(
            get_hosts_for_inner_window(current_tab_ids.inner));
        force_scrollbars();
    };

    on_pageshow = function (evt) {
        log("Sixornot - panel:on_pageshow", 1);
        current_tab_ids.set();
        remote_anchor.remove_all_entries();
        remote_anchor.generate_entries_for_hosts(
            get_hosts_for_inner_window(current_tab_ids.inner));
        force_scrollbars();
    };

    // Panel setup
    panel = doc.createElement("panel");
    panel.setAttribute("type", "arrow");
    panel.setAttribute("id", panel_id);
    panel.setAttribute("hidden", true);
    panel.setAttribute("position", "bottomcenter topright");
    panel.classList.add("sixornot-panel");

    // This contains everything else in the panel, vertical orientation
    panel_vbox = doc.createElement("vbox");
    panel_vbox.setAttribute("flex", "1");
    panel_vbox.style.overflowY = "auto";
    panel_vbox.style.overflowX = "hidden";
    panel.appendChild(panel_vbox);

    // Build containing panel UI
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

    remote_anchor = panel_ui.create_remote_anchor(doc, grid_rows);
    local_anchor = panel_ui.create_local_anchor(doc, grid_rows);
    panel_ui.create_panel_links(doc, grid_rows);

    panel.addEventListener("click", on_click, false);
    panel.addEventListener("popupshowing", on_popupshowing, false);
    panel.addEventListener("popuphiding", on_popuphiding, false);

    unload(function () {
        log("Sixornot - Unload panel", 2);
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


var get_os = function () {
    // Returns "WINNT" on Windows Vista, XP, 2000, and NT systems;  
    // "Linux" on GNU/Linux; and "Darwin" on Mac OS X.  
    return Components.classes["@mozilla.org/xre/app-info;1"]  
            .getService(Components.interfaces.nsIXULRuntime).OS;  
};

var get_application = function () {
    const FIREFOX_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
    const SEAMONKEY_ID = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";
    var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                    .getService(Components.interfaces.nsIXULAppInfo);
    if(appInfo.ID == FIREFOX_ID) {
        return "firefox";
    } else if(appInfo.ID == SEAMONKEY_ID) {
        return "seamonkey";
    }
};

var stylesheets = {
    base: Services.io.newURI("resource://sixornot/css/base.css", null, null),
    large: Services.io.newURI("resource://sixornot/css/large.css", null, null),
    customize: Services.io.newURI("resource://sixornot/css/customize.css", null, null),
    customize_ffp29: Services.io.newURI("resource://sixornot/css/customize_pre29.css", null, null),
    customize_ffp29_linux: Services.io.newURI("resource://sixornot/css/customize_pre29_linux.css", null, null)
};

var inject_stylesheet_into_window = function (win, sheet) {
    log("Sixornot - injecting stylesheet: '" + sheet.prePath + sheet.path + "' into window: '" + win.name + "'", 2);
    win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIDOMWindowUtils).loadSheet(sheet, 1);
};
var remove_stylesheet_from_window = function (win, sheet) {
    log("Sixornot - removing stylesheet: '" + sheet.prePath + sheet.path + "' from window: '" + win.name + "'", 2);
    win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIDOMWindowUtils).removeSheet(sheet, 1);
};
var inject_stylesheet_into_window_with_unload = function (win, sheet) {
    inject_stylesheet_into_window(win, sheet);

    unload(function () {
        remove_stylesheet_from_window(win, sheet);
    }, win);
};


/* Should be called once for each window of the browser */
var insert_code = function (win) {
    "use strict";
    // Add stylesheet
    inject_stylesheet_into_window_with_unload(win, stylesheets.base);

    // Create address bar icon
    log("Sixornot - insert_code: add addressicon", 1);
    create_addressbaricon(win);

    // UI only required for pre-Australis browsers
    if (CustomizableUIAvailable) {
        // Australis, load normal customization sheet too
        inject_stylesheet_into_window_with_unload(win, stylesheets.customize);
    } else {
        var customize_sheet = stylesheets.customize;
        // Detect application and OS
        // Firefox pre-Australis needs a different sheet loaded into customize panel
        if (get_application() === "firefox") {
            customize_sheet = stylesheets.customize_ffp29;
        }
        if (get_os() === "Linux") {
            customize_sheet = stylesheets.customize_ffp29_linux;
        }
        // SeaMonkey and Linux FF need large icon sets
        if (get_application() === "seamonkey" || get_os() === "Linux") {
            inject_stylesheet_into_window_with_unload(win, stylesheets.large);
        }
        var on_beforecustomization = function (evt) {
            log("Sixornot - on_beforecustomization", 1);
            /* On pre-Australis platforms the panel for customisation of the toolbars
             * is a different XUL document. We need to inject our CSS modifications
             * into this document each time it is loaded */
            var iframe = win.document.getElementById("customizeToolbarSheetIFrame");
            if (iframe) {
                log("Sixornot - found customizeToolbarSheetIFrame - adding load callback", 1);
                inject_stylesheet_into_window(iframe.contentWindow, customize_sheet);
            } else {
                log("Sixornot - failed to find customizeToolbarSheetIFrame", 1);
            }
        };
        var on_aftercustomization = function (evt) {
            log("Sixornot - on_aftercustomization", 1);
            var iframe = win.document.getElementById("customizeToolbarSheetIFrame");
            if (iframe) {
                log("Sixornot - on_aftercustomization - found customizeToolbarSheetIFrame", 1);
                remove_stylesheet_from_window(iframe.contentWindow, customize_sheet);
            } else {
                log("Sixornot - on_aftercustomization - failed to find customizeToolbarSheetIFrame", 1);
            }
        };

        // TODO - this needs to happen once on startup, not every time a window is opened
        var newWindow = function (subject, topic) {
            if (topic === "domwindowopened") {
                var win = subject.QueryInterface(Components.interfaces.nsIDOMWindow);
                if (win.document.readyState === "complete") {
                    if (win.document.documentURI === "chrome://global/content/customizeToolbar.xul") {
                        inject_stylesheet_into_window(win, customize_sheet);
                    }
                } else {
                    win.addEventListener("load", function load_once () {
                        win.removeEventListener("load", load_once, false);
                        if (win.document.documentURI === "chrome://global/content/customizeToolbar.xul") {
                            inject_stylesheet_into_window(win, customize_sheet);
                        }
                    });
                }
            }
        };

        win.addEventListener("beforecustomization", on_beforecustomization, false);
        win.addEventListener("aftercustomization", on_aftercustomization, false);
        Services.ww.registerNotification(newWindow);

        unload(function () {
            log("Sixornot - legacy toolbar unload function", 2);
            win.removeEventListener("beforecustomization", on_beforecustomization, false);
            win.removeEventListener("aftercustomization", on_aftercustomization, false);
            Services.ww.unregisterNotification(newWindow);
        }, win);

        log("Sixornot - insert_code: add legacy button", 1);
        // Create legacy button (only for non-Australis browsers)
        create_legacy_button(win);
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
