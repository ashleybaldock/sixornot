/*
 * Copyright 2015 Timothy Baldock. All Rights Reserved.
 */

// Provided by Firefox:
/*global Components, Services */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/utility.jsm");
Components.utils.import("resource://sixornot/includes/locale.jsm");
Components.utils.import("resource://sixornot/includes/prefs.jsm");
Components.utils.import("resource://sixornot/includes/dns.jsm");
Components.utils.import("resource://sixornot/includes/windowwatcher.jsm");

var EXPORTED_SYMBOLS = [ "createPanel" ];

/* Creates and sets up a panel to display information which can then be bound to an icon */
var createPanel = function (win, panel_id) {
    var doc, panel, register_callbacks, unregister_callbacks,
    panel_vbox, grid, grid_rows, grid_cols,
    remote_anchor, local_anchor,
    force_scrollbars,
    on_click, onPopupShowing, onPopupHiding, on_page_change,
    on_new_host, on_address_change, onPageshow,
    on_count_change, onTabSelect;

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
        log("panel onUpdateUIMessage: data: " + message.data, 0);
        remote_anchor.update_model(JSON.parse(message.data));
        force_scrollbars();
    };

    /* Content script messaging */
    var currentBrowserMM;
    var unsubscribe = function () {
        if (currentBrowserMM) {
            currentBrowserMM.removeMessageListener("sixornot@baldock.me:update-ui", on_update_ui_message);
        }
    };
    var subscribe_to_current = function () {
        unsubscribe();
        currentBrowserMM = win.gBrowser.mCurrentBrowser.messageManager;
        currentBrowserMM.addMessageListener("sixornot@baldock.me:update-ui", on_update_ui_message);
    };

    var requestUpdate = function () {
        currentBrowserMM.sendAsyncMessage("sixornot@baldock.me:update-ui");
    };

    /* Event handlers */
    unregister_callbacks = function () {
        win.gBrowser.tabContainer.removeEventListener("TabSelect", onTabSelect, false);
        // TODO do we still need pageshow?
        win.gBrowser.removeEventListener("pageshow", onPageshow, false);
    };
    register_callbacks = function () {
        win.gBrowser.tabContainer.addEventListener("TabSelect", onTabSelect, false);
        win.gBrowser.addEventListener("pageshow", onPageshow, false);
    };

    onPopupShowing = function (evt) {
        log("panel:onPopupShowing", 2);
        register_callbacks();
        subscribe_to_current();
        requestUpdate();
        local_anchor.panelShowing();
    };

    onPopupHiding = function (evt) {
        log("panel:onPopupHiding", 2);
        unregister_callbacks();
        // TODO unsubscribe from current
        local_anchor.panelHiding();
    };

    onTabSelect = function (evt) {
        log("panel:onTabSelect", 1);
        subscribe_to_current();
        requestUpdate();
    };

    onPageshow = function (evt) {
        log("panel:onPageshow", 1);
        subscribe_to_current();
        requestUpdate();
    };

    var onClickSettingsLink = function (evt) {
        panel.hidePopup();
        open_preferences();
        evt.stopPropagation();
    };

    var onClickDocLink = function (evt) {
        panel.hidePopup();
        open_hyperlink(gt("sixornot_weblink"));
        evt.stopPropagation();
    };

    /* Panel UI */
    panel = doc.createElement("panel");
    panel.setAttribute("type", "arrow");
    panel.setAttribute("id", panel_id);
    panel.setAttribute("flip", "slide");
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
    // 6 columns wide - icon, sslinfo, count, host, address, show/hide
    grid_cols.appendChild(doc.createElement("column"));
    grid_cols.appendChild(doc.createElement("column"));
    grid_cols.appendChild(doc.createElement("column"));
    grid_cols.appendChild(doc.createElement("column"));
    grid_cols.appendChild(doc.createElement("column"));
    grid_cols.appendChild(doc.createElement("column"));
    grid.appendChild(grid_cols);
    grid.appendChild(grid_rows);
    panel_vbox.appendChild(grid);

    /* Anchors are locations to insert entries into grid */
    remote_anchor = createRemoteAnchor(doc, grid_rows);
    local_anchor = createLocalAnchor(doc, grid_rows);

    /* Links at bottom of panel */
    var settingsLink, docLink, spacer, urlhbox, makeSpacer;

    /* Settings */
    settingsLink = doc.createElement("label");
    settingsLink.setAttribute("value", gt("header_settings"));
    settingsLink.setAttribute("tooltiptext", gt("tt_open_settings"));
    settingsLink.classList.add("sixornot-link");
    settingsLink.classList.add("sixornot-title");

    /* Documentation link */
    docLink = doc.createElement("label");
    docLink.setAttribute("value", gt("sixornot_documentation"));
    docLink.classList.add("sixornot-link");
    docLink.classList.add("sixornot-title");
    docLink.setAttribute("tooltiptext", gt("tt_gotowebsite"));

    spacer = doc.createElement("label");
    spacer.setAttribute("value", " - ");
    spacer.classList.add("sixornot-title");

    makeSpacer = function () {
        var spacer = doc.createElement("spacer");
        spacer.setAttribute("flex", "1");
        return spacer;
    };

    /* Add everything to parent node */
    urlhbox = doc.createElement("hbox");
    urlhbox.appendChild(makeSpacer());
    urlhbox.appendChild(settingsLink);
    urlhbox.appendChild(spacer);
    urlhbox.appendChild(docLink);
    urlhbox.appendChild(makeSpacer());
    urlhbox.setAttribute("align", "center");
    urlhbox.style.marginTop = "3px";
    grid_rows.appendChild(urlhbox);

    /* Subscribe to events */
    settingsLink.addEventListener("click", onClickSettingsLink, false);
    docLink.addEventListener("click", onClickDocLink, false);
    panel.addEventListener("popupshowing", onPopupShowing, false);
    panel.addEventListener("popuphiding", onPopupHiding, false);

    unload(function () {
        log("Unload panel", 2);
        unsubscribe();
        unregister_callbacks();
        panel.removeEventListener("popupshowing", onPopupShowing, false);
        panel.removeEventListener("popuphiding", onPopupHiding, false);
        remote_anchor.remove(); // Removes child event listeners
        local_anchor.remove(); // Removes child event listeners
        settingsLink.removeEventListener("click", onClickSettingsLink, false);
        docLink.removeEventListener("click", onClickDocLink, false);

        // Remove UI
        if (panel.parentNode) {
            panel.parentNode.removeChild(panel);
        }
    }, win);

    return panel;
};

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

