/*
 * Copyright 2016 Ashley Baldock. All Rights Reserved.
 */

/* content script
    This is loaded for every browser window */

/* Unique ID used for logging */
var contentScriptId = Math.floor((Math.random() * 100000) + 1); 

/* global sendAsyncMessage, addMessageListener, removeMessageListener, log:true, createRequestCache, cacheEntry */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://sixornot/content/logger.jsm");
Components.utils.import("chrome://sixornot/content/requestcache.jsm");
var _log = log;
log = function (message, severity) {
    _log("SCS: " + contentScriptId + ": " + message, severity);
};
/*var printCaches = function (text) {
    log(text + " - caches: ", 1);
    log("--" + requests.printWaitingList(), 1);
    log("--" + requests.printCache(), 1);
};*/

/* State */
var requests = createRequestCache();
var currentTopId = 0;

/* Messaging */
var onHttpInitialLoadMessage = function (message) {
    var entry = message.data;
    log("got http-initial-load, host: '" + entry.host + "', address: '" + entry.ip.address + "', family: " + entry.ip.family, 1);

    /* Initial HTTP load doesn't have an associated innerId, place on waiting list
     * Anything on the list when DOMWindowCreated is fired ends up as part of that id
     */
    requests.clearWaitingList();
    requests.addOrUpdateWaitingList(entry);

    updateUI();
};

var onHttpLoadMessage = function (message) {
    var entry = message.data.entry, id = message.data.id;
    log("got http-load, id: " + id + ", host: " + entry.host + ", address: " + entry.ip.address + ", family: " + entry.ip.family, 1);

    log(requests.printCache(), 1);
    requests.update(entry, id);

    updateUI();
};

var onUpdateUIMessage = function () {
    updateUI();
};

var updateUI = function () {
    sendAsyncMessage("sixornot@baldock.me:update-ui", JSON.stringify(requests.get(currentTopId)));
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

    //log("DOMWindowCreated, innerId: " + innerId + ", topId: " + topId + ", hostname: '" + hostname + "', protocol: '" + protocol + "', location: '" + evt.originalTarget.defaultView.location + "'", 1);

    if (innerId === topId) {
        currentTopId = topId;

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
        requests.addOrUpdateWaitingList(entry);

        requests.createFromWaitingList(entry.host, currentTopId);
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
    log = null;
    _log = null;
};

/* Listen and observe */
windowObserver.register();
addEventListener("DOMWindowCreated", onDOMWindowCreated);
addEventListener("unload", onUnload);
addMessageListener("sixornot@baldock.me:unload", onUnload);
addMessageListener("sixornot@baldock.me:http-initial-load", onHttpInitialLoadMessage);
addMessageListener("sixornot@baldock.me:http-load", onHttpLoadMessage);
addMessageListener("sixornot@baldock.me:update-ui", onUpdateUIMessage);

log("content script loaded", 2);
sendAsyncMessage("sixornot@baldock.me:content-script-loaded", {id: contentScriptId});

