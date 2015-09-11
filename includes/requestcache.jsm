/*
 * Copyright 2008-2015 Timothy Baldock. All Rights Reserved.
 */

Components.utils.import("resource://sixornot/includes/logger.jsm");

// Provided by Firefox:
/*global Components */

// Provided by Sixornot
/*global parse_exception, prefs */

var EXPORTED_SYMBOLS = ["createRequestCache"];

/*
 * Contains two lists:
 * cache - All requests which have been made for webpages which are still in history
 * waitinglist - Requests which have yet to have an innerWindow ID assigned
 */
var createRequestCache = function () {
    /* Prepare and return a new blank entry for the hosts listing */
    var createHost = function (host, address, address_family, security, proxy) {
        return {
            host: host,
            address: address,
            address_family: address_family,
            count: 1,
            ipv6s: [],
            ipv4s: [],
            security: security,
            proxy: proxy
        };
    };

    return {
        cache: {},
        createCacheEntry: function (mainhost, id) {
            return {
                main: mainhost,
                entries: [],
                innerId: id
            };
        },
        createOrExtendCacheEntry: function (mainhost, id) {
            if (!this.cache.hasOwnProperty(id)) {
                this.cache[id] = this.createCacheEntry(mainhost, id);
            }

            // Move anything currently on waiting list into new cache entry
            var waitinglist = this.waitinglist.splice(0, Number.MAX_VALUE);
            waitinglist.forEach(function (item, index, array) {
                this.addOrUpdate({
                    host: item.host,
                    address: item.address,
                    addressFamily: item.address_family,
                    security: item.security,
                    proxy: item.proxy
                }, id);
            }, this);
        },
        addOrUpdate: function (data, id) {
            if (!this.cache.hasOwnProperty(id)) {
                this.createCacheEntry(id);
            }
            if (!this.cache[id].entries.some(function (item, index, items) {
                if (item.host === data.host) {
                    item.count += 1;

                    if (item.address !== data.address && data.address !== "") {
                        item.address = data.address;
                        item.address_family = data.addressFamily;
                    }
                    item.security = data.security;
                    item.proxy = data.proxy;
                    return true;
                }
            })) {
                log("addOrUpdate, host: " + data.host + ", remoteAddress: " + data.address, 1);
                new_entry = createHost(data.host, data.address, data.addressFamily, data.security, data.proxy);
                this.cache[id].entries.push(new_entry);
            }
        },
        get: function (id) {
            if (this.cache.hasOwnProperty(id)) {
                return this.cache[id];
            }
            return null;
        },
        remove: function (id) {
            if (this.cache.hasOwnProperty(id)) {
                delete this.cache[id];
            }
        },

        waitinglist: [],
        addOrUpdateToWaitingList: function (data) {
            if (!this.waitinglist.some(function (item, index, items) {
                if (item.host === data.host) {
                    item.count += 1;
                    if (item.address !== data.address && data.address !== "") {
                        item.address = data.address;
                        item.address_family = data.addressFamily;
                    }
                    if (data.security) {
                        item.security = data.security; // TODO we need to handle updating/merging this a lot better
                    }
                    if (data.proxy) {
                        item.proxy = data.proxy; // TODO we need to handle updating/merging this a lot better
                    }
                    return true;
                }
            })) {
                log("addOrUpdateToWaitingList, host: " + data.host + ", remoteAddress: " + data.address, 1);
                if (!data.security) data.security = {}; // TODO handle this better
                if (!data.proxy) data.proxy = {}; // TODO handle this better
                this.waitinglist.push(
                    createHost(data.host, data.address, data.addressFamily, data.security, data.proxy));
            }
        },
        printCache: function () {
            var out = "cache is:\n";
            for (var property in this.cache) {
                if (this.cache.hasOwnProperty(property)) {
                    out += "[" + property + ": [";
                    out += "mainHost: '" + this.cache[property].main + "', ";
                    out += "entries: [";
                    this.cache[property].entries.forEach(function (item, index, items) {
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
            this.waitinglist.forEach(function (item, index, items) {
                out += "[";
                out += item.host;
                out += "],";
            });
            return out;
        }
    };
};

