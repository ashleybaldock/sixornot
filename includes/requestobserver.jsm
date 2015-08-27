/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2008-2015 Timothy Baldock. All Rights Reserved.
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

/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/requestcache.jsm");
/*jslint es5: false */

var EXPORTED_SYMBOLS = ["HTTP_REQUEST_OBSERVER"];

/*
 * Create an event of the specified type and dispatch it to the specified element
 * Return boolean indicating if the event has been cancelled
 * Event type one of:
 *  sixornot-dns-lookup-event
 *  sixornot-count-change-event
 *  sixornot-address-change-event
 *  sixornot-new-host-event
 *  sixornot-page-change-event
 */
var send_event = function (type, target, entry) {
    // Create an event to inform listeners that a new page load has started
    // We do this now since it's only now that we know the innerID of the page
    var evt = target.top.document.createEvent("CustomEvent");

    // Event's payload is basic info to allow lookup of entry from request cache
    evt.initCustomEvent(type, true, true, {
        host: entry.host,
        inner_id: entry.inner_id,
        outer_id: entry.outer_id
    });

    //log("Sixornot - send_event of type: " + type + ", to target: " + target + " with payload: " + JSON.stringify(evt.detail), 2);

    // Dispatch the event
    return target.top.dispatchEvent(evt);
};


/* Check an inner window ID against all browser windows, return true if it matches
   Used to check for favicon loading by chrome window */
var check_inner_id = function (inner_id) {
    var enumerator, win, utils, win_inner;
    enumerator = Services.wm.getEnumerator("navigator:browser");
    while(enumerator.hasMoreElements()) {
        win = enumerator.getNext();
        utils = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                    .getInterface(Components.interfaces.nsIDOMWindowUtils);
        if (inner_id === utils.currentInnerWindowID) {
            return true;
        }
    }
    return false;
};

