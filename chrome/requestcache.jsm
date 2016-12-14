/*
 * Copyright 2008-2016 Ashley Baldock. All Rights Reserved.
 */

/* exported createRequestCache, cacheEntry */
var EXPORTED_SYMBOLS = ["createRequestCache", "cacheEntry"];

var cacheEntry = {
    create: function () {
        return {
            host: "",
            ip: {
                address: "",
                family: 0
            },
            count: 1,
            security: {
                cipherName: "",
                keyLength: 0,
                secretKeyLength: 0,
                isExtendedValidation: false,
                isDomainMismatch: false,
                isNotValidAtThisTime: false,
                isUntrusted: false,
                shortSecurityDescription: "",
                errorMessage: "",
                securityState: 0    // TODO make this into flags
            },
            proxy: {
                host: null,
                port: null,
                type: "direct",
                proxyResolvesHost: false
            }
        };
    },
    update: function (to, from) {
        to.count += 1;

        if (to.ip.address !== from.ip.address && from.ip.address !== "") {
            to.ip.address = from.ip.address;
            to.ip.family = from.ip.family;
        }
        to.security = from.security;
        to.proxy = from.proxy;
    }
};

/*
 * cache - requests which have been made for webpages which are still in history
 * waiting - When new initial window created, http-load occurs before we have a window ID
 */
var createRequestCache = function () {
    var cache = {};
    var waiting = null;
    var currentId = 0;

    var createCacheEntry = function (id, mainhost) {
        return {
            id: id,
            main: mainhost,
            entries: [],
            parentId: null
        };
    };

    var createOrphan = function (id) {
        cache[id] = createCacheEntry(id, "ORPHAN");
    };

    return {
        deOrphan: function (id, parentId) {
            if (!cache.hasOwnProperty(id)) {
                createOrphan(id);
            } else if (cache[id].main !== "ORPHAN") {
                return;
            }
            // Move anything associated with the orphan Id into the parent Id
            // Leave behind an orphan link so that parent Id can be found
            // Subsequent updates to orphan's entries update parent
            cache[id].main = "CHILD";
            cache[id].parentId = parentId;
            cache[id].entries.splice(0, Number.MAX_VALUE).forEach(function (item) {
                this.update(parentId, item);
            }, this);
        },

        // Update a cache entry, to add entries etc.
        update: function (id, entry) {
            if (!cache.hasOwnProperty(id)) {
                // HTTP load can happen before DOMWindowCreated, so we don't have an id
                // these are typically going to be orphans
                createOrphan(id);
            }
            if (cache[id].parentId) {
                id = cache[id].parentId;
            }
            if (!cache[id].entries.some(function (item) {
                if (item.host === entry.host) { // Update
                    cacheEntry.update(item, entry);
                    return true;
                }
            })) { // Add new
                cache[id].entries.push(entry);
            }
        },

        getCurrent: function () {
            if (cache.hasOwnProperty(currentId)) {
                return cache[currentId];
            }
            return null;
        },

        remove: function (id) {
            if (cache.hasOwnProperty(id)) {
                delete cache[id];
            }
        },

        setCurrent: function (id, entry) {
            currentId = id;
            if (!cache.hasOwnProperty(id)) {
                cache[id] = createCacheEntry(id, entry.host);
                this.update(id, entry);
            }
            if (waiting) {
                // waiting should contain IP info etc. for initial request
                // TODO - may be good to check host matches
                this.update(id, waiting);
                waiting = null;
            }
        },

        setWaiting: function (entry) {
            waiting = entry;
        },



        /* debug methods */
        printCache: function () {
            var out = "cache is:\n";
            for (var property in cache) {
                if (cache.hasOwnProperty(property)) {
                    out += "[" + property + ": [";
                    out += "mainHost: '" + cache[property].main + "', ";
                    out += "parentId: '" + cache[property].parentId + "', ";
                    out += "entries: [";
                    cache[property].entries.forEach(function (item) {
                        out += "['";
                        out += item.host;
                        out += "'] ";
                    });
                    out += "]]],\n";
                }
            }
            return out;
        }
    };
};

