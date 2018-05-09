/*
 * Copyright 2008-2016 Ashley Baldock. All Rights Reserved.
 */

/* global ChromeWorker, log, parse_exception, createIPAddress */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://sixornot/content/logger.jsm");
Components.utils.import("chrome://sixornot/content/ipaddress.jsm");
var dnsService = Components.classes["@mozilla.org/network/dns-service;1"]
                           .getService(Components.interfaces.nsIDNSService);

/* exported dnsResolver, ipUtils, createLocalAddressInfo */
var EXPORTED_SYMBOLS = ["dnsResolver", "ipUtils", "createLocalAddressInfo"];

var dnsResolver = (function () {
    var resolveRemoteFirefox = function (host, callback) {
        var completeCallback = {
            onLookupComplete : function (nsrequest, dnsresponse, nsstatus) {
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
                    }
                }
                callback(result);
            }
        };
        try {
            var cancelable = dnsService.asyncResolve(host, 0x01, completeCallback, null);
            return function () {
                cancelable.cancel(1);
            };
        } catch (e) {
            Components.utils.reportError("Sixornot dnsService:asyncResolve EXCEPTION: " + parse_exception(e));
            callback({success: false, addresses: []});
            return null;
        }
    };

    return {
        shutdown: function () {
            log("dnsResolver:shutdown", 1);
        },

        getLocalHostname: function () {
            return dnsService.myHostName;
        },

        resolveLocal: function (callback) {
            return resolveRemoteFirefox(this.getLocalHostname(), callback);
        },

        resolveRemote: function (host, callback) {
            return resolveRemoteFirefox(host, callback);
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

var createLocalAddressInfo = function () {
    var dnsCancel = null;
    var onReturnIPs = function (results, callback, thisArg) {
        dnsCancel = null;
        callback.call(thisArg, {
            host: dnsResolver.getLocalHostname(),
            ips: results.addresses.sort(ipUtils.sort),
            ip: {address: "", family : 0}
        });
    };
    return {
        get: function (callback, thisArg) {
            this.cancel();
            dnsCancel = dnsResolver.resolveLocal(function (results) {
                onReturnIPs(results, callback, thisArg);
            });
        },
        cancel: function () {
            if (dnsCancel) {
                dnsCancel.cancel();
            }
        }
    };
};

