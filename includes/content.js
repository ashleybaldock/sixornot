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
dns_handler.init(); // TODO uninit on unload (or pass requests out to chrome process)

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

    observerService: Components.classes["@mozilla.org/observer-service;1"]
                         .getService(Components.interfaces.nsIObserverService),

    register: function () {
        this.observerService.addObserver(this, "inner-window-destroyed", false);
    },

    unregister: function () {
        this.observerService.removeObserver(this, "inner-window-destroyed");
    }
};

windowObserver.register();

// TODO - unregister everything on unload
