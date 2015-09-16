/*
 * Copyright 2008-2015 Timothy Baldock. All Rights Reserved.
 */

/* global ChromeWorker, log, parse_exception, createIPAddress */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://sixornot/content/logger.jsm");
Components.utils.import("chrome://sixornot/content/ipaddress.jsm");
var dnsService = Components.classes["@mozilla.org/network/dns-service;1"]
                           .getService(Components.interfaces.nsIDNSService);

/* exported dnsResolver, ipUtils, create_local_address_info */
var EXPORTED_SYMBOLS = ["dnsResolver", "ipUtils", "create_local_address_info"];

var callbacks = {
    // Set up request map, which will map async requests to their callbacks
    // Every time a request is started its callback is added to the callback_ids
    // When a request is completed the callback_ids can be queried to find the correct
    // callback to call.

    // callback_ids is an array of 2-item arrays - [ID <int>, callback <func>]
    callback_ids: [],
    next_id: 0,

    // Index this.callback_ids and return required callback
    find_by_id: function (callback_id) {
        log("callbacks.find_by_id - callback_id: " + callback_id, 3);
        // Returns -1 if ID not found
        return this.callback_ids.map(function (a) {
            return a[0];
        }).indexOf(callback_id);
    },

    remove: function (callback_id) {
        var i;
        i = this.find_by_id(callback_id);
        if (i !== -1) {
            log("callbacks.remove - found and removed callback_id: " + callback_id, 3);
            // Return the callback function
            return this.callback_ids.splice(i, 1)[0][1];
        }
        // If ID not found, return false
        log("callbacks.remove - could not find callback_id: " + callback_id, 3);
        return false;
    },

    add: function (callback) {
        // Use next available callback ID, return that ID
        this.next_id = this.next_id + 1;
        this.callback_ids.push([this.next_id, callback]);
        log("callbacks.add - added new callback with id: " + this.next_id, 3);
        return this.next_id;
    },

    make_cancel_obj: function (callback_id) {
        log("dnsResolver:make_cancel_obj - callback_id: " + callback_id, 3);
        return {
            cancel : function () {
                log("cancel_obj - cancelling callback_id: " + callback_id, 3);
                // Remove ID from callback_ids if it exists there
                callbacks.remove(callback_id);
            }
        };
    }
};

var reqids = {
    shutdown: 0,        // Shut down DNS resolver, must be last request!
    remotelookup: 1,    // Perform dns.resolve_remote lookup
    locallookup: 2,     // Perform dns.resolve_local lookup
    checkremote: 3,     // Check whether ctypes resolver is in use for remote lookups
    checklocal: 4,      // Check whether ctypes resolver is in use for local lookups
    log: 254            // A logging message (sent from worker to main thread only)
};

var dnsResolver = (function () {
    var resolveRemoteUsingCTypes = true;
    var resolveLocalWithCTypes = true;
    var worker = null;

    var setupWorker = function (url) {
        worker = new ChromeWorker(url);

        worker.onmessage = function (evt) {  
            var data, callback;
            data = JSON.parse(evt.data);

            if (data.reqid === reqids.log) { // Log message from dns_worker
                log(data.content[0], data.content[1]);
            } else if (data.reqid === reqids.checkremote) { // checkremote, set remote ctypes status
                resolveRemoteUsingCTypes = data.content;
            } else if (data.reqid === reqids.checklocal) { // checklocal, set local ctypes status
                resolveLocalWithCTypes = data.content;
            } else if (data.reqid === reqids.remotelookup ||
                       data.reqid === reqids.locallookup) { // remotelookup/locallookup, find correct callback and call it
                callback = callbacks.remove(data.callbackid);
                // Execute callback
                if (callback) {
                    var result = {success: true, addresses: []};
                    if (data[0] === "FAIL") {
                        result.success = false;
                    } else {
                        data.content.forEach(function (addr) {
                            result.addresses.push(createIPAddress(addr));
                        });
                    }
                    callback(result);
                }
            }
        };

        worker.onerror = function (err) {
            log(err.message + ", " + err.filename + ", " + err.lineno, 1);
        };
    };

    switch(Services.appinfo.OS.toLowerCase()) {
    case "darwin":
        log("dnsResolver - init darwin ctypes resolver", 1);
        setupWorker("chrome://sixornot/content/ctypes/darwin.js");
        break;

    case "linux":
        log("dnsResolver - init linux ctypes resolver", 1);
        setupWorker("chrome://sixornot/content/ctypes/linux.js");
        break;

    case "winnt":
        log("dnsResolver - init winnt ctypes resolver", 1);
        setupWorker("chrome://sixornot/content/ctypes/winnt.js");
        break;

    default:
        // Fallback to using Firefox DNS resolver
        log("dnsResolver - init firefox resolver", 1);
        resolveRemoteUsingCTypes = false;
        resolveLocalWithCTypes = false;
        break;
    }

    var resolveLocalCTypes = function (callback) {
        var new_callback_id = callbacks.add(callback);

        worker.postMessage(JSON.stringify({"callbackid": new_callback_id, "reqid": reqids.locallookup, "content": null}));

        return callbacks.make_cancel_obj(new_callback_id);
    };

    var resolveRemoteCTypes = function (host, callback) {
        var new_callback_id = callbacks.add(callback);

        worker.postMessage(JSON.stringify({"callbackid": new_callback_id, "reqid": reqids.remotelookup, "content": host}));

        return callbacks.make_cancel_obj(new_callback_id);
    };

    var resolveRemoteFirefox = function (host, callback) {
        var completeCallback = {
            onLookupComplete : function (nsrequest, dnsresponse, nsstatus) {
                var ip_addresses;
                // Request has been cancelled - ignore
                if (nsstatus === Components.results.NS_ERROR_ABORT) {
                    return;
                }
                var result = {success: true, addresses: []};
                if (nsstatus !== 0 || !dnsresponse || !dnsresponse.hasMore()) {
                    result.success = false;
                } else {
                    while (dnsresponse.hasMore()) {
                        result.addresses.push(createIPAddress(dnsresponse.getNextAddrAsString()));
                    });
                }
                callback(result);
            }
        };
        try {
            return dnsService.asyncResolve(host, 0x01, completeCallback, null);
        } catch (e) {
            Components.utils.reportError("Sixornot dnsService:asyncResolve EXCEPTION: " + parse_exception(e));
            callback({success: false, addresses: []});
            return null;
        }
    };

    return {
        /* Shuts down the native dns resolver (if running) */
        // TODO can this be an unload() call?
        shutdown: function () {
            log("dnsResolver:shutdown", 1);
            resolveRemoteUsingCTypes = false;
            resolveLocalWithCTypes = false;

            if (worker) {
                worker.postMessage(JSON.stringify({"reqid": reqids.shutdown, "content": null}));

                // Remove worker's event listeners as added in init(), this prevents messages
                // sent by the worker after shutdown from triggering anything
                worker.onmessage = null;
                worker.onerror = null;
            }
        },

        getLocalHostname: function () {
            return dnsService.myHostName;
        },

        resolveLocal: function (callback) {
            if (resolveLocalWithCTypes) {
                return resolveLocalCTypes(callback);
            } else {
                return resolveRemoteFirefox(this.getLocalHostname(), callback);
            }
        },

        resolveRemote: function (host, callback) {
            if (resolveRemoteUsingCTypes) {
                return resolveRemoteCTypes(host, callback);
            } else {
                return resolveRemoteFirefox(host, callback);
            }
        }
    };
}());

