/*
 * Copyright 2015-2016 Ashley Baldock. All Rights Reserved.
 */

/* global gt, ipUtils, dnsResolver, util, getMessanger, unload, prefs, createLocalAddressInfo */
/*Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://sixornot/content/utility.jsm");
Components.utils.import("chrome://sixornot/content/locale.jsm");
Components.utils.import("chrome://sixornot/content/prefs.jsm");
Components.utils.import("chrome://sixornot/content/dns.jsm");
Components.utils.import("chrome://sixornot/content/windowwatcher.jsm");
Components.utils.import("chrome://sixornot/content/messanger.jsm");

/* exported createPanel */
/*var EXPORTED_SYMBOLS = ["createPanel"];

/* Creates and sets up a panel to display information which can then be bound to an icon */
/*var createPanel = function (win, panelId) {
    var doc = win.document;

    /* Called by content script of active tab */
 /*   var updateUI = function (data) {
        remoteAnchor.updateModel(data);
        adjustForScrollbar();
    };

    var messanger = getMessanger(win, updateUI);

    /* Add space for scrollbar if one is showing */
    var adjustForScrollbar = function () {
        if (panelVbox.scrollHeight > panel.clientHeight) {
            panelVbox.style.paddingRight = "20px";
        } else {
            panelVbox.style.paddingRight = "0";
        }
    };

/*    var onPopupShowing = function () {
        messanger.subscribeToCurrentBrowser();
        messanger.requestUpdate();
        localAnchor.panelShowing();
    };

    var onPopupHiding = function () {
        messanger.unsubscribe();
        localAnchor.panelHiding();
    };

    var onClickSettingsLink = function (evt) {
        panel.hidePopup();
        util.openPreferences();
        evt.stopPropagation();
    };

    var onClickDocLink = function (evt) {
        panel.hidePopup();
        util.openHyperlink(gt("sixornot_weblink"));
        evt.stopPropagation();
    };

    /* Panel UI */
    /*var panel = doc.createElement("panel");
    panel.setAttribute("type", "arrow");
    panel.setAttribute("id", panelId);
    panel.setAttribute("flip", "slide");
    panel.setAttribute("hidden", true);
    panel.setAttribute("position", "bottomcenter topright");
    panel.classList.add("sixornot-panel");

    /* Contains all other elements in panel */
    /*var panelVbox = doc.createElement("vbox");
    panelVbox.setAttribute("flex", "1");
    panelVbox.style.overflowY = "auto";
    panelVbox.style.overflowX = "hidden";
    panel.appendChild(panelVbox);

    /* Grid into which address entries are put */
    /*var grid = doc.createElement("grid");
    var gridRows = doc.createElement("rows");
    var gridCols = doc.createElement("columns");
    gridCols.appendChild(doc.createElement("column")); // icon
    gridCols.appendChild(doc.createElement("column")); // sslinfo
    gridCols.appendChild(doc.createElement("column")); // proxyinfo
    gridCols.appendChild(doc.createElement("column")); // count
    gridCols.appendChild(doc.createElement("column")); // host
    gridCols.appendChild(doc.createElement("column")); // address
    gridCols.appendChild(doc.createElement("column")); // showhide
    grid.appendChild(gridCols);
    grid.appendChild(gridRows);
    panelVbox.appendChild(grid);

    /* Anchors are locations to insert entries into grid */
   /* var remoteAnchor = createRemoteAnchor(doc, gridRows);
    var localAnchor = createLocalAnchor(doc, gridRows);

    /* Links at bottom of panel */
    /* Settings */
    /*var settingsLink = doc.createElement("label");
    settingsLink.setAttribute("value", gt("header_settings"));
    settingsLink.setAttribute("tooltiptext", gt("tt_open_settings"));
    util.setLink(settingsLink);
    util.setTitle(settingsLink);

    /* Documentation link */
    /*var docLink = doc.createElement("label");
    docLink.setAttribute("value", gt("sixornot_documentation"));
    util.setLink(docLink);
    util.setTitle(docLink);
    docLink.setAttribute("tooltiptext", gt("tt_gotowebsite"));

    var spacer = doc.createElement("label");
    spacer.setAttribute("value", " - ");
    util.setTitle(spacer);

    var makeSpacer = function () {
        var spacer = doc.createElement("spacer");
        spacer.setAttribute("flex", "1");
        return spacer;
    };

    /* Add everything to parent node */
    /*var urlhbox = doc.createElement("hbox");
    urlhbox.appendChild(makeSpacer());
    urlhbox.appendChild(settingsLink);
    urlhbox.appendChild(spacer);
    urlhbox.appendChild(docLink);
    urlhbox.appendChild(makeSpacer());
    urlhbox.setAttribute("align", "center");
    urlhbox.style.marginTop = "3px";
    gridRows.appendChild(urlhbox);

    /* Subscribe to events */
    /*settingsLink.addEventListener("click", onClickSettingsLink, false);
    docLink.addEventListener("click", onClickDocLink, false);
    panel.addEventListener("popupshowing", onPopupShowing, false);
    panel.addEventListener("popuphiding", onPopupHiding, false);

    unload(function () {
        messanger.shutdown();
        panel.removeEventListener("popupshowing", onPopupShowing, false);
        panel.removeEventListener("popuphiding", onPopupHiding, false);
        remoteAnchor.remove(); // Removes child event listeners
        localAnchor.remove(); // Removes child event listeners
        settingsLink.removeEventListener("click", onClickSettingsLink, false);
        docLink.removeEventListener("click", onClickDocLink, false);

        // Remove UI
        if (panel.parentNode) {
            panel.parentNode.removeChild(panel);
        }
    }, win);

    return panel;
};

//var createIPEntry = function (doc, addto) {
    /*var conipaddr = doc.createElement("label");
    addto.appendChild(conipaddr);

    var copyText = "";
    var copyToClipboard = function (evt) {
        util.copyToClipboard(copyText);
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
        },*/
        update: function (ip, showAsProxy) {
            if (ip.family === 6 || ip.family === 4) {
                if (showAsProxy) {
                    conipaddr.setAttribute("value", "(" + ip.address + ")");
                } else {
                    conipaddr.setAttribute("value", ip.address);
                }
                copyText = ip.address;
                conipaddr.setAttribute("tooltiptext", gt("tt_copyaddr"));
                util.setLink(conipaddr);
            } else if (ip.family === 2) {
                conipaddr.setAttribute("value", gt("addr_cached"));
                copyText = "";
            } else {
                conipaddr.setAttribute("value", gt("addr_unavailable"));
                copyText = "";
            }
            return this;
        },/*
        remove: function () {
            conipaddr.removeEventListener("click", copyToClipboard, false);
            addto.removeChild(conipaddr);
        }
    };
};*/

