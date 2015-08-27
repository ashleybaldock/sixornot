/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2015 Timothy Baldock. All Rights Reserved.
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
/*global Components, Services */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/utility.jsm");
Components.utils.import("resource://sixornot/includes/locale.jsm");
Components.utils.import("resource://sixornot/includes/prefs.jsm");
Components.utils.import("resource://sixornot/includes/dns.jsm");

var EXPORTED_SYMBOLS = [
    "create_local_anchor",
    "create_remote_anchor",
    "create_panel_links",
];

var create_ips = function (doc, addto, host) {
    var update, address_box;
    /* Create DOM UI elements */
    address_box = doc.createElement("vbox");

    update = function (host) {
        var conipaddr;
        // Remove all existing addresses
        while (address_box.firstChild) {
            address_box.removeChild(address_box.firstChild);
        }
        // Add the first entry (connection IP)
        if (host.remote) {
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
        }

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
    update(host);
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

var create_showhide = function (doc, addto, host) {
    var showhide, update;

    /* Create DOM UI elements */
    showhide = doc.createElement("label");
    showhide.setAttribute("value", "");

    showhide.sixornot_host = host.host;
    showhide.sixornot_showhide = true;
    showhide.classList.add("sixornot-link");

    update = function (host) {
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
                showhide.setAttribute("value", "[-]");
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
    update(host);
    addto.appendChild(showhide);
    /* Return object for interacting with DOM elements */
    return {
        update: update,
        remove: function () {
            addto.removeChild(showhide);
        }
    };
};

var create_icon = function (doc, addto, host) {
    var icon, update;
    /* Create DOM UI elements */
    icon = doc.createElement("image");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    update = function (host) {
        update_node_icon_for_host(icon, host);
    };
    /* Update element on create */
    update(host);
    addto.appendChild(icon);
    /* Return object for interacting with DOM element */
    return {
        update: update,
        remove: function () {
            addto.removeChild(icon);
        }
    };
};

var create_count = function (doc, addto, host) {
    var count, update;
    /* Create DOM UI elements */
    count = doc.createElement("label");

    count.setAttribute("tooltiptext", gt("tt_copycount"));
    update = function (host) {
        if (host.count > 0) {
            count.setAttribute("value", "(" + host.count + ")");
        } else {
            count.setAttribute("value", "");
        }
        // TODO Add real copy text here
        //count.sixornot_copytext = "count copy text";
    };
    /* Update element on create */
    update(host);
    addto.appendChild(count);
    /* Return object for interacting with DOM element */
    return {
        update: update,
        remove: function () {
            addto.removeChild(count);
        }
    };
};

var create_hostname = function (doc, addto, host, mainhost) {
    var hostname, update;
    /* Create DOM UI elements */
    hostname = doc.createElement("label");
    hostname.setAttribute("value", host.host);
    if (host.host === mainhost) {
        hostname.classList.add("sixornot-bold");
    } else {
        hostname.classList.remove("sixornot-bold");
    }

    hostname.setAttribute("tooltiptext", gt("tt_copydomclip"));
    update = function (host) {
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
    update(host);
    addto.appendChild(hostname);
    /* Return object for interacting with DOM element */
    return {
        update: update,
        remove: function () {
            addto.removeChild(hostname);
        }
    };
};

var create_local_listing_row = function (doc, addafter, host_info) {
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
        hostname: create_hostname(doc, row, host_info),
        ips: create_ips(doc, row, host_info),
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
};

/* Object representing one host entry in the panel
   Takes a reference to a member of the request cache as argument
   and links to that member to reflect its state
   Also takes a reference to the element to add this element after
   e.g. header or the preceeding list item */
var create_remote_listing_row = function (doc, addafter, host, mainhost) {
    var row = doc.createElement("row");
    row.setAttribute("align", "start");
    /* Add this element after the last one */
    addafter.add_after(row);

    /* Object representing row of entry */
    return {
        host: host,
        icon: create_icon(doc, row, host),
        count: create_count(doc, row, host),
        hostname: create_hostname(doc, row, host, mainhost),
        ips: create_ips(doc, row, host),
        showhide: create_showhide(doc, row, host),
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
        update_ips: function (host) {
            // TODO optimisation - only update DNS IPs
            this.ips.update(host);
            this.showhide.update(host);
            this.icon.update(host);
        },
        update_address: function (host) {
            // TODO optimisation - only update connection IP
            this.ips.update(host);
            this.icon.update(host);
        },
        update_count: function (host) {
            this.count.update(host);
        }
    };
};

var create_remote_anchor = function (doc, parent_element) {
    // Add "Remote" title
    var model = {innerId: 0};
    var entries = [];
    var title_remote = doc.createElement("label");
    title_remote.setAttribute("value", gt("header_remote"));
    title_remote.classList.add("sixornot-title");
    parent_element.appendChild(title_remote);
    return {
        add_after: function (element) {
            if (title_remote.nextSibling) {
                parent_element.insertBefore(element, title_remote.nextSibling);
            } else {
                parent_element.appendChild(element);
            }
        },
        remove_all_entries: function () {
            log("remote_anchor:remove_all_entries", 2);
            entries.forEach(function (item, index, items) {
                try {
                    item.remove();
                } catch (e) {
                    Components.utils.reportError(e);
                }
            });
            entries = [];
        },
        update_model: function (new_model) {
            if (model.innerId !== new_model.innerId) {
                // If model.innerId does not match, regenerate from scratch
                this.remove_all_entries();
            }
            model = new_model;
            this.update();
        },
        update: function () {
            // Go through model and compare with each entry
            // Add new entries where needed, update where needed
            model.entries.forEach(function (host) {
                this.generate_entry_for_host(host, model.main);
            }, this);
        },
        generate_entry_for_host: function (host, mainhost) {
            log("remote_anchor:generate_entry_for_host: " + host, 2);
            // TODO put this in the right position based on some ordering
            if (entries.length > 0) {
                if (!entries.some(function (item) {
                    // TODO - this shouldn't be able to happen!
                    // If item is already in the array, don't add a duplicate
                    // Just update the existing one instead
                    if (item.host.host === host.host) {
                        log("Adding duplicate!!", 1);
                        item.update_address(host);
                        item.update_ips(host);
                        item.update_count(host);
                        return true;
                    }
                })) {
                    // Add new entry
                    entries.push(create_remote_listing_row(doc, 
                        entries[entries.length - 1], host, mainhost));
                }
            } else {
                // Push first item onto grid
                entries.push(create_remote_listing_row(doc, this, host, mainhost));
            }
        },
        toggle_detail_for_host: function (host_name) {
            if (!entries.some(function (item, index, items) {
                if (item.host.host === host_name) {
                    item.host.show_detail = !item.host.show_detail;
                    item.update_ips();// TODO
                    return true;
                }
            })) {
                log("remote_anchor:toggle_detail_for_host - host matching '" + host_name + "' not found in entries", 1);
            }
        }
    };
};

var create_local_anchor = function (doc, parent_element) {
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
            showhide_local.setAttribute("tooltiptext", gt("tt_hide_local"));
            showhide_spacer.setAttribute("value", "[" + gt("hide_text") + "]");
        } else {
            showhide_local.setAttribute("value", "[" + gt("show_text") + "]");
            showhide_local.setAttribute("tooltiptext", gt("tt_show_local"));
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
    hbox.style.marginTop = "3px";
    parent_element.appendChild(hbox);

    var local_address_info = create_local_address_info();
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
            log("panel:local_anchor:remove_all_entries", 2);
            this.entries.forEach(function (item) {
                item.remove();
            });
            this.entries = [];
        },
        generate_entry_for_host: function (host_info) {
            log("panel:local_anchor:generate_entry_for_host", 2);
            this.entries.push(create_local_listing_row(doc, this, host_info));
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
            var that = this;
            if (prefs.get_bool("showlocal")) {
                local_address_info.get_local_host_info(function (host_info) {
                    that.remove_all_entries();
                    that.generate_entry_for_host(host_info);
                });
            }
        },
        on_panel_hiding : function () {
            // Cancel local address lookup
            local_address_info.cancel();
        }
    };
};

var create_panel_links = function (doc, parent_element) {
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
    urlhbox.style.marginTop = "3px";
    parent_element.appendChild(urlhbox);
};
