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

Components.utils.import("resource://sixornot/includes/dns.jsm");

// Init dns_handler
dns_handler.init(); // TODO uninit on unload (or pass requests out to chrome process)

Components.utils.import("resource://sixornot/includes/requestcache.jsm");

var requests = get_request_cache();

log("content script loaded", 1);
sendAsyncMessage("sixornot@baldock.me:content-script-loaded", {id: content_script_id});


var currentInnerId = 0;

var update_ui = function (data) {
    //log("updating_ui: data: " + JSON.stringify(data));
    sendAsyncMessage("sixornot@baldock.me:update-ui", JSON.stringify(data));
};

/* UI update type events (for panel)
 * Event type one of:
 *  sixornot-dns-lookup-event
 *  sixornot-count-change-event
 *  sixornot-address-change-event
 *  sixornot-new-host-event
 *  sixornot-page-change-event */
//send_event("sixornot-count-change-event", domWindow, item);
//send_event("sixornot-address-change-event", domWindow, item);
//send_event("sixornot-new-host-event", domWindow, new_entry);

addMessageListener("sixornot@baldock.me:http-initial-load", function (message) {
    log("got http-initial-load, host: '" + message.data.host + "', address: '" + message.data.address + "', address_family: " + message.data.addressFamily);

    // Items placed onto waiting list will be moved by DOMWindowCreated handler
    requests.addOrUpdateToWaitingList(message.data);

    update_ui(requests.get(currentInnerId));
});

addMessageListener("sixornot@baldock.me:http-load", function (message) {
    log("got http-load, host: " + message.data.host + ", address: " + message.data.address + ", address_family: " + message.data.addressFamily);

    requests.addOrUpdate(message.data, currentInnerId, on_dns_complete);

    update_ui(requests.get(currentInnerId));
});

addMessageListener("sixornot@baldock.me:update-ui", function (message) {
    update_ui(requests.get(currentInnerId));
});


var on_page_change = function (data) {
    // TODO - wire up this event to observer
    log("on_page_change: data: " + JSON.stringify(data), 1);
    //update_ui(data);
    update_ui(requests.get(currentInnerId));
};

var on_dns_complete = function (data) {
    // TODO - wire up this event to observer
    log("on_dns_complete: data: " + JSON.stringify(data), 1);
    //update_ui(data);
    update_ui(requests.get(currentInnerId));
};


// TODO test this with sub-windows
addEventListener("DOMWindowCreated", function (event) {
    var newEntry;
    var utils = event.originalTarget.defaultView.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                     .getInterface(Components.interfaces.nsIDOMWindowUtils);
    var inner = utils.currentInnerWindowID;
    var outer = utils.outerWindowID;

    var protocol = event.originalTarget.defaultView.location.protocol;
    var hostname = event.originalTarget.defaultView.location.hostname;
    var loc = event.originalTarget.defaultView.location.href;

    log("DOMWindowCreated, inner: " + inner + ", outer: " + outer + ", hostname: " + hostname + ", protocol: " + protocol + ", location: " + event.originalTarget.defaultView.location, 1);

    if (requests.get(inner)) { return; } // Ignore duplicate events

    if (protocol === "file:") {
        newEntry = {host: "Local File", address: "", addressFamily: 1}
    } else if (protocol === "about:") {
        newEntry = {host: loc, address: "", addressFamily: 1};
    } else {
        newEntry = {host: hostname, address: "", addressFamily: 0};
    }

    // TODO All subsequent http-load events for this browser should now be
    // associated with this inner ID
    currentInnerId = inner;

    requests.addOrUpdateToWaitingList(newEntry);

    requests.createCacheEntry(newEntry.host, inner);

    log(requests.print_waitinglist(), 1);
    log(requests.print_cache(), 1);

    // For each member of the new cache set inner ID and trigger a dns lookup
    requests.get(inner).entries.forEach(function (item, index, items) {
        item.lookup_ips(on_dns_complete);
    });
    on_page_change(requests.get(inner));
});

/*var on_content_document_global_created = function(subject, topic) {
    var subjectUtils, subjectInner, subjectOuter,
        topWindow, topWindowUtils, topWindowInner, topWindowOuter;
    // This signals that the document has been created, initial load completed
    // This is where entries on the requests waiting list get moved to the request cache
    subjectUtils = subject.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                        .getInterface(Components.interfaces.nsIDOMWindowUtils);
    subjectInner = subjectUtils.currentInnerWindowID;
    subjectOuter = subjectUtils.outerWindowID;
    topWindow = subject.top;
    topWindowUtils = topWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                        .getInterface(Components.interfaces.nsIDOMWindowUtils);
    topWindowInner = topWindowUtils.currentInnerWindowID;
    topWindowOuter = topWindowUtils.outerWindowID;

    if (requests.cache[topWindowInner]) { return; } // Ignore duplicate events
    // The waiting list contains http-on-examine-response messages which aren't
    // yet associated with an inner window ID, these are stored associated with
    // their top outer window ID

    // This is a create event for the top window (new page)
    if (subjectOuter === topWindowOuter) {
        log("on_content_document_global_created: subjectOuter === topWindowOuter", 1);

    } else {
        log("on_content_document_global_created: subjectOuter !== topWindowOuter", 1);
    }
};*/

// TODO test this still cleans up properly
var on_inner_window_destroyed = function(subject) {
    var inner = subject.QueryInterface(Components.interfaces.nsISupportsPRUint64).data;

    // Remove elements for this window and ensure DNS lookups are all cancelled
    if (requests.get(inner)) {
        requests.get(inner).entries.forEach(function (item, index, items) {
            if (item.dns_cancel) {
                item.dns_cancel.cancel();
            }
        });

        requests.remove(inner);
    }
};

var WINDOW_OBSERVER = {
    observe: function (subject, topic, data) {
        /*if (topic === "content-document-global-created") {
            on_content_document_global_created(subject, topic);
        } else*/
        if (topic === "inner-window-destroyed") {
            on_inner_window_destroyed(subject);
        }
    },

    observer_service: Components.classes["@mozilla.org/observer-service;1"]
                         .getService(Components.interfaces.nsIObserverService),

    register: function () {
        //this.observer_service.addObserver(this, "content-document-global-created", false);
        this.observer_service.addObserver(this, "inner-window-destroyed", false);
    },

    unregister: function () {
        //this.observer_service.removeObserver(this, "content-document-global-created");
        this.observer_service.removeObserver(this, "inner-window-destroyed");
    }
};

WINDOW_OBSERVER.register();

// TODO - unregister everything on unload