//var createIPs = function (doc, addto) {
   /* var addressBox = doc.createElement("vbox");
    addto.appendChild(addressBox);

    var showhide = doc.createElement("label");
    showhide.setAttribute("value", "");
    util.setLink(showhide);
    addto.appendChild(showhide);

    var entries = [];
    var hostCache;
    var ipsCache;
    var showing;

    var countDnsAddresses = function (host, ips) {
        var count = 0;
        ips.forEach(function (ip) {
            if (ip.address !== host.ip.address) {
                count += 1;
            }
        });
        return count;
    };*/

    /*var obj = {
        init: function (host, initialShow) {
            showing = initialShow;
        },
        update: function (host, ips) {
            var count = countDnsAddresses(host, ips);

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
                    createIPEntry(doc, addressBox)
                        .update(host.ip, host.proxy.type === "http"));
            }

            entries[0].update(host.ip, host.proxy.type === "http");
            // Regenerate additional address entries
            var entriesIndex = 1;
            if (showing) {
                ips.forEach(function (ip) {
                    if (ip.address !== host.ip.address) {
                        if (entries.length < entriesIndex + 1) {
                            entries.push(createIPEntry(doc, addressBox).update(ip, false));
                        } else {
                            // Update existing
                            entries[entriesIndex].update(ip, false).show();
                        }
                        entriesIndex++;
                    }
                });
            }
            // Hide additional entries
            entries.forEach(function (item, index) {
                if (index < entriesIndex) return;
                item.hide();
            });

            hostCache = host;
            ipsCache = ips;
        },
        remove: function () {
            entries.forEach(function (item) {
                try {
                    item.remove();
                } catch (e) {
                    Components.utils.reportError(e);
                }
            });
            entries = [];
            showhide.removeEventListener("click", toggleDetail, false);
            addto.removeChild(showhide);
            addto.removeChild(addressBox);
        }
    };

    var toggleDetail = function (evt) {
        evt.stopPropagation();
        showing = !showing;
        obj.update(hostCache, ipsCache);
    };

    showhide.addEventListener("click", toggleDetail, false);

    return obj;
};*/

