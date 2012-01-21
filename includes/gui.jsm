/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2008-2012 Timothy Baldock. All Rights Reserved.
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

// Module imports we need
/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");

// Import logging
Components.utils.import("resource://sixornot/includes/logger.jsm");
log("Imported logging", 0);

// Import locale (only used here)
Components.utils.import("resource://sixornot/includes/locale.jsm");
log("Imported locale", 0);

// Import preferences
Components.utils.import("resource://sixornot/includes/prefs.jsm");
log("Imported prefs", 0);

// Import request cache
Components.utils.import("resource://sixornot/includes/requestcache.jsm");
log("Imported requestcache", 0);

// Import imagesrc (only used here)
Components.utils.import("resource://sixornot/includes/imagesrc.jsm");
log("Imported imagesrc", 0);

// Import unload handler (windowWatcher)
Components.utils.import("resource://sixornot/includes/windowwatcher.jsm");
log("Imported windowwatcher", 0);

// Import dns_handler
Components.utils.import("resource://sixornot/includes/dns.jsm");
log("Imported dns", 0);

/*jslint es5: false */

// Module globals
var EXPORTED_SYMBOLS = ["insert_code"];

var PREF_BRANCH_SIXORNOT = Services.prefs.getBranch("extensions.sixornot.");

var NS_XUL          = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

// ID constants
var BUTTON_ID       = "sixornot-buttonid";
var ADDRESS_IMG_ID  = "sixornot-addressimageid";


// var xulRuntime = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime);

/* Proxy to getElementById */
var gbi = function (node, child_id) {
    "use strict";
    if (node.getElementById) {
        return node.getElementById(child_id);
    } else {
        return node.querySelector("#" + child_id);
    }
};


/*
    Core functionality
*/

// insert_code called for each new window via watchWindows
// inserts code into browser
// Listeners which trigger events should occur at the global level above this (e.g. httpeventlistener etc.)



// TODO
/*
    Handle all the same edge cases as before
    Find nice structure for organising the functions
    Move settings into panel
    Add tooltips for panel elements
    Allow expanding of panel items to show full detail for any item
        The main page always shows full details
*/


