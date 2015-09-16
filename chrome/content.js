/*
 * Copyright 2015 Timothy Baldock. All Rights Reserved.
 */

/* content script
    This is loaded for every browser window */

var contentScriptId = Math.floor((Math.random() * 100000) + 1); 

/* global sendAsyncMessage, addMessageListener, removeMessageListener, log:true, createRequestCache, cacheEntry */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://sixornot/content/logger.jsm");
var _log = log;
log = function (message, severity) {
    _log("SCS: " + contentScriptId + ": " + message, severity);
};
/*var printCaches = function (text) {
    log(text + " - caches: ", 1);
    log("--" + requests.printWaitingList(), 1);
    log("--" + requests.printCache(), 1);
};*/

Components.utils.import("chrome://sixornot/content/requestcache.jsm");

/* State */
var requests = createRequestCache();
var currentWindowId = 0;

log("content script loaded", 1);
sendAsyncMessage("sixornot@baldock.me:content-script-loaded", {id: contentScriptId});

/* Message handlers */
var onHttpInitialLoadMessage = function (message) {
    log("got http-initial-load, host: '" + message.data.host + "', address: '" + message.data.ip.address + "', family: " + message.data.ip.family, 1);

    // Items placed onto waiting list will be moved by DOMWindowCreated handler
    requests.addOrUpdateToWaitingList(message.data);

    sendUpdateUIMessage(requests.get(currentWindowId));
};

var onHttpLoadMessage = function (message) {
    log("got http-load, host: " + message.data.host + ", address: " + message.data.ip.address + ", family: " + message.data.ip.family, 1);

    requests.addOrUpdate(message.data, currentWindowId);

    sendUpdateUIMessage(requests.get(currentWindowId));
};

var onUpdateUIMessage = function () {
    sendUpdateUIMessage(requests.get(currentWindowId));
};

/* Message senders */
var sendUpdateUIMessage = function (data) {
    sendAsyncMessage("sixornot@baldock.me:update-ui", JSON.stringify(data));
};

var pageChange = function () {
    sendUpdateUIMessage(requests.get(currentWindowId));
};

var onDOMWindowCreated = function (evt) {
    var win = evt.originalTarget.defaultView;
    var utils = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                   .getInterface(Components.interfaces.nsIDOMWindowUtils);
    var inner = utils.currentInnerWindowID;
    var topWin = win.top;
    var topUtils = topWin.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                         .getInterface(Components.interfaces.nsIDOMWindowUtils);
    var topInner = topUtils.currentInnerWindowID;

    var protocol = evt.originalTarget.defaultView.location.protocol;
    var hostname = evt.originalTarget.defaultView.location.hostname;
    var loc = evt.originalTarget.defaultView.location.href;

    log("DOMWindowCreated, inner: " + inner + ", topInner: " + topInner + ", hostname: '" + hostname + "', protocol: '" + protocol + "', location: '" + evt.originalTarget.defaultView.location + "'", 0);

    var entry = cacheEntry.create();

    if (protocol === "file:") {
        entry.host = "Local File";
        entry.ip.family = 1;
        requests.addOrUpdateToWaitingList(entry);
    } else if (protocol === "about:" || protocol === "resource:" || protocol === "chrome:") {
        entry.host = loc;
        entry.ip.family = 1;
        requests.addOrUpdateToWaitingList(entry);
    } else if (hostname) {
        entry.host = hostname; // Don't add to waiting list, should be done by http initial load
    }

    // All http-load events for this browser should now be associated with this inner ID
    currentWindowId = topInner;

    requests.createOrExtendCacheEntry(entry.host, currentWindowId);

    pageChange();
};

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

var onUnloadEvent = function (evt) {
    if (evt.target === this) {
        onUnload();
    }
};

var onUnload = function () {
    log("onUnload", 0);
    requests = null; // TODO requestcache clear all method?
    removeEventListener("DOMWindowCreated", onDOMWindowCreated);
    removeEventListener("unload", onUnloadEvent);
    windowObserver.unregister();
    removeMessageListener("sixornot@baldock.me:unload", onUnload);
    removeMessageListener("sixornot@baldock.me:http-initial-load", onHttpInitialLoadMessage);
    removeMessageListener("sixornot@baldock.me:http-load", onHttpLoadMessage);
    removeMessageListener("sixornot@baldock.me:update-ui", onUpdateUIMessage);
};

/* Listen and observe */
windowObserver.register();
addEventListener("DOMWindowCreated", onDOMWindowCreated);
addEventListener("unload", onUnloadEvent);
addMessageListener("sixornot@baldock.me:unload", onUnload);
addMessageListener("sixornot@baldock.me:http-initial-load", onHttpInitialLoadMessage);
addMessageListener("sixornot@baldock.me:http-load", onHttpLoadMessage);
addMessageListener("sixornot@baldock.me:update-ui", onUpdateUIMessage);

