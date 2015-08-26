/* content script */

Components.utils.import("resource://gre/modules/Services.jsm");

Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService)
    .logStringMessage("imported");



addMessageListener("sixornot@baldock.me:update-id", function (message) {
    var windowUtils = content.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                             .getInterface(Components.interfaces.nsIDOMWindowUtils);

    var inner_id = windowUtils.currentInnerWindowID;
    var outer_id = windowUtils.outerWindowID;
    var hostname = content.document.location.hostname;

    Components.classes["@mozilla.org/consoleservice;1"]
        .getService(Components.interfaces.nsIConsoleService)
        .logStringMessage("called, inner: " + inner_id + ", outer: " + outer_id + ", location: " + content.document.location);

    sendAsyncMessage("sixornot@baldock.me:update-id", {
        callback_id: message.data.callback_id,
        inner_id: inner_id,
        outer_id: outer_id,
        hostname: hostname
    });
});


addMessageListener("sixornot@baldock.me:http-load", function (message) {
    // TODO - update cache of information for current inner page based on these messages
});


// Load this for every browser window

// Needs to subscribe to content-related events

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

    log("Sixornot - on_content_document_global_created: subjectInner: " + subjectInner + ", subjectOuter: " + subjectOuter + ", subject Location: " + subject.location + ", topWindowInner: " + topWindowInner + ", topWindowOuter: " + topWindowOuter + ", top window Location: " + topWindow.location, 1);

    // The waiting list contains http-on-examine-response messages which aren't
    // yet associated with an inner window ID, these are stored associated with
    // their top outer window ID

    // This is a create event for the top window (new page)
    if (subjectOuter === topWindowOuter) {
        log("Sixornot - on_content_document_global_created: subjectOuter === topWindowOuter", 1);

        // TODO - does this need to throw an exception?
        if (requests.cache[topWindowInner]) {
            throw "Sixornot = HTTP_REQUEST_OBSERVER - content-document-global-created: requests.cache already contains content entries.";
        }

        if (!requests.waitinglist[topWindowOuter]
         || requests.waitinglist[topWindowOuter].length === 0) {
            requests.waitinglist[topWindowOuter] = [];
            if (subject.location.protocol === "file:") {
                // Add item to cache to represent this file
                requests.waitinglist[topWindowOuter].push(
                    create_new_entry("Local File", "", 1, subjectInner, topWindowOuter));
            } else {
                // Some other protocol used to load file, or something went wrong
                requests.waitinglist[topWindowOuter].push(
                    create_new_entry(subject.location, "", 0, subjectInner, topWindowOuter));
            }
        }

        // Move item(s) from waiting list to cache
        // Replace spliced item with empty array, to keep waitinglist array indexes correct!
        requests.cache[topWindowInner] = requests.waitinglist.splice(topWindowOuter, 1, [])[0];

        // For each member of the new cache set inner ID and trigger a dns lookup
        requests.cache[topWindowInner].forEach(function (item, index, items) {
            item.inner_id = topWindowInner;
            item.lookup_ips(subject);
            send_event("sixornot-page-change-event", subject, item); // TODO send message rather than event
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

// TODO - unregister everything on unload