var ipUtils = {
    // Sort IPv4 addresses into logical ordering
    sortIPv4: function (a, b) {
        // addresses of different types have a distinct precedence order
        // global, rfc1918, [other]
        if (a.type === b.type) {
            if (a.normalised === b.normalised) {
                return 0;   // Identical
            }
            if (a.normalised > b.normalised) {
                return 1;   // a > b
            }
            return -1;      // b > a
            // addresses of same type are compared based on their numeric values
            // e.g. 192.168.2.10 comes before 192.168.20.10
            // Compare expanded addresses, e.g. 010.011.002.003 with 010.012.001.019
            // Return -1 if a < b, 0 if a == b, 1 if a > b
        }
        if (a.type === "global") {
            return -1;  // a comes before b
        }
        if (b.type === "global") {
            return 1;   // b comes before a
        }
        if (a.type === "rfc1918") {
            return -1;  // a comes before b
        }
        if (b.type === "rfc1918") {
            return 1;   // b comes before a
        }
    },

    // Sort IPv6 addresses into logical ordering
    sortIPv6: function (a, b) {
        // addresses of different types have a distinct precedence order
        // global, linklocal, [other]
        if (a.type === b.type) {
            if (a.normalised === b.normalised) {
                return 0;   // Identical
            }
            if (a.normalised > b.normalised) {
                return 1;   // a > b
            }
            return -1;      // b > a
            // addresses of same type are compared based on their numeric values
            // e.g. fe80::2001 comes before fe80::2:2001
            // Comparison can be made lexicographically on normalised address
            // Return -1 if a < b, 0 if a == b, 1 if a > b
        }
        // They are not equal
        if (a.type === "global") {
            return -1;  // a comes before b
        }
        if (b.type === "global") {
            return 1;   // b comes before a
        }
        // Neither of them are global
        if (a.type === "linklocal") {
            return -1;  // a comes before b
        }
        if (b.type === "linklocal") {
            return 1;   // b comes before a
        }
    },

    sort: function (a, b) {
        if (a.family && a.family === 6) {
            if (b.family && b.family === 6) {
                return ipUtils.sortIPv6(a, b);
            } else {
                return -1; // a comes before b (IPv6 before IPv4)
            }
        } else if (b.family && b.family === 6) {
            return 1; // b comes before a (IPv6 before IPv4)
        } else {
            return ipUtils.sortIPv4(a, b);
        }
    },

    isRouteable: function (ip) {
        if (ip.family === 6) {
            return (["6to4", "teredo", "global"].indexOf(ip.type) != -1);
        } else if (ip.family === 4) {
            return (["rfc1918", "6to4relay", "global"].indexOf(ip.type) != -1);
        } else {
            return false;
        }
    }
};

var create_local_address_info = function () {
    var on_returned_ips, dns_cancel, new_local_host_info;
    dns_cancel = null;
    new_local_host_info = function () {
        return {
            ips            : [],
            host           : "",
            address        : "",
            address_family : 0,
            dns_status     : "pending" // TODO do we still need this?
        };
    };
    on_returned_ips = function (results, callback, thisArg) {
        var local_host_info = new_local_host_info();
        log("panel:local_address_info:on_returned_ips - results: " + results, 1);
        dns_cancel = null;
        local_host_info.host = dnsResolver.getLocalHostname();
        if (results.success) {
            local_host_info.dns_status = "complete";
            local_host_info.ips = results.addresses.sort(ipUtils.sort);
        } else {
            local_host_info.dns_status = "failure";
        }

        callback.call(thisArg, local_host_info);
    };
    return {
        get_local_host_info: function (callback, thisArg) {
            this.cancel();
            dns_cancel = dnsResolver.resolveLocal(function (results) {
                on_returned_ips(results, callback, thisArg);
            });
        },
        cancel: function () {
            if (dns_cancel) {
                dns_cancel.cancel();
            }
        }
    };
};