/* Should be called once for each window of the browser */
var insert_code = function (win) {
    "use strict";
    var doc, create_button, create_addressbaricon, create_panel,
        get_icon_source,
        currentTabInnerID, currentTabOuterID, setCurrentTabIDs,
        getCurrentHost;

    doc = win.document;

    setCurrentTabIDs = function () {
        var domWindow, domWindowUtils;
        log("Sixornot - insert_code:setCurrentTabIDs", 1);
        domWindow  = win.gBrowser.mCurrentBrowser.contentWindow;
        domWindowUtils = domWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                            .getInterface(Components.interfaces.nsIDOMWindowUtils);

        currentTabInnerID = domWindowUtils.currentInnerWindowID;
        currentTabOuterID = domWindowUtils.outerWindowID;
        log("Sixornot - insert_code:setCurrentTabIDs, outer: " + currentTabOuterID + ", inner: " + currentTabInnerID, 1);
    };


    /* Return the host part of the current window's location */
    getCurrentHost = function () {
        return win.content.document.location.hostname;
    };

    /* Creates and sets up a panel to display information which can then be bound to an icon */
    create_panel = function () {
        var panel, on_click, on_mouseover, on_mouseout,
        on_show_panel, on_page_change, on_new_host, on_address_change,
        popstate_handler, pageshow_handler,
        on_count_change, on_dns_complete, on_tab_select,
        panel_vbox, remote_grid, remote_rows, remote_cols, title_remote,
        remote_anchor, title_local, settingslabel, urllabel, urlhbox,
        get_hosts, force_scrollbars, new_line, grid_contents, remove_all,
        generate_all;
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
            var currentWindowID, requestCacheLookup, i;
            // New functionality, get IDs for lookup
            currentWindowID = win.gBrowser.mCurrentBrowser.contentWindow
                .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                .getInterface(Components.interfaces.nsIDOMWindowUtils)
                .currentInnerWindowID;
            requestCacheLookup = requests.cache[currentWindowID];
            log("get_hosts: currentWindowID: " + currentWindowID + ", requestCacheLookup: " + requestCacheLookup, 1);
            log("get_hosts: current requests.cache state is: ", 1);
            for (i = 0; i < requests.cache.length; i += 1) {
                if (requests.cache[i] !== undefined) {
                    log("item #: " + i + ", is: " + requests.cache[i]);
                }
            }
            return requestCacheLookup;
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
                    if (host.host === getCurrentHost()) {
                        // Bold
                        hostname.setAttribute("style", "font-weight: bold;");
                    } else {
                        hostname.setAttribute("style", "font-weight: normal;");
                    }

                    hostname.setAttribute("tooltiptext", gt("tt_copydomclip"));
                    update = function () {
                        // TODO Add real copy text here
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
                header_row: header_row,
                host: host,
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
                    log("exception!" + parse_exception(e), 0);
                }
            });
            grid_contents = [];

        };
        generate_all = function () {
            log("Sixornot - panel:generate_all", 2);
            var hosts = get_hosts();

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
                    log("exception!" + parse_exception(e), 0);
                }
            });
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
                    log("Sixornot - panel:on_click - sixornot_copytext '" + evt.target.sixornot_copytext + "' to clipboard", 1);
                    Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                        .getService(Components.interfaces.nsIClipboardHelper)
                        .copyString(evt.target.sixornot_copytext);
                } catch (e_copytext) {
                    log("exception!" + parse_exception(e_copytext), 0);
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
                    log("exception!" + parse_exception(e_showhide), 0);
                }
            }
            /* Element should open preferences when clicked */
            if (evt.target.sixornot_openprefs) {
                try {
                    evt.stopPropagation();
                    panel.hidePopup();
                    log("Sixornot - panel:on_click - openprefs", 1);
                    // Add tab to most recent window, regardless of where this function was called from
                    currentWindow = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                         .getService(Components.interfaces.nsIWindowMediator)
                         .getMostRecentWindow("navigator:browser");
                    currentWindow.focus();
                    currentBrowser = currentWindow.getBrowser();
                    currentBrowser.selectedTab = currentBrowser.addTab("about:addons");
                    // TODO link should open Sixornot, but this isn't currently possible
                    //currentWindow.getBrowser().contentWindow.wrappedJSObject.loadView("addons://detail/sixornot@entropy.me.uk");
                } catch (e_openprefs) {
                    log("exception!" + parse_exception(e_openprefs), 0);
                }
            }
            /* Element should open hyperlink when clicked */
            if (evt.target.sixornot_hyperlink) {
                try {
                    log("Sixornot - panel:on_click - open hyperlink", 1);
                    evt.stopPropagation();
                    panel.hidePopup();
                    // Add tab to most recent window, regardless of where this function was called from
                    currentWindow = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                         .getService(Components.interfaces.nsIWindowMediator)
                         .getMostRecentWindow("navigator:browser");
                    currentWindow.focus();
                    currentBrowser = currentWindow.getBrowser();
                    currentBrowser.selectedTab = currentBrowser.addTab(evt.target.sixornot_hyperlink);
                } catch (e_hyperlink) {
                    log("exception!" + parse_exception(e_hyperlink), 0);
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
                log("exception!" + parse_exception(e), 0);
            }
            log("Sixornot - panel:on_show_panel - done", 1);
        };

        // On page change
        // Check if tab innerID matches event innerID
        // If so repopulate grid_contents list as per show panel
        on_page_change = function (evt) {
            log("Sixornot - panel:on_page_change", 1);
            if (panel.state !== "open") {
                log("Sixornot - on_page_change - skipping (panel is closed)", 1);
                return;
            }
            if (evt.subject.outer_id !== currentTabOuterID) {
                log("Sixornot - on_page_change - skipping (outer ID mismatch), evt.subject.outer_id: " + evt.subject.outer_id + ", currentTabOuterID: " + currentTabOuterID, 1);
                return;
            }
            setCurrentTabIDs();
            if (evt.subject.inner_id !== currentTabInnerID) {
                log("Sixornot - on_page_change - skipping (inner ID mismatch), evt.subject.inner_id: " + evt.subject.inner_id + ", currentTabInnerID: " + currentTabInnerID, 1);
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
            log("Sixornot - panel:on_new_host", 1);
            if (panel.state !== "open") {
                log("Sixornot - on_new_host - skipping (panel is closed) - panel.state: " + panel.state, 1);
                return;
            }
            if (evt.subject.inner_id !== currentTabInnerID) {
                log("Sixornot - on_new_host - skipping (inner ID mismatch) - evt.subject.inner_id: " + evt.subject.inner_id + ", currentTabInnerID: " + currentTabInnerID, 1);
                return;
            }

            try {
                // TODO put this in the right position based on some ordering
                // TODO since event subject is the host object in question so long as the IDs match we should be ok
                //  to just use that rather than doing this lookup!
                log("Sixornot - on_new_host - evt.subject.host: " + evt.subject.host, 1);
                // For first match for evt.subject.host add a new line
                // Only do so if a matching host does not exist in the listing already TODO
                if (grid_contents.length > 0) {
                    grid_contents.push(new_line(evt.subject, grid_contents[grid_contents.length - 1].get_last_element()));
                } else {
                    grid_contents.push(new_line(evt.subject, remote_anchor));
                }
            } catch (e) {
                log("exception!" + parse_exception(e), 0);
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
            if (panel.state !== "open") {
                log("Sixornot - on_address_change - skipping (panel is closed) - panel.state: " + panel.state, 1);
                return;
            }
            if (evt.subject.inner_id !== currentTabInnerID) {
                log("Sixornot - on_address_change - skipping (inner ID mismatch) - evt.subject.inner_id: " + evt.subject.inner_id + ", currentTabInnerID: " + currentTabInnerID, 1);
                return;
            }
            try {
                if (!grid_contents.some(function (item, index, items) {
                    if (item.host.host === evt.subject.host) {
                        item.update_address();
                        return true;
                    }
                })) {
                        log("Sixornot - on_address_change - matching host not found!", 1);
                }
            } catch (e) {
                log("exception!" + parse_exception(e), 0);
            }
        };

        // On count change
        // Check innerID + mainhost match
        // Look up matching host entry in grid_contents and update its count
        on_count_change = function (evt) {
            log("Sixornot - panel:on_count_change", 1);
            if (panel.state !== "open") {
                log("Sixornot - on_count_change - skipping (panel is closed) - panel.state: " + panel.state, 1);
                return;
            }
            if (evt.subject.inner_id !== currentTabInnerID) {
                log("Sixornot - on_count_change - skipping (inner ID mismatch) - evt.subject.inner_id: " + evt.subject.inner_id + ", currentTabInnerID: " + currentTabInnerID, 1);
                return;
            }
            try {
                if (!grid_contents.some(function (item, index, items) {
                    if (item.host.host === evt.subject.host) {
                        item.update_count();
                        return true;
                    }
                })) {
                        log("Sixornot - on_count_change - matching host not found!", 1);
                }
            } catch (e) {
                log("exception!" + parse_exception(e), 0);
            }
        };

        // On DNS lookup completion event
        // Check innerID + mainhost match
        // Look up matching host entry + call update_ips() which rebuilds the set of addresses
        // Update icon
        on_dns_complete = function (evt) {
            log("Sixornot - panel:on_dns_complete", 1);
            // TODO - unsubscribe from events when panel is closed to avoid this check
            if (panel.state !== "open") {
                log("Sixornot - on_dns_complete - skipping (panel is closed) - panel.state: " + panel.state, 1);
                return;
            }
            if (evt.subject.inner_id !== currentTabInnerID) {
                log("Sixornot - on_dns_complete - skipping (inner ID mismatch) - evt.subject.inner_id: " + evt.subject.inner_id + ", currentTabInnerID: " + currentTabInnerID, 1);
                return;
            }
            try {
                if (!grid_contents.some(function (item, index, items) {
                    if (item.host.host === evt.subject.host) {
                        log("Sixornot - on_dns_complete - updating ips and icon", 1);
                            item.update_ips();
                        return true;
                    }
                })) {
                        log("Sixornot - on_dns_complete - matching host not found!", 1);
                }
            } catch (e) {
                log("exception!" + parse_exception(e), 0);
            }
            // TODO optimisation - this only needs to be called if the height is changed (e.g. if showing this host)
            force_scrollbars();
        };

        // On Tab selection by user
        on_tab_select = function (evt) {
            log("Sixornot - panel:on_tab_select", 1);
            // TODO - unsubscribe from events when panel is closed to avoid this check
            if (panel.state !== "open") {
                log("Sixornot - on_tab_select - skipping (panel is closed) - panel.state: " + panel.state, 1);
                return;
            }
            // This should be done by the icon handler, but just make sure
            setCurrentTabIDs();

            remove_all();
            generate_all();
            force_scrollbars();
        };

        /* popstate event triggered */
        popstate_handler = function (evt) {
            log("Sixornot - insert_code:create_button:popstate_handler", 1);
            // TODO - handle this
        };

        /* pageshow event triggered */
        pageshow_handler = function (evt) {
            log("Sixornot - insert_code:create_button:pageshow_handler", 1);
            // TODO - handle this
        };


        // Panel setup
        panel.setAttribute("type", "arrow");
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
            panel.parentNode.removeChild(panel);
        }, win);

        return panel;
    };

    /* Creates icon button and binds events */
    create_button = function () {
        var toolbarButton, toolbarID, toolbar, nextItem, nextID,
            click_handler, panel, update_icon,
            customize_handler, page_change_handler, tabselect_handler,
            popstate_handler, pageshow_handler;
        log("Sixornot - insert_code:create_button", 2);

        /* Updates the icon to reflect state of the currently displayed page */
        update_icon = function () {
            log("Sixornot - insert_code:create_button:update_icon", 1);
            var hosts = requests.cache[currentTabInnerID];

            if (hosts) {
                /* Parse array searching for the main host (which matches the current location) */
                hosts.forEach(function (element, index, thearray) {
                    if (element.host === getCurrentHost()) {
                        log("Sixornot - main:create_button - callback: update_state - updating icon!", 1);
                        toolbarButton.style.listStyleImage = "url('" + get_icon_source(element) + "')";
                    }
                });
            } else {
                // Analyse current location, see if it's not a valid page
                // TODO - fallback to DNS lookup of current name
                //      - store this in the cache
                log("Sixornot - main:create_button - callback: update_state - typeof(hosts) is undefined!", 1);
                toolbarButton.style.listStyleImage = "url('" + imagesrc.get("other") + "')";
                return;
            }

        };

        /* click events on the button (show panel) */
        click_handler = function () {
            panel.setAttribute("hidden", false);
            panel.openPopup(toolbarButton, panel.getAttribute("position"), 0, 0, false, false);
        };

        /* Called whenever the current window's active tab is changed
           Calls the update method for the icon */
        tabselect_handler = function (evt) {
            log("Sixornot - insert_code:create_button:tabselect_handler", 1);
            setCurrentTabIDs();
            update_icon();
        };

        /* popstate event triggered, active history entry has changed */
        popstate_handler = function (evt) {
            log("Sixornot - insert_code:create_button:popstate_handler", 1);
            setCurrentTabIDs();
            update_icon();
        };

        /* pageshow event triggered, current page has been shown */
        pageshow_handler = function (evt) {
            log("Sixornot - insert_code:create_button:pageshow_handler", 1);
            setCurrentTabIDs();
            update_icon();
        };

        /* Called whenever a Sixornot page change event is emitted
           Calls the update method for the icon, but only if the event applies to us */
        page_change_handler = function (evt) {
            log("Sixornot - insert_code:create_button:page_change_handler - evt.subject.outer_id: " + evt.subject.outer_id + ", evt.subject.inner_id: " + evt.subject.inner_id + ", currentTabOuterID: " + currentTabOuterID + ", currentTabInnerID: " + currentTabInnerID, 1);
            setCurrentTabIDs();
            // Ignore updates for windows other than this one
            if (evt.subject.outer_id !== currentTabOuterID) {
                log("Sixornot - insert_code:create_button - callback: update_state - Callback ID mismatch: evt.subject.outer_id is: " + evt.subject.outer_id + ", currentTabOuterID is: " + currentTabOuterID, 1);
            } else {
                update_icon();
            }
        };

        /* When button location is customised store the new location in preferences
           so we can load into the same place next time */
        customize_handler = function (evt) {
            var button_parent, button_nextitem, toolbar_id, nextitem_id;
            log("Sixornot - insert_code:create_button:customize_handler");
            if (toolbarButton) {
                button_parent = toolbarButton.parentNode;
                button_nextitem = toolbarButton.nextSibling;
                if (button_parent && button_parent.localName === "toolbar") {
                    toolbar_id = button_parent.id;
                    nextitem_id = button_nextitem && button_nextitem.id;
                }
            }
            prefs.set_char("toolbar",  toolbar_id || "");
            prefs.set_char("nextitem", nextitem_id || "");
        };

        /* Create the button */
        toolbarButton = doc.createElement("toolbarbutton");

        /* Iconized button setup */
        toolbarButton.setAttribute("id", BUTTON_ID);
        toolbarButton.setAttribute("label", gt("label"));
        toolbarButton.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional");
        toolbarButton.setAttribute("tooltiptext", "Show Sixornot panel");
        toolbarButton.setAttribute("type", "menu");
        toolbarButton.setAttribute("orient", "horizontal");
        toolbarButton.style.listStyleImage = "url('" + imagesrc.get("other") + "')";

        /* Create a panel to show details when clicked */
        panel = create_panel();
        toolbarButton.appendChild(panel);

        /* Add button to toolbox palette, since it needs a parent */
        gbi(doc, "navigator-toolbox").palette.appendChild(toolbarButton);

        /* Move to location specified in prefs
           If location is blank, then it isn't moved (stays in toolbox palette) */
        toolbarID = prefs.get_char("toolbar");
        if (toolbarID !== "") {
            toolbar = gbi(doc, toolbarID);

            nextID = prefs.get_char("nextitem");
            if (nextID === "") {
                // Add to end of the specified bar
                toolbar.insertItem(BUTTON_ID);
            } else {
                // Add to specified position, if nextID is found
                nextItem = gbi(doc, nextID);
                if (nextItem && nextItem.parentNode.id === toolbarID) {
                    toolbar.insertItem(BUTTON_ID, nextItem);
                } else {
                    toolbar.insertItem(BUTTON_ID);
                }
            }
        }

        /* Add event listeners */
        // win.addEventListener("online", onChangedOnlineStatus, false); TODO
        // win.addEventListener("offline", onChangedOnlineStatus, false); TODO
        toolbarButton.addEventListener("click", click_handler, false);
        win.addEventListener("aftercustomization", customize_handler, false);

        /* Ensure tab ID is set upon loading into window */
        setCurrentTabIDs();

        /* Register for page change events */
        win.addEventListener("sixornot-page-change-event", page_change_handler, false);
        win.addEventListener("sixornot-dns-lookup-event", page_change_handler, false);
        win.gBrowser.tabContainer.addEventListener("TabSelect", tabselect_handler, false);
        win.gBrowser.addEventListener("pageshow", pageshow_handler, false);
        //win.gBrowser.addEventListener("DOMContentLoaded", page_change_handler, false);

        /* Add a callback to unload to remove the button */
        unload(function () {
            log("Sixornot - Unload main UI for a window...", 2);

            /* Clear event handlers */
            // win.removeEventListener("offline", onChangedOnlineStatus, false); TODO
            // win.removeEventListener("online", onChangedOnlineStatus, false); TODO
            toolbarButton.removeEventListener("click", click_handler, false);
            win.removeEventListener("aftercustomization", customize_handler, false);
            win.removeEventListener("sixornot-page-change-event", page_change_handler, false);
            win.removeEventListener("sixornot-dns-lookup-event", page_change_handler, false);
            win.gBrowser.tabContainer.removeEventListener("TabSelect", tabselect_handler, false);
            win.gBrowser.removeEventListener("pageshow", pageshow_handler, false);
            //win.gBrowser.removeEventListener("DOMContentLoaded", page_change_handler, false);

            /* Remove UI */
            toolbarButton.parentNode.removeChild(toolbarButton);
        }, win);
    };

    create_addressbaricon = function () {
        var addressBarIcon, urlbaricons, starbutton, panel, update_icon,
            click_handler, page_change_handler, tabselect_handler,
            popstate_handler, pageshow_handler;
        log("Sixornot - insert_code:create_addressbaricon", 2);

        /* Updates the icon to reflect state of the currently displayed page */
        update_icon = function () {
            log("Sixornot - insert_code:create_addressbaricon:update_icon", 1);
            var hosts = requests.cache[currentTabInnerID];

            if (hosts) {
                /* Parse array searching for the main host (which matches the current location) */
                hosts.forEach(function (element, index, thearray) {
                    if (element.host === getCurrentHost()) {
                        log("Sixornot - main:create_addressbaricon - callback: update_state - updating icon!", 1);
                        addressBarIcon.style.listStyleImage = "url('" + get_icon_source(element) + "')";
                    }
                });
            } else {
                // Analyse current location, see if it's not a valid page
                // TODO - fallback to DNS lookup of current name
                //      - store this in the cache
                log("Sixornot - main:create_addressbaricon - callback: update_state - typeof(hosts) is undefined!", 1);
                addressBarIcon.style.listStyleImage = "url('" + imagesrc.get("other") + "')";
            }

        };

        /* click events on the button (show panel) */
        click_handler = function () {
            panel.setAttribute("hidden", false);
            panel.openPopup(addressBarIcon, panel.getAttribute("position"), 0, 0, false, false);
        };

        /* When the active tab is changed this event handler updates the icon */
        tabselect_handler = function (evt) {
            log("Sixornot - insert_code:create_addressbaricon:tabselect_handler", 2);
            setCurrentTabIDs();
            update_icon();
        };

        /* popstate event triggered */
        popstate_handler = function (evt) {
            log("Sixornot - insert_code:create_button:popstate_handler", 1);
            setCurrentTabIDs();
            update_icon();
        };

        /* pageshow event triggered */
        pageshow_handler = function (evt) {
            log("Sixornot - insert_code:create_button:pageshow_handler", 1);
            setCurrentTabIDs();
            update_icon();
        };

        /* Called whenever a Sixornot page change event is emitted
           Calls the update method for the icon, but only if the event applies to us */
        page_change_handler = function (evt) {
            log("Sixornot - insert_code:create_addressbaricon:page_change_handler - evt.subject.outer_id: " + evt.subject.outer_id + ", evt.subject.inner_id: " + evt.subject.inner_id + ", currentTabOuterID: " + currentTabOuterID + ", currentTabInnerID: " + currentTabInnerID, 1);
            setCurrentTabIDs();
            // Ignore updates for windows other than this one
            if (evt.subject.outer_id !== currentTabOuterID) {
                log("Sixornot - insert_code:create_addressbaricon - callback: update_state - Callback ID mismatch: evt.subject.outer_id is: " + evt.subject.outer_id + ", currentTabOuterID is: " + currentTabOuterID, 1);
            } else {
                update_icon();
            }
        };

        /* Create address bar icon */
        addressBarIcon = doc.createElement("box");

        /* Address bar icon setup */
        addressBarIcon.setAttribute("width", "16");
        addressBarIcon.setAttribute("height", "16");
        addressBarIcon.setAttribute("align", "center");
        addressBarIcon.setAttribute("pack", "center");
        addressBarIcon.style.listStyleImage = "url('" + imagesrc.get("other") + "')";
        addressBarIcon.setAttribute("tooltiptext", "Show Sixornot panel");
        /* Box must contain at least one child or it doesn't display */
        addressBarIcon.appendChild(doc.createElement("image"));

        /* Create a panel to show details when clicked */
        panel = create_panel();
        addressBarIcon.appendChild(panel);

        /* Position the icon */
        urlbaricons = gbi(doc, "urlbar-icons");
        starbutton = gbi(doc, "star-button");

        /* If star icon visible, insert before it, otherwise just append to urlbaricons */
        if (!starbutton) {
            urlbaricons.appendChild(addressBarIcon);
        } else {
            urlbaricons.insertBefore(addressBarIcon, starbutton);
        }

        /* Ensure tab ID is set upon loading into window */
        setCurrentTabIDs();

        /* Add event listeners */
        addressBarIcon.addEventListener("click", click_handler, false);
        win.addEventListener("sixornot-page-change-event", page_change_handler, false);
        win.addEventListener("sixornot-dns-lookup-event", page_change_handler, false);
        win.gBrowser.tabContainer.addEventListener("TabSelect", tabselect_handler, false);
        win.gBrowser.addEventListener("pageshow", pageshow_handler, false);
        //win.gBrowser.addEventListener("DOMContentLoaded", page_change_handler, false);

        /* Add a callback to unload to remove the icon */
        unload(function () {
            log("Sixornot - address bar unload function", 2);

            /* Clear event handlers */
            addressBarIcon.removeEventListener("click", click_handler, false);
            win.removeEventListener("sixornot-page-change-event", page_change_handler, false);
            win.removeEventListener("sixornot-dns-lookup-event", page_change_handler, false);
            win.gBrowser.tabContainer.removeEventListener("TabSelect", tabselect_handler, false);
            win.gBrowser.removeEventListener("pageshow", pageshow_handler, false);
            //win.gBrowser.removeEventListener("DOMContentLoaded", page_change_handler, false);

            /* Remove UI */
            addressBarIcon.parentNode.removeChild(addressBarIcon);
        }, win);
    };

    /* Returns the correct icon source entry for a given record */
    // TODO
    // Expand this to account for proxies
    // Also account for error conditions, e.g. using v4 with no v4 in DNS
    get_icon_source = function (record) {
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
                    return imagesrc.get("other");
                } else {
                    // Only v4 addresses from DNS, red cache icon
                    return imagesrc.get("4only");
                }
            } else {
                if (record.ipv4s.length === 0) {
                    // Only v6 addresses from DNS, blue cache icon
                    return imagesrc.get("6only");
                } else {
                    // Both kinds of addresses from DNS, yellow cache icon
                    return imagesrc.get("4pot6");
                }
            }
        } else if (record.address_family === 0) {
            // This indicates that no addresses were available but request is not cached
            // Show error icon TODO
            return imagesrc.get("error");
        }
    };

    // Create address bar icon
    // Add address bar icon only if desired by preferences
    if (prefs.get_bool("showaddressicon")) {
        log("Sixornot - insert_code: add addressicon", 1);
        create_addressbaricon();
    }

    // Create button
    log("Sixornot - insert_code: add mainui", 1);
    create_button();

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


