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

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/dns.jsm");

// Init dns_handler
dns_handler.init(); // TODO uninit on unload (or pass requests out to chrome process)

Components.utils.import("resource://sixornot/includes/requestcache.jsm");

log("imported", 1);

addMessageListener("sixornot@baldock.me:update-id", function (message) {
    var windowUtils = content.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                             .getInterface(Components.interfaces.nsIDOMWindowUtils);

    var inner_id = windowUtils.currentInnerWindowID;
    var outer_id = windowUtils.outerWindowID;
    var hostname = content.document.location.hostname;

        log("called, inner: " + inner_id + ", outer: " + outer_id + ", location: " + content.document.location, 1);

    sendAsyncMessage("sixornot@baldock.me:update-id", {
        callback_id: message.data.callback_id,
        inner_id: inner_id,
        outer_id: outer_id,
        hostname: hostname
    });
});

var address_family = 6;

var update_ui = function (data) {
    log("updating_ui: address_family: " + data.address_family);
    sendAsyncMessage("sixornot@baldock.me:update-ui", {
        // TODO data format for UI updates
        mainHost: data
    });
};

addMessageListener("sixornot@baldock.me:http-load", function (message) {
    // TODO - update cache of information for current inner page based on these messages
    log("got http-load, address_family: " + message.data.address_family);
    address_family = message.data.address_family;
    update_ui();
});

addMessageListener("sixornot@baldock.me:update-ui", function (message) {
    update_ui({
            address_family: address_family,
            ipv6s: ["::1"],
            ipv4s: []
        });
});


var on_page_change = function (data) {
    // TODO - wire up this event to observer
    log("Sixornot - on_page_change: data: " + JSON.stringify(data), 1);
    update_ui(data);
};

var on_dns_complete = function (data) {
    // TODO - wire up this event to observer
    log("Sixornot - on_dns_complete: data: " + JSON.stringify(data), 1);
    update_ui(data);
};


var on_content_document_global_created = function(subject, topic) {
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

    log("Sixornot - on_content_document_global_created: subjectInner: " + subjectInner + ", subjectOuter: " + subjectOuter + ", subject Location: " + JSON.stringify(subject.location) + ", topWindowInner: " + topWindowInner + ", topWindowOuter: " + topWindowOuter + ", top window Location: " + JSON.stringify(topWindow.location), 1);

    // The waiting list contains http-on-examine-response messages which aren't
    // yet associated with an inner window ID, these are stored associated with
    // their top outer window ID

    // This is a create event for the top window (new page)
    if (subjectOuter === topWindowOuter) {
        log("Sixornot - on_content_document_global_created: subjectOuter === topWindowOuter", 1);

        if (!requests.waitinglist[topWindowOuter] || requests.waitinglist[topWindowOuter].length === 0) {
            requests.waitinglist[topWindowOuter] = [];
            if (subject.location.protocol === "file:") {
                // Add item to cache to represent this file
                requests.waitinglist[topWindowOuter].push(
                    create_new_entry("Local File", "", 1, subjectInner, topWindowOuter));
            } else {
                // Some other protocol used to load file, or something went wrong
                requests.waitinglist[topWindowOuter].push(
                    create_new_entry(subject.location.hostname, "", 0, subjectInner, topWindowOuter));
            }
        }

        // Move item(s) from waiting list to cache
        // Replace spliced item with empty array, to keep waitinglist array indexes correct!
        requests.cache[topWindowInner] = requests.waitinglist.splice(topWindowOuter, 1, [])[0];

        // For each member of the new cache set inner ID and trigger a dns lookup
        requests.cache[topWindowInner].forEach(function (item, index, items) {
            item.inner_id = topWindowInner;
            item.lookup_ips(on_dns_complete);
            on_page_change(item.data);
        });
    } else {
        log("Sixornot - on_content_document_global_created: subjectOuter !== topWindowOuter", 1);
    }
};

var on_inner_window_destroyed = function(subject) {
    var domWindowInner = subject.QueryInterface(Components.interfaces.nsISupportsPRUint64).data;

    // Remove elements for this window and ensure DNS lookups are all cancelled
    if (requests.cache[domWindowInner]) {
        requests.cache[domWindowInner].forEach(function (item, index, items) {
            if (item.dns_cancel) {
                item.dns_cancel.cancel();
            }
        });

        delete requests.cache[domWindowInner];
    }
};

var on_outer_window_destroyed = function(subject) {
    var domWindowOuter = subject.QueryInterface(Components.interfaces.nsISupportsPRUint64).data;

    // Remove elements for this window and ensure DNS lookups are all cancelled
    if (requests.waitinglist[domWindowOuter]) {
        requests.waitinglist[domWindowOuter].forEach(function (item, index, items) {
            if (item.dns_cancel) {
                item.dns_cancel.cancel();
            }
        });

        delete requests.waitinglist[domWindowOuter];
    }
};

var WINDOW_OBSERVER = {
    observe: function (subject, topic, data) {
        if (topic === "content-document-global-created") {
            on_content_document_global_created(subject, topic);
        } else if (topic === "inner-window-destroyed") {
            on_inner_window_destroyed(subject);
        } else if (topic === "outer-window-destroyed") {
            on_outer_window_destroyed(subject);
        }
    },

    observer_service: Components.classes["@mozilla.org/observer-service;1"]
                         .getService(Components.interfaces.nsIObserverService),

    register: function () {
        this.observer_service.addObserver(this, "content-document-global-created", false);
        this.observer_service.addObserver(this, "inner-window-destroyed", false);
        this.observer_service.addObserver(this, "outer-window-destroyed", false);
    },

    unregister: function () {
        this.observer_service.removeObserver(this, "content-document-global-created");
        this.observer_service.removeObserver(this, "inner-window-destroyed");
        this.observer_service.removeObserver(this, "outer-window-destroyed");
    }
};

WINDOW_OBSERVER.register();

// TODO - unregister everything on unload
