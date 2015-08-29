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
];

var countDnsAddresses = function (host) {
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
    return count;
};

var create_ip_entry = function (doc, addto) {
    var conipaddr = doc.createElement("label");
    addto.appendChild(conipaddr);

    var copyText = "";
    var copyToClipboard = function (evt) {
        copy_to_clipboard(copyText);
        evt.stopPropagation();
    };
    conipaddr.addEventListener("click", copyToClipboard, false);

    return {
        show: function () {
            conipaddr.setAttribute("hidden", false);
            return this;
        },
        hide: function () {
            conipaddr.setAttribute("hidden", true);
            return this;
        },
        update: function (address, address_family) {
            if (address_family === 6 || address_family === 4) {
                conipaddr.setAttribute("value", address);
                copyText = address;
                conipaddr.setAttribute("tooltiptext", gt("tt_copyaddr"));
                conipaddr.classList.add("sixornot-link");
            } else if (address_family === 2) {
                conipaddr.setAttribute("value", gt("addr_cached"));
                copyText = "";
            } else {
                conipaddr.setAttribute("value", gt("addr_unavailable"));
                copyText = "";
            }
            return this;
        },
        remove: function () {
            conipaddr.removeEventListener("click", copyToClipboard, false);
            addto.removeChild(conipaddr);
        }
    };
};

// TODO if entry becomes main host later, update to show details
var create_ips = function (doc, addto) {
    var address_box = doc.createElement("vbox");
    addto.appendChild(address_box);

    var showhide, host_cache, showing, toggleDetail, obj;

    showhide = doc.createElement("label");
    showhide.setAttribute("value", "");
    showhide.classList.add("sixornot-link");
    addto.appendChild(showhide);

    toggleDetail = function (evt) {
        evt.stopPropagation();
        showing = !showing;
        obj.update(host_cache);
    };

    var entries = [];

    obj = {
        init: function (host, initialShow) {
            showing = initialShow;
            this.update(host);
        },
        update: function (host) {
            var count = countDnsAddresses(host);

            if (count > 0) {
                if (showing) {
                    showhide.setAttribute("value", "[ - ]");
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

            if (entries.length <= 0) {
                entries.push(
                    create_ip_entry(doc, address_box).update(host.address, host.address_family));
            }
            if (entries[0].address !== host.address ||
                host_cache.dns_status !== host.dns_status) {
                entries[0].update(host.address, host.address_family);
                // Regenerate additional address entries
                var entriesIndex = 1;
                if (showing) {
                    host.ipv6s.sort(function (a, b) {
                        return dns_handler.sort_ip6.call(dns_handler, a, b);
                    });
                    host.ipv6s.forEach(function (address, index, addresses) {
                        if (address !== host.address) {
                            if (entries.length < entriesIndex + 1) {
                                entries.push(
                                    create_ip_entry(doc, address_box)
                                        .update(address, 6));
                            } else {
                                // Update existing
                                entries[entriesIndex].update(address, 6).show();
                            }
                        }
                        entriesIndex++;
                    });
                    host.ipv4s.sort(function (a, b) {
                        return dns_handler.sort_ip4.call(dns_handler, a, b);
                    });
                    host.ipv4s.forEach(function (address, index, addresses) {
                        if (address !== host.address) {
                            if (entries.length < entriesIndex + 1) {
                                entries.push(
                                    create_ip_entry(doc, address_box)
                                        .update(address, 4));
                            } else {
                                // Update existing
                                entries[entriesIndex].update(address, 4).show();
                            }
                        }
                        entriesIndex++;
                    });
                }
                // Hide additional entries
                entries.forEach(function (item, index, items) {
                    if (index < entriesIndex) return;
                    item.hide();
                });
            } 

            host_cache = host;
        },
        remove: function () {
            entries.forEach(function (item, index, items) {
                try {
                    item.remove();
                } catch (e) {
                    Components.utils.reportError(e);
                }
            });
            entries = [];
            showhide.removeEventListener("click", toggleDetail, false);
            addto.removeChild(showhide);
            addto.removeChild(address_box);
        }
    };

    showhide.addEventListener("click", toggleDetail, false);

    return obj;
};

var create_icon = function (doc, addto) {
    var icon, update;

    icon = doc.createElement("image");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    addto.appendChild(icon);

    return {
        update: function (host) {
            update_node_icon_for_host(icon, host);
        },
        remove: function () {
            addto.removeChild(icon);
        }
    };
};

var create_count = function (doc, addto) {
    var count = doc.createElement("label");
    count.setAttribute("tooltiptext", gt("tt_copycount"));
    addto.appendChild(count);

    return {
        update: function (host) {
            if (host.count > 0) {
                count.setAttribute("value", "(" + host.count + ")");
            } else {
                count.setAttribute("value", "");
            }
        },
        remove: function () {
            addto.removeChild(count);
        }
    };
};

var create_hostname = function (doc, addto) {
    var hostname = doc.createElement("label");
    addto.appendChild(hostname);

    var copyText = "";
    var copyToClipboard = function (evt) {
        copy_to_clipboard(copyText);
        evt.stopPropagation();
    };
    hostname.addEventListener("click", copyToClipboard, false);

    return {
        update: function (host, mainhost) {
            var text = host.host;

            hostname.setAttribute("value", host.host);
            if (host.host === mainhost) {
                hostname.classList.add("sixornot-bold");
            } else {
                hostname.classList.remove("sixornot-bold");
            }

            hostname.setAttribute("tooltiptext", gt("tt_copydomclip"));

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
            copyText = text;
            hostname.classList.add("sixornot-link");
        },
        remove: function () {
            hostname.removeEventListener("click", copyToClipboard, false);
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
    var row, icon, count, hostname, ips, showhide, update;

    row = doc.createElement("row");
    row.setAttribute("align", "start");
    icon = create_icon(doc, row);
    count = create_count(doc, row);
    hostname = create_hostname(doc, row);
    ips = create_ips(doc, row);


    /* Update elements on create */
    icon.update(host);
    hostname.update(host, mainhost);
    count.update(host);
    ips.init(host, host.host === mainhost);

    /* Add this element after the last one */
    addafter.add_after(row);

    /* Object representing row of entry */
    return {
        host: host.host,
        remove: function () {
            icon.remove();
            hostname.remove();
            count.remove();
            ips.remove();
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
        update: function (host, mainhost) {
            icon.update(host);
            hostname.update(host, mainhost);
            count.update(host);
            ips.update(host, host.host === mainhost);
        }
    };
};

var create_remote_anchor = function (doc, parent_element) {
    var model, entries, title_remote;

    model = { innerId: 0 };
    entries = [];

    title_remote = doc.createElement("label");
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
        remove: function () {
            this.remove_all_entries();
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
            // Ordering of entries never changes
            // New entries may be inserted anywhere (supports alphabetical ordering)
            // model may have more items than entries
            var entriesIndex = 0;
            model.entries.forEach(function(item, index, array) {
                var entry = entries[entriesIndex];
                if (entry && entry.host === item.host) {
                    entry.update(item, model.main);
                } else {
                    var prevEntry = entries[entriesIndex - 1];
                    entries.splice(entriesIndex, 0,
                        create_remote_listing_row(
                        doc, prevEntry ? prevEntry : this, item, model.main));
                }
                entriesIndex++;
            }, this);
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
        remove: function () {
            this.remove_all_entries();
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

