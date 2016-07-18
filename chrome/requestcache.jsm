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
 * Contains two lists:
 * cache - All requests which have been made for webpages which are still in history
 * waitinglist - Requests which have yet to have an innerWindow ID assigned
 */
var createRequestCache = function () {
    var createCacheEntry = function (mainhost, id) {
        return {
            main: mainhost,
            entries: [],
            innerId: id
        };
    };
    var cache = {};
    var waitinglist = [];

    return {
        createOrExtendCacheEntry: function (mainhost, id) {
            if (!cache.hasOwnProperty(id)) {
                cache[id] = createCacheEntry(mainhost, id);
            }

            // Move anything currently on waiting list into new cache entry
            waitinglist.splice(0, Number.MAX_VALUE).forEach(function (item) {
                this.addOrUpdate(item, id);
            }, this);
        },

        addOrUpdate: function (entry, id) {
            if (!cache.hasOwnProperty(id)) {
                // HTTP load without associated DOMWindowCreated/HTTP initial load
                this.createOrExtendCacheEntry("", id);
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

        get: function (id) {
            if (cache.hasOwnProperty(id)) {
                return cache[id];
            }
            return null;
        },

        remove: function (id) {
            if (cache.hasOwnProperty(id)) {
                delete cache[id];
            }
        },

        addOrUpdateToWaitingList: function (entry) {
            if (!waitinglist.some(function (item) {
                if (item.host === entry.host) { // Update
                    cacheEntry.update(item, entry);
                    return true;
                }
            })) { // Add new
                waitinglist.push(entry);
            }
        },

        /* debug methods */
        printCache: function () {
            var out = "cache is:\n";
            for (var property in cache) {
                if (cache.hasOwnProperty(property)) {
                    out += "[" + property + ": [";
                    out += "mainHost: '" + cache[property].main + "', ";
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
        },
        printWaitingList: function () {
            var out = "waitinglist is:\n";
            waitinglist.forEach(function (item) {
                out += "[";
                out += item.host;
                out += "],";
            });
            return out;
        }
    };
};