/*var createIcon = function (doc, addto) {
    var icon = doc.createElement("image");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    addto.appendChild(icon);

    return {
        update: function (host, ips) {
            util.setSixornotClass(icon, host, ips);
        },
        remove: function () {
            addto.removeChild(icon);
        }
    };
};

/*var createSSLInfo = function (doc, addto) {
    var sslinfo = doc.createElement("image");
    sslinfo.setAttribute("height", "16");
    addto.appendChild(sslinfo);

    return {
        update: function (host) {*/
            /*util.setSecurityClass(sslinfo, host);
            if (host.security.cipherName) {
                sslinfo.setAttribute("tooltiptext", host.security.cipherName);
                sslinfo.setAttribute("width", "16");
            } else {
                sslinfo.setAttribute("tooltiptext", "");
                sslinfo.setAttribute("width", "0");
            }/*
        },
        remove: function () {
            addto.removeChild(sslinfo);
        }
    };
};*/

/*var createProxyInfo = function (doc, addto) {
    var proxyinfo = doc.createElement("image");
    proxyinfo.setAttribute("height", "16");
    addto.appendChild(proxyinfo);

    return {
        update: function (host) {
            util.setProxyClass(proxyinfo, host);
            if (host.proxy.type === "http") {
                proxyinfo.setAttribute("width", "16");
                proxyinfo.setAttribute("tooltiptext",
                    gt("proxy_base", [
                        gt("proxy_http"), host.proxy.host,
                        host.proxy.port, gt("proxy_lookups_disabled")
                    ]));
            } else if (host.proxy.type === "https") {
                proxyinfo.setAttribute("width", "16");
                proxyinfo.setAttribute("tooltiptext",
                    gt("proxy_base", [
                        gt("proxy_https"), host.proxy.host,
                        host.proxy.port, gt("proxy_lookups_disabled")
                    ]));
            } else if (host.proxy.type === "socks4") {
                proxyinfo.setAttribute("width", "16");
                proxyinfo.setAttribute("tooltiptext",
                    gt("proxy_base", [
                        gt("proxy_socks4"), host.proxy.host, host.proxy.port,
                        host.proxy.proxyResolvesHost ? gt("proxy_lookups_disabled") : ""
                    ]));
            } else if (host.proxy.type === "socks") {
                proxyinfo.setAttribute("width", "16");
                proxyinfo.setAttribute("tooltiptext",
                    gt("proxy_base", [
                        gt("proxy_socks5"), host.proxy.host, host.proxy.port,
                        host.proxy.proxyResolvesHost ? gt("proxy_lookups_disabled") : ""
                    ]));
            } else {
                proxyinfo.setAttribute("width", "0");
                proxyinfo.setAttribute("tooltiptext", "");
            }
        },
        remove: function () {
            addto.removeChild(proxyinfo);
        }
    };
};*/

/*var createCount = function (doc, addto) {
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
};*/

