/*
 * Copyright 2015 Timothy Baldock. All Rights Reserved.
 */

/* content script
    This is loaded for every browser window */

var content_script_id = Math.floor((Math.random() * 100000) + 1); 

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
var _log = log;
log = function (message, severity) {
    _log("SCS: " + content_script_id + ": " + message, severity);
};
var printCaches = function (text) {
    log(text + " - caches: ", 0);
    log("--" + requests.printWaitingList(), 0);
    log("--" + requests.printCache(), 0);
};

Components.utils.import("resource://sixornot/includes/dns.jsm");
dns_handler.init(); // TODO uninit on unload

Components.utils.import("resource://sixornot/includes/requestcache.jsm");

/* State */
var requests = createRequestCache();
var currentWindowId = 0;

log("content script loaded", 1);
sendAsyncMessage("sixornot@baldock.me:content-script-loaded", {id: content_script_id});

/* Message listeners */
addMessageListener("sixornot@baldock.me:http-initial-load", function (message) {
    log("got http-initial-load, host: '" + message.data.host + "', address: '" + message.data.address + "', address_family: " + message.data.addressFamily);

    // Items placed onto waiting list will be moved by DOMWindowCreated handler
    printCaches("http-initial-load before");
    requests.addOrUpdateToWaitingList(message.data);
    printCaches("http-initial-load after");

    updateUI(requests.get(currentWindowId));
});

addMessageListener("sixornot@baldock.me:http-load", function (message) {
    log("got http-load, host: " + message.data.host + ", address: " + message.data.address + ", address_family: " + message.data.addressFamily);

    printCaches("http-load before");
    requests.addOrUpdate(message.data, currentWindowId, dnsComplete);
    printCaches("http-load after");

    updateUI(requests.get(currentWindowId));
});

addMessageListener("sixornot@baldock.me:update-ui", function (message) {
    updateUI(requests.get(currentWindowId));
});

/* Message senders */
var updateUI = function (data) {
    //log("updating_ui: data: " + JSON.stringify(data));
    sendAsyncMessage("sixornot@baldock.me:update-ui", JSON.stringify(data));
};

var pageChange = function () {
    updateUI(requests.get(currentWindowId));
};

var dnsComplete = function () {
    updateUI(requests.get(currentWindowId));
};

/* Event listeners and observers */
addEventListener("DOMWindowCreated", function (event) {
    var newEntry;
    var win = event.originalTarget.defaultView;
    var utils = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                   .getInterface(Components.interfaces.nsIDOMWindowUtils);
    var inner = utils.currentInnerWindowID;
    var topWin = win.top;
    var topUtils = topWin.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                         .getInterface(Components.interfaces.nsIDOMWindowUtils);
    var topInner = topUtils.currentInnerWindowID;

    var protocol = event.originalTarget.defaultView.location.protocol;
    var hostname = event.originalTarget.defaultView.location.hostname;
    var loc = event.originalTarget.defaultView.location.href;

    log("DOMWindowCreated, inner: " + inner + ", topInner: " + topInner + ", hostname: '" + hostname + "', protocol: '" + protocol + "', location: '" + event.originalTarget.defaultView.location + "'", 0);

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
});

var windowObserver = {
    observe: function (subject, topic, data) {
        var innerId = subject.QueryInterface(Components.interfaces.nsISupportsPRUint64).data;
        log("inner-window-destroyed, id: " + innerId, 2);

        requests.remove(innerId);
    },

    register: function () {
        Services.obs.addObserver(this, "inner-window-destroyed", false);
    },

    unregister: function () {
        Services.obs.removeObserver(this, "inner-window-destroyed");
    }
};

windowObserver.register();

// TODO - unregister everything on unload