var on_examine_response = function(subject, topic) {
    var http_channel, http_channel_internal, nC,
        domWindow, domWindowUtils, domWindowInner, domWindowOuter,
        original_window, new_page, new_entry,
        e1, e2, remoteAddress, remoteAddressFamily
    http_channel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
    http_channel_internal = subject.QueryInterface(Components.interfaces.nsIHttpChannelInternal);

    // Fetch DOM window associated with this request
    nC = http_channel.notificationCallbacks;
    if (!nC) {
        if (http_channel.loadGroup) {
            nC = http_channel.loadGroup.notificationCallbacks;
        }
    }
    if (!nC) {
        // Unable to determine which window intiated this http request
        log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response: Unable to determine notificationCallbacks for this http_channel", 1);
        return;
    }

    var topFrameMM;

    try {

        var loadContext = nC.getInterface(Components.interfaces.nsILoadContext);
        var topFrameElement = loadContext.topFrameElement;  // TODO - will this always be the browser element, e.g. for iframes?
        topFrameMM = topFrameElement.messageManager;

        domWindowOuter = topFrameElement.outerWindowID;
        log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response: DOM request, outer_id: " + domWindowOuter, 2);

    } catch (e2) {
        log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response: non-DOM request", 1);
        return;
    }

    // Check for browser windows loading things like favicons and filter out
    if (!loadContext.isContent) {
        log("Sixornot - HTTP_REQUEST_OBSERVER: loadContext is not content - skipping", 1);
        return;
    }

    // Extract address information
    if (topic === "http-on-examine-response") {
        try {
            remoteAddress = http_channel_internal.remoteAddress;
            remoteAddressFamily = remoteAddress.indexOf(":") === -1 ? 4 : 6;
        } catch (e1) {
            log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response: remoteAddress was not accessible for: " + http_channel.URI.spec, 1);
            remoteAddress = "";
            remoteAddressFamily = 0;
        }
    } else {
        log("Sixornot - HTTP_REQUEST_OBSERVER - NOT http-on-examine-response: remoteAddress was not accessible for: " + http_channel.URI.spec, 1);
        remoteAddress = "";
        remoteAddressFamily = 2;
    }

    log("Sixornot - HTTP_REQUEST_OBSERVER - http-on-examine-response: Processing " + http_channel.URI.host + " (" + (remoteAddress || "FROM_CACHE") + ")", 1);

    /*jslint bitwise: true */
    // TODO - need to determine if this is a load from an embedded frame/iframe
    if (http_channel.loadFlags & Components.interfaces.nsIChannel.LOAD_INITIAL_DOCUMENT_URI) {
    /*jslint bitwise: false */

        topFrameMM.sendAsyncMessage("sixornot@baldock.me:http-load", {
            host: http_channel.URI.host,
            address: remoteAddress,
            address_family: remoteAddressFamily
        });
        return;


        if (!requests.waitinglist[domWindowOuter]) {
            requests.waitinglist[domWindowOuter] = [];
        }

        if (!requests.waitinglist[domWindowOuter].some(function (item, index, items) {
            // If element present in list update fields if required
            if (item.host === http_channel.URI.host) {
                item.count += 1;
                if (item.address !== remoteAddress && remoteAddress !== "") {
                    item.address = remoteAddress;
                    item.address_family = remoteAddressFamily;
                }
                return true;
            }
        })) {
            // Create new entry + add to waiting list
            log("Sixornot - HTTP_REQUEST_OBSERVER - New page load, adding new entry, host: " + http_channel.URI.host + ", remoteAddress: " + remoteAddress + ", outer_id: " + domWindowOuter, 1);
            requests.waitinglist[domWindowOuter]
                    .push(create_new_entry(http_channel.URI.host, remoteAddress, remoteAddressFamily, null, domWindowOuter));
        }
    } else {
        /* SECONDARY PAGE LOAD */
        // Not new, inner window ID will be correct by now so add entries to request cache
        var browserMM = topFrameElement.messageManager;

        if (!requests.cache[domWindowInner]) {
            log("SN: requests.cache[" + domWindowInner + "] set to: []", 1);
            requests.cache[domWindowInner] = [];
        }
        // If host already in list update IP address if needed
        if (!requests.cache[domWindowInner].some(function (item, index, items) {
            if (item.host === http_channel.URI.host) {
                item.count += 1;
                send_event("sixornot-count-change-event", domWindow, item); // TODO send message rather than event

                if (item.address !== remoteAddress && remoteAddress !== "") {
                    item.address = remoteAddress;
                    item.address_family = remoteAddressFamily;
                    send_event("sixornot-address-change-event", domWindow, item); // TODO send message rather than event
                }
                return true;
            }
        })) {
            log("Sixornot - HTTP_REQUEST_OBSERVER - Secondary load, adding new entry, host: " + http_channel.URI.host + ", remoteAddress: " + remoteAddress + ", ID: " + domWindowInner, 1);
            new_entry = create_new_entry(http_channel.URI.host, remoteAddress, remoteAddressFamily, domWindowInner, domWindowOuter);
            requests.cache[domWindowInner].push(new_entry);
            new_entry.show_detail = false;
            new_entry.lookup_ips(domWindow);
            send_event("sixornot-new-host-event", domWindow, new_entry); // TODO send message rather than event
        }
    }
};


/*
 * HTTP Request observer
 * Observes all HTTP requests to determine the details of connections
 * Ignores connections which aren't related to browser windows
 */
var HTTP_REQUEST_OBSERVER = {
    observe: function (subject, topic, data) {
        if (topic === "http-on-examine-response"
         || topic === "http-on-examine-cached-response") {
            on_examine_response(subject, topic);
        }
    },

    observer_service: Components.classes["@mozilla.org/observer-service;1"]
                         .getService(Components.interfaces.nsIObserverService),

    register: function () {
        this.observer_service.addObserver(this, "http-on-examine-response", false);
        this.observer_service.addObserver(this, "http-on-examine-cached-response", false);
    },

    unregister: function () {
        this.observer_service.removeObserver(this, "http-on-examine-response");
        this.observer_service.removeObserver(this, "http-on-examine-cached-response");
    }
};
