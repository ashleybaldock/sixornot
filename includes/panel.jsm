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
Components.utils.import("resource://sixornot/includes/messanger.jsm");

var EXPORTED_SYMBOLS = [ "createPanel" ];

/* Creates and sets up a panel to display information which can then be bound to an icon */
var createPanel = function (win, panel_id) {
    var doc, panel, panel_vbox, grid, grid_rows, grid_cols,
    remote_anchor, local_anchor, forceScrollbars,
    on_click, onPopupShowing, onPopupHiding, on_page_change,
    on_new_host, on_address_change, on_count_change;

    doc = win.document;

    // Called by content script of active tab
    // Message contains data to update icon/UI
    var updateUI = function (data) {
        remote_anchor.update_model(data);
        forceScrollbars();
    };

    var messanger = getMessanger(win, updateUI);

    /* Ensure panel contents visible with scrollbars */
    forceScrollbars = function () {
        if (panel_vbox.clientHeight > panel.clientHeight) {
            panel_vbox.setAttribute("maxheight", panel.clientHeight - 50);
            // TODO if panel width changes after this is applied horizontal fit breaks
            //panel.setAttribute("minwidth", panel_vbox.clientWidth + 40);
        }
    };

    onPopupShowing = function (evt) {
        log("panel:onPopupShowing", 2);
        messanger.subscribeToCurrentBrowser();
        messanger.requestUpdate();
        local_anchor.panelShowing();
    };

    onPopupHiding = function (evt) {
        log("panel:onPopupHiding", 2);
        messanger.unsubscribe();
        local_anchor.panelHiding();
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
    // 7 columns wide - icon, sslinfo, proxyinfo, count, host, address, show/hide
    grid_cols.appendChild(doc.createElement("column"));
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
        messanger.shutdown();
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

var countDnsAddresses = function (host, ipv4s, ipv6s) {
    var count = 0;
    ipv6s.forEach(function (address, index, addresses) {
        if (address !== host.address) {
            count += 1;
        }
    });
    ipv4s.forEach(function (address, index, addresses) {
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

    var isRouteable = function (address, family) { // TODO put this in dnsResolver
        if (family === 6) {
            return (["6to4", "teredo", "global"].indexOf(dnsResolver.typeof_ip6(address)) != -1);
        } else if (family === 4) {
            return (["rfc1918", "6to4relay", "global"].indexOf(dnsResolver.typeof_ip4(address)) != -1);
        } else {
            return false;
        }
    };

    return {
        isRouteable: true,
        show: function () {
            conipaddr.setAttribute("hidden", false);
            return this;
        },
        hide: function () {
            conipaddr.setAttribute("hidden", true);
            return this;
        },
        update: function (address, address_family, showAsProxied) {
            this.isRouteable = isRouteable(address, address_family);
            if (address_family === 6 || address_family === 4) {
                if (showAsProxied) {
                    conipaddr.setAttribute("value", "(" + address + ")");
                } else {
                    conipaddr.setAttribute("value", address);
                }
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

    var showhide, host_cache, ipv4s_cache, ipv6s_cache, showing, toggleDetail, obj;

    showhide = doc.createElement("label");
    showhide.setAttribute("value", "");
    showhide.classList.add("sixornot-link");
    addto.appendChild(showhide);

    toggleDetail = function (evt) {
        evt.stopPropagation();
        showing = !showing;
        obj.update(host_cache, ipv4s_cache, ipv6s_cache);
    };

    var entries = [];

    obj = {
        init: function (host, initialShow) {
            showing = initialShow;
        },
        update: function (host, ipv4s, ipv6s) {
            var count = countDnsAddresses(host, ipv4s, ipv6s);

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
                    createIPEntry(doc, address_box)
                        .update(host.address, host.address_family, host.proxy.type === "http"));
            }
            if (entries[0].address !== host.address ||
                host_cache.dns_status !== host.dns_status) {
                entries[0].update(host.address, host.address_family, host.proxy.type === "http");
                // Regenerate additional address entries
                var entriesIndex = 1;
                if (showing) {
                    ipv6s.sort(function (a, b) {
                        return dnsResolver.sort_ip6.call(dnsResolver, a, b);
                    });
                    ipv6s.forEach(function (address, index, addresses) {
                        if (address !== host.address) {
                            if (entries.length < entriesIndex + 1) {
                                entries.push(
                                    createIPEntry(doc, address_box)
                                        .update(address, 6, false));
                            } else {
                                // Update existing
                                entries[entriesIndex].update(address, 6, false).show();
                            }
                        }
                        entriesIndex++;
                    });
                    ipv4s.sort(function (a, b) {
                        return dnsResolver.sort_ip4.call(dnsResolver, a, b);
                    });
                    ipv4s.forEach(function (address, index, addresses) {
                        if (address !== host.address) {
                            if (entries.length < entriesIndex + 1) {
                                entries.push(
                                    createIPEntry(doc, address_box)
                                        .update(address, 4, false));
                            } else {
                                // Update existing
                                entries[entriesIndex].update(address, 4, false).show();
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
            ipv4s_cache = ipv4s;
            ipv6s_cache = ipv6s;
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
        update: function (host, ipv4s, ipv6s) {
            update_node_icon_for_host(icon, host, ipv4s, ipv6s);
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
                    sslinfo.setAttribute("tooltiptext", host.security.cipherName);
                    sslinfo.setAttribute("width", "16");
                }
            } else if (host.security.cipherName) {
                if (!sslinfo.classList.contains("sixornot_ssl")) {
                    remove_ssl_classes_from_node(sslinfo);
                    sslinfo.classList.add("sixornot_ssl");
                    sslinfo.setAttribute("tooltiptext", host.security.cipherName);
                    sslinfo.setAttribute("width", "16");
                }
            } else {
                if (!sslinfo.classList.contains("sixornot_ssl_off")) {
                    remove_ssl_classes_from_node(sslinfo);
                    sslinfo.classList.add("sixornot_ssl_off");
                    sslinfo.setAttribute("tooltiptext", "");
                    sslinfo.setAttribute("width", "0");
                }
            }
        },
        remove: function () {
            addto.removeChild(sslinfo);
        }
    };
};

var createProxyInfo = function (doc, addto) {
    var proxyinfo, update;

    proxyinfo = doc.createElement("image");
    proxyinfo.setAttribute("height", "16");
    addto.appendChild(proxyinfo);

    return {
        update: function (host) {
            if (host.proxy.type === "http"
                || host.proxy.type === "https"
                || host.proxy.type === "socks4"
                || host.proxy.type === "socks") {
                if (!proxyinfo.classList.contains("sixornot_proxy_on")) {
                    proxyinfo.classList.remove("sixornot_proxy_off");
                    proxyinfo.classList.add("sixornot_proxy_on");
                }
                proxyinfo.setAttribute("width", "16");
            } else {
                if (!proxyinfo.classList.contains("sixornot_proxy_off")) {
                    proxyinfo.classList.remove("sixornot_proxy_on");
                    proxyinfo.classList.add("sixornot_proxy_off");
                }
                proxyinfo.setAttribute("width", "0");
            }
            if (host.proxy.type === "http") {
                proxyinfo.setAttribute("tooltiptext",
                    gt("proxy_base", [
                        gt("proxy_http"), host.proxy.host,
                        host.proxy.port, gt("proxy_lookups_disabled")
                    ]));
            } else if (host.proxy.type === "https") {
                proxyinfo.setAttribute("tooltiptext",
                    gt("proxy_base", [
                        gt("proxy_https"), host.proxy.host,
                        host.proxy.port, gt("proxy_lookups_disabled")
                    ]));
            } else if (host.proxy.type === "socks4") {
                proxyinfo.setAttribute("tooltiptext",
                    gt("proxy_base", [
                        gt("proxy_socks4"), host.proxy.host, host.proxy.port,
                        host.proxy.proxyResolvesHost ? gt("proxy_lookups_disabled") : ""
                    ]));
            } else if (host.proxy.type === "socks") {
                proxyinfo.setAttribute("tooltiptext",
                    gt("proxy_base", [
                        gt("proxy_socks5"), host.proxy.host, host.proxy.port,
                        host.proxy.proxyResolvesHost ? gt("proxy_lookups_disabled") : ""
                    ]));
            } else {
                proxyinfo.setAttribute("tooltiptext", "");
            }
        },
        remove: function () {
            addto.removeChild(proxyinfo);
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
        update: function (host, mainhost, ipv4s, ipv6s) {
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
            ipv6s.sort(function (a, b) {
                return dnsResolver.sort_ip6.call(dnsResolver, a, b);
            });
            ipv4s.sort(function (a, b) {
                return dnsResolver.sort_ip4.call(dnsResolver, a, b);
            });
            ipv6s.forEach(function (address, index, addresses) {
                if (address !== host.address) {
                    text = text + "," + address;
                }
            });
            ipv4s.forEach(function (address, index, addresses) {
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
    var row, icon, sslinfo, proxyinfo, count, hostname, ips, showhide, update;

    row = doc.createElement("row");
    row.setAttribute("align", "start");
    icon = createIcon(doc, row);
    count = createCount(doc, row);
    sslinfo = createSSLInfo(doc, row);
    proxyinfo = createProxyInfo(doc, row);
    hostname = createHostname(doc, row);
    ips = createIPs(doc, row);

    var ipv4s = [];
    var ipv6s = [];

    /* Update elements on create */
    icon.update(host, ipv4s, ipv6s);
    hostname.update(host, mainhost, ipv4s, ipv6s);
    count.update(host);
    sslinfo.update(host);
    proxyinfo.update(host);
    ips.init(host, host.host === mainhost);
    ips.update(host, ipv4s, ipv6s);

    /* Add this element after the last one */
    addafter.add_after(row);

    /* Do DNS lookup for host */
    var dnsCancel;

    if (!(host.address_family === 1
     || host.proxy.type === "http"
     || host.proxy.type === "https"
     || host.proxy.proxyResolvesHost)) {
        dnsCancel = dnsResolver.resolveRemote(host.host, function (results) {
            dnsCancel = null;
            if (results[0] !== "FAIL") {
                ipv6s = results.filter(dnsResolver.is_ip6);
                ipv4s = results.filter(dnsResolver.is_ip4);
            }
            log("remoteListingRow dns complete callback, ipv4s: " + ipv4s + ", ipv6s:" + ipv6s, 0);
            hostname.update(host, mainhost, ipv4s, ipv6s);
            icon.update(host, ipv4s, ipv6s);
            ips.update(host, ipv4s, ipv6s);
        });
    }

    /* Object representing row of entry */
    return {
        host: host.host,
        remove: function () {
            if (dnsCancel) { dnsCancel.cancel(); }
            icon.remove();
            hostname.remove();
            count.remove();
            sslinfo.remove();
            proxyinfo.remove();
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
            icon.update(host, ipv4s, ipv6s);
            hostname.update(host, mainhost, ipv4s, ipv6s); // To update copy/paste text
            count.update(host);
            sslinfo.update(host);
            proxyinfo.update(host);
            ips.update(host, ipv4s, ipv6s);
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

    // Four spacers since local rows don't have icon, sslinfo, proxyinfo or count
    row.appendChild(doc.createElement("label"));
    row.appendChild(doc.createElement("label"));
    var sslinfoSpacer = doc.createElement("image");
    sslinfoSpacer.setAttribute("width", "0");
    sslinfoSpacer.classList.add("sixornot_ssl_off");
    row.appendChild(sslinfoSpacer);
    var proxyinfoSpacer = doc.createElement("image");
    proxyinfoSpacer.setAttribute("width", "0");
    proxyinfoSpacer.classList.add("sixornot_proxy_off");
    row.appendChild(proxyinfoSpacer);

    var hostname = createHostname(doc, row);

    var address_box = doc.createElement("vbox");
    row.appendChild(address_box);

    var entries = [];
    var maxVisibleIndex = 0;

    return {
        remove: function () {
            hostname.remove();
            entries.forEach(function (item) {
                item.remove();
            });
            entries = [];
            row.parentNode.removeChild(row);
        },
        updateShowAllIPs: function () {
            entries.forEach(function (item, index, items) {
                if (index >= maxVisibleIndex) return;
                if (prefs.get_bool("showallips") || item.isRouteable) {
                    item.show();
                } else {
                    item.hide();
                }
            });
        },
        update: function (host) {
            var entriesIndex = 0;
            hostname.update(host, false, host.ipv4s, host.ipv6s);

            host.ipv6s.sort(function (a, b) {
                return dnsResolver.sort_ip6.call(dnsResolver, a, b);
            });
            host.ipv6s.forEach(function (address, index, addresses) {
                if (entries.length < entriesIndex + 1) {
                    entries.push(createIPEntry(doc, address_box).update(address, 6, false).hide());
                } else {
                    entries[entriesIndex].update(address, 6, false).hide();
                }
                entriesIndex++;
            });
            host.ipv4s.sort(function (a, b) {
                return dnsResolver.sort_ip4.call(dnsResolver, a, b);
            });
            host.ipv4s.forEach(function (address, index, addresses) {
                if (entries.length < entriesIndex + 1) {
                    entries.push(createIPEntry(doc, address_box).update(address, 4, false).hide());
                } else {
                    entries[entriesIndex].update(address, 4, false).hide();
                }
                entriesIndex++;
            });

            maxVisibleIndex = entriesIndex;

            // Hide additional entries
            entries.forEach(function (item, index, items) {
                if (index < entriesIndex) return;
                item.hide();
            });

            this.updateShowAllIPs();
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

    var updateShowingAll = function () {
        entries.forEach(function (item) {
            item.updateShowAllIPs();
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

    var showLocalObserver = prefs.createObserver("extensions.sixornot.showlocal", updateShowingLocal)
                                 .register();

    var showAllObserver = prefs.createObserver("extensions.sixornot.showallips", updateShowingAll)
                               .register();

    return {
        remove: function () {
            this.remove_all_entries();
            showLocalObserver.unregister();
            showAllObserver.unregister();
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