var createIPEntry = function (doc, addto) {
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
var createIPs = function (doc, addto) {
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
                    createIPEntry(doc, address_box).update(host.address, host.address_family));
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
                                    createIPEntry(doc, address_box)
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
                                    createIPEntry(doc, address_box)
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

var createIcon = function (doc, addto) {
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

var createSSLInfo = function (doc, addto) {
    var sslinfo, update;

    sslinfo = doc.createElement("image");
    sslinfo.setAttribute("height", "16");
    addto.appendChild(sslinfo);

    return {
        update: function (host) {
            if (host.security.isExtendedValidation) {
                if (!sslinfo.classList.contains("sixornot_ssl_ev")) {
                    remove_ssl_classes_from_node(sslinfo);
                    sslinfo.classList.add("sixornot_ssl_ev");
                    sslinfo.setAttribute("width", "16");
                }
            } else if (host.security.cipherName) {
                if (!sslinfo.classList.contains("sixornot_ssl")) {
                    remove_ssl_classes_from_node(sslinfo);
                    sslinfo.classList.add("sixornot_ssl");
                    sslinfo.setAttribute("width", "16");
                }
            } else {
                if (!sslinfo.classList.contains("sixornot_ssl_off")) {
                    remove_ssl_classes_from_node(sslinfo);
                    sslinfo.classList.add("sixornot_ssl_off");
                    sslinfo.setAttribute("width", "0");
                }
            }
        },
        remove: function () {
            addto.removeChild(sslinfo);
        }
    };
};

var createCount = function (doc, addto) {
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

var createHostname = function (doc, addto) {
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

/* Object representing one host entry in the panel
   Takes a reference to a member of the request cache as argument
   and links to that member to reflect its state
   Also takes a reference to the element to add this element after
   e.g. header or the preceeding list item */
var createRemoteListingRow = function (doc, addafter, host, mainhost) {
    var row, icon, sslinfo, count, hostname, ips, showhide, update;

    row = doc.createElement("row");
    row.setAttribute("align", "start");
    icon = createIcon(doc, row);
    count = createCount(doc, row);
    sslinfo = createSSLInfo(doc, row);
    hostname = createHostname(doc, row);
    ips = createIPs(doc, row);


    /* Update elements on create */
    icon.update(host);
    hostname.update(host, mainhost);
    count.update(host);
    sslinfo.update(host);
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
            sslinfo.remove();
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
            sslinfo.update(host);
            ips.update(host, host.host === mainhost);
        }
    };
};

var createRemoteAnchor = function (doc, parent_element) {
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
                        createRemoteListingRow(
                        doc, prevEntry ? prevEntry : this, item, model.main));
                }
                entriesIndex++;
            }, this);
        }
    };
};

