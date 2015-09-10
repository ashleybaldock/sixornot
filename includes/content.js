/*
 * Copyright 2015 Timothy Baldock. All Rights Reserved.
 */

/* content script
    This is loaded for every browser window */

var contentScriptId = Math.floor((Math.random() * 100000) + 1); 

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
var _log = log;
log = function (message, severity) {
    _log("SCS: " + contentScriptId + ": " + message, severity);
};
var printCaches = function (text) {
    log(text + " - caches: ", 1);
    log("--" + requests.printWaitingList(), 1);
    log("--" + requests.printCache(), 1);
};

Components.utils.import("resource://sixornot/includes/dns.jsm");
dns_handler.init();

Components.utils.import("resource://sixornot/includes/requestcache.jsm");

/* State */
var requests = createRequestCache();
var currentWindowId = 0;
var unloaded = false;

log("content script loaded", 1);
sendAsyncMessage("sixornot@baldock.me:content-script-loaded", {id: contentScriptId});

/* Message handlers */
var onHttpInitialLoadMessage = function (message) {
    log("got http-initial-load, host: '" + message.data.host + "', address: '" + message.data.address + "', address_family: " + message.data.addressFamily);

    // Items placed onto waiting list will be moved by DOMWindowCreated handler
    printCaches("http-initial-load before");
    requests.addOrUpdateToWaitingList(message.data);
    printCaches("http-initial-load after");

    sendUpdateUIMessage(requests.get(currentWindowId));
};

var onHttpLoadMessage = function (message) {
    log("got http-load, host: " + message.data.host + ", address: " + message.data.address + ", address_family: " + message.data.addressFamily);

    printCaches("http-load before");
    requests.addOrUpdate(message.data, currentWindowId, dnsComplete);
    printCaches("http-load after");

    sendUpdateUIMessage(requests.get(currentWindowId));
};

var onUpdateUIMessage = function (message) {
    sendUpdateUIMessage(requests.get(currentWindowId));
};

/* Message senders */
var sendUpdateUIMessage = function (data) {
    sendAsyncMessage("sixornot@baldock.me:update-ui", JSON.stringify(data));
};

var pageChange = function () {
    sendUpdateUIMessage(requests.get(currentWindowId));
};

var dnsComplete = function () {
    sendUpdateUIMessage(requests.get(currentWindowId));
};

var onDOMWindowCreated = function (evt) {
    var newEntry;
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

    if (protocol === "file:") {
        newEntry = {host: "Local File", address: "", addressFamily: 1}
    } else if (protocol === "about:") {
        newEntry = {host: loc, address: "", addressFamily: 1};
    } else if (hostname) { // Ignore empty windows
        newEntry = {host: hostname, address: "", addressFamily: 0};
    }

    printCaches("DOMWindowCreated before");

    // All http-load events for this browser should now be associated with this inner ID
    currentWindowId = topInner;

    if (newEntry) { // Ignore empty windows
        // TODO only pick up waiting list entries if they match the domain
        // of the DOMWindowCreated event (to avoid picking up things from old pages)
        requests.addOrUpdateToWaitingList(newEntry);
    }

    requests.createOrExtendCacheEntry(newEntry ? newEntry.host : "", currentWindowId, dnsComplete);

    printCaches("DOMWindowCreated after");

    pageChange();
};

var windowObserver = {
    observe: function (subject, topic, data) {
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
    dns_handler.shutdown();
    removeEventListener("DOMWindowCreated", onDOMWindowCreated);
    windowObserver.unregister();
    removeMessageListener("sixornot@baldock.me:unload", onUnload);
    removeMessageListener("sixornot@baldock.me:http-initial-load", onHttpInitialLoadMessage);
    removeMessageListener("sixornot@baldock.me:http-load", onHttpLoadMessage);
    removeMessageListener("sixornot@baldock.me:update-ui", onUpdateUIMessage);
    unloaded = true;
};

addEventListener("unload", function (evt) {
    if (evt.target === this) {
        onUnload();
    }
});

/* Listen and observe */
addEventListener("DOMWindowCreated", onDOMWindowCreated);
windowObserver.register();
addMessageListener("sixornot@baldock.me:unload", onUnload);
addMessageListener("sixornot@baldock.me:http-initial-load", onHttpInitialLoadMessage);
addMessageListener("sixornot@baldock.me:http-load", onHttpLoadMessage);
addMessageListener("sixornot@baldock.me:update-ui", onUpdateUIMessage);