var createHostname = function (doc, addto) {
    var hostname = doc.createElement("label");
    addto.appendChild(hostname);

    var copyText = "";
    var copyToClipboard = function (evt) {
        util.copyToClipboard(copyText);
        evt.stopPropagation();
    };
    hostname.addEventListener("click", copyToClipboard, false);

    return {
        update: function (host, mainhost, ips) {
            var text = host.host;

            hostname.setAttribute("value", host.host);
            host.host === mainhost ? util.enableBold(hostname) : util.disableBold(hostname);
            hostname.setAttribute("tooltiptext", gt("tt_copydomclip"));

            if (host.ip.address !== "") {
                text = text + "," + host.ip.address;
            }
            ips.forEach(function (ip) {
                if (ip.address !== host.ip.address) {
                    text = text + "," + ip.address;
                }
            });
            copyText = text;
            util.setLink(hostname);
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
/*var createRemoteListingRow = function (doc, addafter, host, mainhost) {
    var row = doc.createElement("row");
    row.setAttribute("align", "start");
    var icon = createIcon(doc, row);
    var count = createCount(doc, row);
    var sslinfo = createSSLInfo(doc, row);
    var proxyinfo = createProxyInfo(doc, row);
    var hostname = createHostname(doc, row);
    var ipAddresses = createIPs(doc, row);

    var ips = [];

    /* Update elements on create */
    /*icon.update(host, ips);
    hostname.update(host, mainhost, ips);
    count.update(host);
    sslinfo.update(host);
    proxyinfo.update(host);
    ipAddresses.init(host, host.host === mainhost);
    ipAddresses.update(host, ips);

    /* Add this element after the last one */
    /*addafter.addAfter(row);

    /* Do DNS lookup for host */
    var dnsCancel;

    if (!(host.ip.family === 1
     || host.proxy.type === "http"
     || host.proxy.type === "https"
     || host.proxy.proxyResolvesHost)) {
        dnsCancel = dnsResolver.resolveRemote(host.host, function (results) {
            dnsCancel = null;
            if (results.success) {
                ips = results.addresses.sort(ipUtils.sort);
            } else {
                ips = [];
            }
            hostname.update(host, mainhost, ips);
            icon.update(host, ips);
            ipAddresses.update(host, ips);
        });
    }

    /* Object representing row of entry */
    /*return {
        host: host.host,
        remove: function () {
            if (dnsCancel) { dnsCancel.cancel(); }
            icon.remove();
            hostname.remove();
            count.remove();
            sslinfo.remove();
            proxyinfo.remove();
            ipAddresses.remove();
            row.parentNode.removeChild(row);
        },
        addAfter: function (element) {
            /* Add the element specified immediately after this one in the DOM */
/*            if (row.nextSibling) {
                row.parentNode.insertBefore(element, row.nextSibling);
            } else {
                row.parentNode.appendChild(element);
            }
        },
        update: function (host, mainhost) {
            icon.update(host, ips);
            hostname.update(host, mainhost, ips); // To update copy/paste text
            count.update(host);
            sslinfo.update(host);
            proxyinfo.update(host);
            ipAddresses.update(host, ips);
        }
    };
};*/

/*var createRemoteAnchor = function (doc, parentElement) {
    var model = { id: 0 };
    var entries = [];

    var titleRemote = doc.createElement("label");
    titleRemote.setAttribute("value", gt("header_remote"));
    util.setTitle(titleRemote);
    parentElement.appendChild(titleRemote);

    return {
        addAfter: function (element) {
            if (titleRemote.nextSibling) {
                parentElement.insertBefore(element, titleRemote.nextSibling);
            } else {
                parentElement.appendChild(element);
            }
        },
        remove: function () {
            this.removeAllEntries();
        },
        removeAllEntries: function () {
            entries.forEach(function (item) {
                try {
                    item.remove();
                } catch (e) {
                    Components.utils.reportError(e);
                }
            });
            entries = [];
        },
        updateModel: function (newModel) {
            if (model.id !== newModel.id) {
                // If model.id does not match, regenerate from scratch
                this.removeAllEntries();
            }
            model = newModel;
            this.update();
        },
        update: function () {
            // Ordering of entries never changes
            // New entries may be inserted anywhere (supports alphabetical ordering)
            // model may have more items than entries
            var entriesIndex = 0;
            model.entries.forEach(function(item) {
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
};*/

var createLocalListingRow = function (doc, addafter) {
    var row = doc.createElement("row");
    row.setAttribute("align", "start");
    var updateRowVisibility = function () {
        prefs.getBool("showlocal") ? util.setShowing(row) : util.setHidden(row);
    };
    updateRowVisibility();

    /* Add this element after the last one */
    addafter.addAfter(row);

    // Four spacers since local rows don't have icon, sslinfo, proxyinfo or count
    row.appendChild(doc.createElement("label"));
    row.appendChild(doc.createElement("label"));
    var sslinfoSpacer = doc.createElement("image");
    sslinfoSpacer.setAttribute("width", "0");
    util.setSecurityClass(sslinfoSpacer);
    row.appendChild(sslinfoSpacer);
    var proxyinfoSpacer = doc.createElement("image");
    proxyinfoSpacer.setAttribute("width", "0");
    util.setProxyClass(proxyinfoSpacer);
    row.appendChild(proxyinfoSpacer);

    var hostname = createHostname(doc, row);

    var addressBox = doc.createElement("vbox");
    row.appendChild(addressBox);

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
        update: function (localhost) {
            var entriesIndex = 0;

            var ipsFiltered;
            if (prefs.getBool("showallips")) {
                ipsFiltered = localhost.ips;
            } else {
                ipsFiltered = localhost.ips.filter(ipUtils.isRouteable);
            }

            hostname.update(localhost, false, ipsFiltered);

            ipsFiltered.forEach(function (address) {
                if (entries.length < entriesIndex + 1) {
                    entries.push(createIPEntry(doc, addressBox).update(address, false));
                } else {
                    entries[entriesIndex].update(address, false).show();
                }
                entriesIndex++;
            });

            // Hide additional entries
/*            entries.forEach(function (item, index) {
                if (index < entriesIndex) return;
                item.hide();
            });
        },
        /* Adds the contents of this object after the specified element */
/*        addAfter: function (element) {
            if (this.row.nextSibling) {
                this.row.parentNode.insertBefore(element, this.row.nextSibling);
            } else {
                this.row.parentNode.appendChild(element);
            }
        },
        updateVisibility: function () {
            updateRowVisibility();
        }
    };
};*/

var createLocalAnchor = function (doc, parentElement) {
    var title = doc.createElement("label");
    title.setAttribute("value", gt("header_local"));
    util.setTitle(title);

    var updateShowingLocal = function () {
        setShowhideText();
        entries.forEach(function (item) {
            item.updateVisibility();
        });
    };

    var cachedHost;
    var updateShowingAll = function () {
        if (!cachedHost) return;
        entries.forEach(function (item) {
            item.update(cachedHost);
        });
    };

    var toggleShowingLocal = function (evt) {
        prefs.setBool("showlocal", !prefs.getBool("showlocal"));
        evt.stopPropagation();
    };

    var makeSpacer = function () {
        var spacer = doc.createElement("spacer");
        spacer.setAttribute("flex", "1");
        return spacer;
    };

    var showhide = doc.createElement("label");
    util.setLink(showhide);
    util.setTitle(showhide);

    var showhideSpacer = doc.createElement("label");
    util.setTitle(showhideSpacer);
    showhideSpacer.classList.add("sixornot-hidden");

    var setShowhideText = function () {
        if (prefs.getBool("showlocal")) {
            showhide.setAttribute("value", "[" + gt("hide_text") + "]");
            showhide.setAttribute("tooltiptext", gt("tt_hide_local"));
            showhideSpacer.setAttribute("value", "[" + gt("hide_text") + "]");
        } else {
            showhide.setAttribute("value", "[" + gt("show_text") + "]");
            showhide.setAttribute("tooltiptext", gt("tt_show_local"));
            showhideSpacer.setAttribute("value", "[" + gt("hide_text") + "]");
        }
    };

/*    setShowhideText();

    var hbox = doc.createElement("hbox");
    hbox.appendChild(showhideSpacer);
    hbox.appendChild(makeSpacer());
    hbox.appendChild(title);
    hbox.appendChild(makeSpacer());
    hbox.appendChild(showhide);
    hbox.setAttribute("align", "center");
    hbox.style.marginTop = "3px";
    parentElement.appendChild(hbox);

    showhide.addEventListener("click", toggleShowingLocal, false);

    var showLocalObserver = prefs.createObserver("extensions.sixornot.showlocal", updateShowingLocal)
                                 .register();

    var showAllObserver = prefs.createObserver("extensions.sixornot.showallips", updateShowingAll)
                               .register();

    var localAddressInfo = createLocalAddressInfo();
/*    var entries = [];
    return {
        remove: function () {
            showLocalObserver.unregister();
            showAllObserver.unregister();
            showhide.removeEventListener("click", toggleShowingLocal, false);
            this.removeAllEntries();
        },
        update: function (host) {
            cachedHost = host;
            if (entries.length <= 0) {
                // For now entries only ever contains one thing
                entries.push(createLocalListingRow(doc, this));
            }
            entries.forEach(function (item) {
                item.update(host);
            });
        },
        addAfter: function (element) {
            if (hbox.nextSibling) {
                parentElement.insertBefore(element, hbox.nextSibling);
            } else {
                parentElement.appendChild(element);
            }
        },
        removeAllEntries: function () {
            entries.forEach(function (item) {
                try {
                    item.remove();
                } catch (e) {
                    Components.utils.reportError(e);
                }
            });
            entries = [];
        },
        panelHiding : function () {
            localAddressInfo.cancel();
        },
        panelShowing : function () {
            localAddressInfo.get(this.update, this);
        }
    };
};*/