/* Returns array of rows considered to be local */
/* var add_local_ips = function () {
    var local_ips = [];
    // Add local IP addresses, only show proper addresses unless setting set
    if (prefs.get_bool("showallips")) {
        l6_filtered = localipv6s;
        l4_filtered = localipv4s;
    } else {
        l6_filtered = localipv6s.filter(function (item) {
            return dns_handler.typeof_ip6(item) === "global";
        });
        l4_filtered = localipv4s.filter(function (item) {
            return ["global", "rfc1918"].indexOf(dns_handler.typeof_ip4(item)) !== -1;
        });
    }
    // Add local IP address information if available
    if (l4_filtered.length !== 0 || l6_filtered.length !== 0) {
        local_ips.push(add_line(remote_rows, gt("header_local"), "text-align: center; font-size: smaller;"));
        l6_filtered.forEach(function (address, index, thearray) {
            if (index === 0) {
                local_ips.push(add_bold_host_line(remote_rows, 0, dnsService.myHostName, address, 6, null));
            } else {
                local_ips.push(add_v6_line(remote_rows, address));
            }
        });
        l4_filtered.forEach(function (address, index, thearray) {
            if (index === 0 && l6_filtered.length < 1) {
                local_ips.push(add_bold_host_line(remote_rows, 0, dnsService.myHostName, address, 4, null));
            } else {
                local_ips.push(add_v4_line(remote_rows, address));
            }
        });
    } else {
        local_ips.push(add_bold_host_line(remote_rows, 0, dnsService.myHostName, gt("no_local"), 0, null));
    }
    return local_ips;
}; */