var createLocalListingRow = function (doc, addafter) {
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

    // Three spacers since local rows don't have icon, sslinfo or count
    row.appendChild(doc.createElement("label"));
    row.appendChild(doc.createElement("label"));
    var spacer = doc.createElement("image");
    spacer.setAttribute("width", "0");
    spacer.classList.add("sixornot_ssl_off");
    row.appendChild(spacer);

    var hostname = createHostname(doc, row);

    var address_box = doc.createElement("vbox");
    row.appendChild(address_box);

    var entries = [];

    return {
        remove: function () {
            hostname.remove();
            entries.forEach(function (item) {
                item.remove();
            });
            entries = [];
            row.parentNode.removeChild(row);
        },
        update: function (host) {
            var entriesIndex = 0;
            hostname.update(host);
            if (prefs.get_bool("showlocal")) {
                host.ipv6s.sort(function (a, b) {
                    return dns_handler.sort_ip6.call(dns_handler, a, b);
                });
                host.ipv6s.forEach(function (address, index, addresses) {
                    if (entries.length < entriesIndex + 1) {
                        entries.push(
                            createIPEntry(doc, address_box)
                                .update(address, 6));
                    } else {
                        entries[entriesIndex].update(address, 6).show();
                    }
                    entriesIndex++;
                });
                host.ipv4s.sort(function (a, b) {
                    return dns_handler.sort_ip4.call(dns_handler, a, b);
                });
                host.ipv4s.forEach(function (address, index, addresses) {
                    if (entries.length < entriesIndex + 1) {
                        entries.push(
                            createIPEntry(doc, address_box)
                                .update(address, 4));
                    } else {
                        entries[entriesIndex].update(address, 4).show();
                    }
                    entriesIndex++;
                });
            }
            // Hide additional entries
            entries.forEach(function (item, index, items) {
                if (index < entriesIndex) return;
                item.hide();
            });
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

var createLocalAnchor = function (doc, parent_element) {
    var title = doc.createElement("label");
    title.setAttribute("value", gt("header_local"));
    title.classList.add("sixornot-title");

    var updateShowingLocal = function () {
        setShowhideText();
        entries.forEach(function (item) {
            item.update_visibility();
        });
    };

    var toggleShowingLocal = function (evt) {
        prefs.set_bool("showlocal", !prefs.get_bool("showlocal"));
        evt.stopPropagation();
    };

    var makeSpacer = function () {
        var spacer = doc.createElement("spacer");
        spacer.setAttribute("flex", "1");
        return spacer;
    };

    var showhide = doc.createElement("label");
    showhide.classList.add("sixornot-title");
    showhide.classList.add("sixornot-link");

    var showhideSpacer = doc.createElement("label");
    showhideSpacer.classList.add("sixornot-title");
    showhideSpacer.classList.add("sixornot-hidden");

    var setShowhideText = function () {
        if (prefs.get_bool("showlocal")) {
            showhide.setAttribute("value", "[" + gt("hide_text") + "]");
            showhide.setAttribute("tooltiptext", gt("tt_hide_local"));
            showhideSpacer.setAttribute("value", "[" + gt("hide_text") + "]");
        } else {
            showhide.setAttribute("value", "[" + gt("show_text") + "]");
            showhide.setAttribute("tooltiptext", gt("tt_show_local"));
            showhideSpacer.setAttribute("value", "[" + gt("hide_text") + "]");
        }
    };

    setShowhideText();

    var hbox = doc.createElement("hbox");
    hbox.appendChild(showhideSpacer);
    hbox.appendChild(makeSpacer());
    hbox.appendChild(title);
    hbox.appendChild(makeSpacer());
    hbox.appendChild(showhide);
    hbox.setAttribute("align", "center");
    hbox.style.marginTop = "3px";
    parent_element.appendChild(hbox);

    var localAddressInfo = create_local_address_info();

    var entries = [];

    showhide.addEventListener("click", toggleShowingLocal, false);
    // TODO also observe showallips and update display
    var showLocalObserver = prefs.createObserver("extensions.sixornot.showlocal", updateShowingLocal)
                                 .register();

    return {
        remove: function () {
            this.remove_all_entries();
            showLocalObserver.unregister();
            showhide.removeEventListener("click", toggleShowingLocal, false);
        },
        update: function (host) {
            if (entries.length <= 0) {
                // For now entries only ever contains one thing
                entries.push(createLocalListingRow(doc, this));
            }
            entries.forEach(function (item) {
                item.update(host);
            });
        },
        add_after: function (element) {
            if (hbox.nextSibling) {
                parent_element.insertBefore(element, hbox.nextSibling);
            } else {
                parent_element.appendChild(element);
            }
        },
        remove_all_entries: function () {
            entries.forEach(function (item) {
                item.remove();
            });
            entries = [];
        },
        panelHiding : function () {
            localAddressInfo.cancel();
        },
        panelShowing : function () {
            localAddressInfo.get_local_host_info(this.update, this);
        }
    };
};

