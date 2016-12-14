/*
 * Copyright 2016 Ashley Baldock. All Rights Reserved.
 */

/* content script
    This is loaded for every browser window */

/* global sendAsyncMessage, addMessageListener, removeMessageListener, createRequestCache, cacheEntry */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://sixornot/content/requestcache.jsm");

/* State */
var requests = createRequestCache();

/* Messaging */
var onHttpInitialLoadMessage = function (message) {
    var entry = message.data;
    // Initial HTTP load doesn't have an associated innerId, wait until DOMWindowCreated fires and then copy
    requests.setWaiting(entry);
    updateUI();
};

var onHttpLoadMessage = function (message) {
    var entry = message.data.entry, id = message.data.id;
    requests.update(id, entry);
    updateUI();
};

var onUpdateUIMessage = function () {
    updateUI();
};

var updateUI = function () {
    sendAsyncMessage("sixornot@baldock.me:update-ui", JSON.stringify(requests.getCurrent()));
};

/* Event handling */
var onDOMWindowCreated = function (evt) {
    var win = evt.originalTarget.defaultView;
    var innerId = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                     .getInterface(Components.interfaces.nsIDOMWindowUtils)
                     .currentInnerWindowID;
    var topId = win.top.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                       .getInterface(Components.interfaces.nsIDOMWindowUtils)
                       .currentInnerWindowID;

    var protocol = win.location.protocol;
    var hostname = win.location.hostname;
    var loc = win.location.href;

    if (innerId === topId) {
        var entry = cacheEntry.create();

        if (protocol === "file:") {
            entry.host = "Local File";
            entry.ip.family = 1;
        } else if (protocol === "about:" || protocol === "resource:" || protocol === "chrome:") {
            entry.host = loc;
            entry.ip.family = 1;
        } else if (hostname) {
            entry.host = hostname;
        }

        requests.setCurrent(topId, entry);
    } else {
        requests.deOrphan(innerId, topId);
    }

    updateUI();
};

// TODO - build this into requestcache
var windowObserver = {
    observe: function (subject) {
        var innerId = subject.QueryInterface(Components.interfaces.nsISupportsPRUint64).data;
        requests.remove(innerId);
    },
    register: function () {
        Services.obs.addObserver(this, "inner-window-destroyed", false);
    },
    unregister: function () {
        Services.obs.removeObserver(this, "inner-window-destroyed");
    }
};

var onUnload = function () {
    removeEventListener("DOMWindowCreated", onDOMWindowCreated);
    removeEventListener("unload", onUnload);
    windowObserver.unregister();
    removeMessageListener("sixornot@baldock.me:unload", onUnload);
    removeMessageListener("sixornot@baldock.me:http-initial-load", onHttpInitialLoadMessage);
    removeMessageListener("sixornot@baldock.me:http-load", onHttpLoadMessage);
    removeMessageListener("sixornot@baldock.me:update-ui", onUpdateUIMessage);
    requests = null; // TODO requestcache clear all method?
};

/* Listen and observe */
windowObserver.register();
addEventListener("DOMWindowCreated", onDOMWindowCreated);
addEventListener("unload", onUnload);
addMessageListener("sixornot@baldock.me:unload", onUnload);
addMessageListener("sixornot@baldock.me:http-initial-load", onHttpInitialLoadMessage);
addMessageListener("sixornot@baldock.me:http-load", onHttpLoadMessage);
addMessageListener("sixornot@baldock.me:update-ui", onUpdateUIMessage);

sendAsyncMessage("sixornot@baldock.me:content-script-loaded", {});