// Trigger async local address resolve, callback updates local IP addresses
/* var local_dns_request = dns_handler.resolve_local_async(function (localips) {
    localipv6s = localips.filter(function (a) {
        return dns_handler.is_ip6(a) && dns_handler.typeof_ip6(a) !== "localhost";
    });
    localipv4s = localips.filter(function (a) {
        return dns_handler.is_ip4(a) && dns_handler.typeof_ip4(a) !== "localhost";
    });
    // Remove all local IP children from grid
    // Add new results to grid
    log("About to remove children, typeof local_ips is: " + typeof local_ips);
    log("About to remove children, local_ips.length is: " + local_ips.length);
    local_ips.forEach(function (item, index, thearray) {
        try {
            remote_rows.removeChild(item);
            log("Removed child: " + item, 0);
        } catch (e) {
            log("Error: " + e, 0);
        }
    });
    log("After removing children");
    local_ips = add_local_ips();
    //panel_vbox.setAttribute("maxheight", panel.clientHeight);
    log("Done");
}); */

/*              OLD tooltip creation function
    // TODO - Replace this with an array mapping/lookup table
    // TODO - If a special location is set no need to do any of the IP address stuff!
    if (specialLocation) {
        if (specialLocation[0] === "localfile") {
            extraString = gt("other_localfile");
        } else if (specialLocation[0] === "lookuperror") {
            extraString = gt("other_lookuperror");
        } else if (specialLocation[0] === "nodnserror") {
            extraString = gt("other_nodnserror");
        } else if (specialLocation[0] === "offlinemode") {
            extraString = gt("other_offlinemode");
        }

        if (specialLocation[1]) {
            extraString += " (" + specialLocation[1] + ")";
        }
        extraLine = doc.createElement("label");
        extraLine.setAttribute("value", extraString);
        if (["unknownsite", "lookuperror", "nodnserror", "offlinemode"].indexOf(specialLocation[0]) !== -1) {
            extraLine.setAttribute("style", "font-style: italic;");
        }
        rows.appendChild(extraLine);
    } */

/*
if (host === "")
{
    set_icon(imagesrc.get("other"));
    specialLocation = ["unknownsite"];
    log("Sixornot warning: no host returned for \"" + url + "\"");
    return;
}

// Offline mode or otherwise not connected
if (!win.navigator.onLine)
{
    set_icon(imagesrc.get("other"));
    specialLocation = ["offlinemode"];
    log("Sixornot is in offline mode");
    return;
}

// Proxy in use for DNS; can't do a DNS lookup
if (dns_handler.is_proxied_dns(url))
{
    set_icon(imagesrc.get("other"));
    specialLocation = ["nodnserror"];
    log("Sixornot is in proxied mode");
    return;
}
*/

