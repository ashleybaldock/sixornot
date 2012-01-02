/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2008-2012 Timothy Baldock. All Rights Reserved.
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
/*global Components, Services, ChromeWorker */

// Provided by Sixornot
/*global log, parse_exception, prefs */

// Module imports we need
/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");

// Import logging
Components.utils.import("resource://sixornot/includes/logger.jsm");
log("Imported logging", 0);

// Import preferences
Components.utils.import("resource://sixornot/includes/prefs.jsm");
log("Imported prefs", 0);

/*jslint es5: false */

var EXPORTED_SYMBOLS = ["dns_handler"];


var xulRuntime = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime);



// The DNS Handler which does most of the work of the extension
var dns_handler = {
    remote_ctypes: true,
    local_ctypes: true,

    callback_ids: [],
    next_callback_id: 0,

    worker: null,

    reqids: {
        shutdown: 0,        // Shut down DNS resolver, must be last request!
        remotelookup: 1,    // Perform dns.resolve_remote lookup
        locallookup: 2,     // Perform dns.resolve_local lookup
        checkremote: 3,     // Check whether ctypes resolver is in use for remote lookups
        checklocal: 4,      // Check whether ctypes resolver is in use for local lookups
        log: 254,           // A logging message (sent from worker to main thread only)
        init: 255           // Initialise dns in the worker
    },

    /* Initialises the native dns resolver (if possible) - call this first! */
    init : function () {
        "use strict";
        var that;
        log("Sixornot - dns_handler - init", 1);

        // Initialise ChromeWorker which will be used to do DNS lookups either via ctypes or built-in DNS resolver
        this.worker = new ChromeWorker("resource://sixornot/includes/dns_worker.js");

        // Shim to get 'this'(that) to refer to dns_handler, not the
        // worker, when a message is received.
        that = this;
        this.worker.addEventListener("message", function (evt) {  
            var data, callback;
            data = JSON.parse(evt.data);
            log("Sixornot - dns_handler:onworkermessage - message: " + evt.data, 2);

            if (data.reqid === that.reqids.log) {
                // Log message from dns_worker
                log(data.content[0], data.content[1]);
            } else if (data.reqid === that.reqids.checkremote) {
                // checkremote, set remote ctypes status
                that.remote_ctypes = data.content;
            } else if (data.reqid === that.reqids.checklocal) {
                // checklocal, set local ctypes status
                that.local_ctypes = data.content;
            } else if (data.reqid === that.reqids.init) {
                // Initialisation acknowledgement
                log("Sixornot - dns_handler:onworkermessage - init ack received", 2);
            } else if (data.reqid === that.reqids.remotelookup ||
                       data.reqid === that.reqids.locallookup) {
                // remotelookup/locallookup, find correct callback and call it
                callback = that.remove_callback_id(data.callbackid);
                // Execute callback
                if (callback) {
                    callback(data.content);
                }
            }
        }, false);

        this.worker.addEventListener("error", function (err) {  
            log(err.message + ", " + err.filename + ", " + err.lineno, 1);
        }, false);

        // Set up request map, which will map async requests to their callbacks
        // Every time a request is started its callback is added to the callback_ids
        // When a request is completed the callback_ids can be queried to find the correct
        // callback to call.
        this.callback_ids = [];
        this.next_callback_id = 0;

        // Finally init the worker
        this.worker.postMessage(JSON.stringify({"reqid": this.reqids.init,
            "content": xulRuntime.OS.toLowerCase()}));
    },

    /* Shuts down the native dns resolver (if running) */
    shutdown : function () {
        "use strict";
        log("Sixornot - dns_handler:shutdown", 1);
        this.worker.postMessage(JSON.stringify({"reqid": this.reqids.shutdown}));
    },


    /*
        IP Address utility functions
    */
    validate_ip4 : function (ip_address) {
        "use strict";
        log("Sixornot - dns_handler:validate_ip4: " + ip_address, 3);
        // TODO - Write this function if needed, extensive validation of IPv4 address
        return false;
    },

    // Quick check for address family, not a validator (see validate_ip4)
    is_ip4 : function (ip_address) {
        "use strict";
        log("Sixornot - dns_handler:is_ip4 " + ip_address, 3);
        return ip_address && (ip_address.indexOf(".") !== -1 && ip_address.indexOf(":") === -1);
    },

    // Return the type of an IPv6 address
    /*
        -- For IPv4 addresses types are (from RFC 3330) --

        Address Block             Present Use                       Reference
        ---------------------------------------------------------------------
        0.0.0.0/8            "This" Network                 [RFC1700, page 4]
        10.0.0.0/8           Private-Use Networks                   [RFC1918]
        14.0.0.0/8           Public-Data Networks         [RFC1700, page 181]
        24.0.0.0/8           Cable Television Networks                    --
        39.0.0.0/8           Reserved but subject
                               to allocation                       [RFC1797]
        127.0.0.0/8          Loopback                       [RFC1700, page 5]
        128.0.0.0/16         Reserved but subject
                               to allocation                             --
        169.254.0.0/16       Link Local                                   --
        172.16.0.0/12        Private-Use Networks                   [RFC1918]
        191.255.0.0/16       Reserved but subject
                               to allocation                             --
        192.0.0.0/24         Reserved but subject
                               to allocation                             --
        192.0.2.0/24         Test-Net
        192.88.99.0/24       6to4 Relay Anycast                     [RFC3068]
        192.168.0.0/16       Private-Use Networks                   [RFC1918]
        198.18.0.0/15        Network Interconnect
                               Device Benchmark Testing            [RFC2544]
        223.255.255.0/24     Reserved but subject
                               to allocation                             --
        224.0.0.0/4          Multicast                              [RFC3171]
        240.0.0.0/4          Reserved for Future Use        [RFC1700, page 4]

        route           0.0.0.0/8                                   Starts with 0
        local           127.0.0.0/24                                Starts with 127
        rfc1918         10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16   Starts with 10, 172.16-31, 192.168
        linklocal       169.254.0.0/16                              Starts with 169.254
        reserved        240.0.0.0/4                                 Starts with 240-255
        documentation   192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24   Starts with 192.0.2, 198.51.100, 203.0.113
        6to4relay       192.88.99.0/24                              Starts with 192.88.99
        benchmark       198.18.0.0/15                               Starts with 198.18, 198.19
        multicast       224.0.0.0/4                                 Starts with 224-239
    */

    // Pad an IPv4 address to permit lexicographical sorting
    pad_ip4 : function (ip4_address) {
        "use strict";
        var pad = function (n) {
            return ("00" + n).substr(-3);
        };
        return ip4_address.split(".").map(pad).join(".");
    },
    // Remove leading zeros from IPv4 address
    unpad_ip4 : function (ip4_address) {
        "use strict";
        var unpad = function (n) {
            return parseInt(n, 10);
        };
        return ip4_address.split(".").map(unpad).join(".");
    },

    // Sort IPv4 addresses into logical ordering
    sort_ip4 : function (a, b) {
        "use strict";
        var typeof_a, typeof_b;
        typeof_a = this.typeof_ip4(a);
        typeof_b = this.typeof_ip4(b);
        // addresses of different types have a distinct precedence order
        // global, rfc1918, [other]
        if (typeof_a === typeof_b) {
            // TODO - move padding out of this function so it doesn't happen for every comparison in the sort
            a = this.pad_ip4(a);
            b = this.pad_ip4(b);
            if (a === b)
            {
                return 0;   // Identical
            }
            else if (a > b)
            {
                return 1;   // a > b
            }
            return -1;      // b > a
            // addresses of same type are compared based on their numeric values
            // e.g. 192.168.2.10 comes before 192.168.20.10
            // Compare expanded addresses, e.g. 010.011.002.003 with 010.012.001.019
            // Return -1 if a < b, 0 if a == b, 1 if a > b
        }
        // They are not equal
        else if (typeof_a === "global")
        {
            return -1;  // a comes before b
        }
        else if (typeof_b === "global")
        {
            return 1;   // b comes before a
        }
        // Neither of them are global
        else if (typeof_a === "rfc1918")
        {
            return -1;  // a comes before b
        }
        else if (typeof_b === "rfc1918")
        {
            return 1;   // b comes before a
        }
    },

    typeof_ip4 : function (ip_address) {
        "use strict";
        var split_address;
        log("Sixornot - dns_handler:typeof_ip4 " + ip_address, 3);
        // TODO - Function in_subnet (network, subnetmask, ip) to check if specified IP is in the specified subnet range
        if (!dns_handler.is_ip4(ip_address)) {
            return false;
        }
        split_address = ip_address.split(".").map(Number);
        if (split_address[0] === 0)
        {
            return "route";
        }
        else if (split_address[0] === 127)
        {
            return "localhost";
        }
        else if (split_address[0] === 10
             || (split_address[0] === 172 && split_address[1] >= 16 && split_address[1] <= 31)
             || (split_address[0] === 192 && split_address[1] === 168))
        {
            return "rfc1918";
        }
        else if (split_address[0] === 169 && split_address[1] === 254)
        {
            return "linklocal";
        }
        else if (split_address[0] >= 240)
        {
            return "reserved";
        }
        else if ((split_address[0] === 192 && split_address[1] === 0  && split_address[2] === 2)
              || (split_address[0] === 198 && split_address[1] === 51 && split_address[2] === 100)
              || (split_address[0] === 203 && split_address[1] === 0  && split_address[2] === 113))
        {
            return "documentation";
        }
        else if (split_address[0] === 192 && split_address[1] === 88 && split_address[2] === 99)
        {
            return "6to4relay";
        }
        else if (split_address[0] === 198 && [18,19].indexOf(split_address[1]) !== -1)
        {
            return "benchmark";
        }
        else if (split_address[0] >= 224 && split_address[0] <= 239)
        {
            return "multicast";
        }
        else
        {
            return "global";
        }
    },

    test_is_ip6 : function () {
        "use strict";
        var overall, tests, i, result;
        overall = true;
        tests = [
                        ["::",                                      true],
                        ["::1",                                     true],
                        ["fe80::fa22:22ff:fee8:2222",               true],
                        ["fc00::",                                  true],
                        ["ff00:1234:5678:9abc:def0:d:ee:fff",       true],
                        ["2:0::1:2",                                true],
                        ["2001:8b1:1fe4:1::2222",                   true],
                        ["2001:08b1:1fe4:0001:0000:0000:0000:2222", true],
                        ["192.168.2.1",                             false],
                        ["blah",                                    false],
                        [":::",                                     false],
                        [":",                                       false],
                        ["1::2::3",                                 false]
                    ];
        for (i = 0; i < tests.length; i += 1) {
            result = this.is_ip6(tests[i][0]);
            if (result === tests[i][1]) {
                log("Sixornot - test_is_ip6, passed test value: " + tests[i][0] + ", result: " + result);
            } else {
                log("Sixornot - test_is_ip6, failed test value: " + tests[i][0] + ", expected result: " + tests[i][1] + ", actual result: " + result);
                overall = false;
            }
        }
        return overall;
    },

    validate_ip6 : function (ip_address) {
        "use strict";
        log("Sixornot - dns_handler:validate_ip6: " + ip_address, 3);
        // TODO - Write this function if needed, extensive validation of IPv6 address
        return false;
    },

    // Quick check for address family, not a validator (see validate_ip6)
    is_ip6 : function (ip_address) {
        "use strict";
        log("Sixornot - dns_handler:is_ip6: " + ip_address, 3);
        return ip_address && (ip_address.indexOf(":") !== -1);
    },

    test_normalise_ip6 : function () {
        "use strict";
        var overall, tests, i, result;
        overall = true;
        tests = [
                        ["::",                                      "0000:0000:0000:0000:0000:0000:0000:0000"],
                        ["::1",                                     "0000:0000:0000:0000:0000:0000:0000:0001"],
                        ["fe80::fa22:22ff:fee8:2222",               "fe80:0000:0000:0000:fa22:22ff:fee8:2222"],
                        ["fc00::",                                  "fc00:0000:0000:0000:0000:0000:0000:0000"],
                        ["ff00:1234:5678:9abc:def0:d:ee:fff",       "ff00:1234:5678:9abc:def0:000d:00ee:0fff"],
                        ["2:0::1:2",                                "0002:0000:0000:0000:0000:0000:0001:0002"],
                        ["2001:8b1:1fe4:1::2222",                   "2001:08b1:1fe4:0001:0000:0000:0000:2222"],
                        ["2001:08b1:1fe4:0001:0000:0000:0000:2222", "2001:08b1:1fe4:0001:0000:0000:0000:2222"],
                        ["fe80::fa1e:dfff:fee8:db18%en1",           "fe80:0000:0000:0000:fa1e:dfff:fee8:db18"]
                    ];
        for (i = 0; i < tests.length; i += 1) {
            result = this.normalise_ip6(tests[i][0]);
            if (result === tests[i][1]) {
                log("Sixornot - test_normalise_ip6, passed test value: " + tests[i][0] + ", result: " + result, 1);
            } else {
                log("Sixornot - test_normalise_ip6, failed test value: " + tests[i][0] + ", expected result: " + tests[i][1] + ", actual result: " + result, 1);
                overall = false;
            }
        }
        return overall;
    },

    // Expand IPv6 address into long version
    normalise_ip6 : function (ip6_address) {
        "use strict";
        var sides, left_parts, right_parts, middle, outarray, pad_left;
        log("Sixornot - dns_handler:normalise_ip6: " + ip6_address, 3);
        // Split by instances of ::
        sides = ip6_address.split("::");
        // Split remaining sections by instances of :
        left_parts = sides[0].split(":");
        right_parts = (sides[1] && sides[1].split(":")) || [];

        middle = ["0", "0", "0", "0", "0", "0", "0", "0"].slice(0, 8 - left_parts.length - right_parts.length);
        outarray = Array.concat(left_parts, middle, right_parts);

        // Pad each component to 4 char length with zeros to left (and convert to lowercase)
        pad_left = function (str) {
            return ("0000" + str).slice(-4);
        };

        return outarray.map(pad_left).join(":").toLowerCase();
    },

    // Unit test suite for typeof_ip6 function, returns false if a test fails
    test_typeof_ip6 : function () {
        "use strict";
        var overall, tests, i, result;
        overall = true;
        tests = [
                        ["::", "unspecified"],
                        ["::1", "localhost"],
                        ["fe80::fa22:22ff:fee8:2222", "linklocal"],
                        ["fec0::ffff:fa22:22ff:fee8:2222", "sitelocal"],
                        ["fc00::1", "uniquelocal"],
                        ["ff00::1", "multicast"],
                        ["2002::1", "6to4"],
                        ["2001:0000::1", "teredo"],
                        ["2001:8b1:1fe4:1::2222", "global"],
                        ["192.168.2.1", false],
                        ["blah", false],
                        [":", false],
                        ["...", false]
                    ];
        for (i = 0; i < tests.length; i += 1) {
            result = this.typeof_ip6(tests[i][0]);
            if (result === tests[i][1]) {
                log("Sixornot - test_typeof_ip6, passed test value: " + tests[i][0] + ", result: " + result);
            } else {
                log("Sixornot - test_typeof_ip6, failed test value: " + tests[i][0] + ", expected result: " + i[1] + ", actual result: " + result);
                overall = false;
            }
        }
        return overall;
    },

    // Return the type of an IPv6 address
    /*
        -- For IPv6 addresses types are: --
        unspecified     ::/128                                          All zeros
        local           ::1/128         0000:0000:0000:0000:0000:0000:0000:0001
        linklocal       fe80::/10                                       Starts with fe8, fe9, fea, feb
        sitelocal       fec0::/10   (deprecated)                        Starts with fec, fed, fee, fef
        uniquelocal     fc00::/7    (similar to RFC1918 addresses)      Starts with: fc or fd
        pdmulticast     ff00::/8                                        Starts with ff
        v4transition    ::ffff:0:0/96 (IPv4-mapped)                     Starts with 0000:0000:0000:0000:0000:ffff
                        ::ffff:0:0:0/96 (Stateless IP/ICMP Translation) Starts with 0000:0000:0000:0000:ffff:0000
                        0064:ff9b::/96 ("Well-Known" prefix)            Starts with 0064:ff9b:0000:0000:0000:0000
        6to4            2002::/16                                       Starts with 2002
        teredo          2001::/32                                       Starts with 2001:0000
        benchmark       2001:2::/48                                     Starts with 2001:0002:0000
        documentation   2001:db8::/32                                   Starts with 2001:0db8
    */
    // Sort IPv6 addresses into logical ordering
    sort_ip6 : function (a, b) {
        "use strict";
        var typeof_a, typeof_b;
        typeof_a = this.typeof_ip6(a);
        typeof_b = this.typeof_ip6(b);
        // addresses of different types have a distinct precedence order
        // global, linklocal, [other]
        if (typeof_a === typeof_b) {
            // TODO - move normalise out of this function so it doesn't happen for every comparison in the sort
            a = this.normalise_ip6(a);
            b = this.normalise_ip6(b);
            if (a === b)
            {
                return 0;   // Identical
            }
            else if (a > b)
            {
                return 1;   // a > b
            }
            return -1;      // b > a
            // addresses of same type are compared based on their numeric values
            // e.g. fe80::2001 comes before fe80::2:2001
            // Comparison can be made lexicographically on normalised address
            // Return -1 if a < b, 0 if a == b, 1 if a > b
        }
        // They are not equal
        else if (typeof_a === "global")
        {
            return -1;  // a comes before b
        }
        else if (typeof_b === "global")
        {
            return 1;   // b comes before a
        }
        // Neither of them are global
        else if (typeof_a === "linklocal")
        {
            return -1;  // a comes before b
        }
        else if (typeof_b === "linklocal")
        {
            return 1;   // b comes before a
        }

    },

    typeof_ip6 : function (ip_address) {
        "use strict";
        var norm_address;
        log("Sixornot - dns_handler:typeof_ip6: " + ip_address, 3);
        // 1. Check IP version, return false if v4
        if (!dns_handler.is_ip6(ip_address)) {
            return false;
        }
        // 2. Normalise address, return false if normalisation fails
        norm_address = dns_handler.normalise_ip6(ip_address);
        // 3. Compare against type patterns
        if (norm_address === "0000:0000:0000:0000:0000:0000:0000:0000")
        {
            return "unspecified";
        }
        if (norm_address === "0000:0000:0000:0000:0000:0000:0000:0001"
         || norm_address === "fe80:0000:0000:0000:0000:0000:0000:0001") // linklocal address of loopback interface on Mac OSX
        {
            return "localhost";
        }
        if (["fe8", "fe9", "fea", "feb"].indexOf(norm_address.substr(0, 3)) !== -1)
        {
            return "linklocal";
        }
        if (["fec", "fed", "fee", "fef"].indexOf(norm_address.substr(0, 3)) !== -1)
        {
            return "sitelocal";
        }
        if (["fc", "fd"].indexOf(norm_address.substr(0, 2)) !== -1)
        {
            return "uniquelocal";
        }
        if (["ff"].indexOf(norm_address.substr(0, 2)) !== -1)
        {
            return "multicast";
        }
        if (["2002"].indexOf(norm_address.substr(0, 4)) !== -1)
        {
            return "6to4";
        }
        if (["2001:0000"].indexOf(norm_address.substr(0, 9)) !== -1)
        {
            return "teredo";
        }
        // If no other type then address is global
        return "global";
    },

    /* Returns value of preference network.dns.disableIPv6 */
    is_ip6_disabled : function () {
        "use strict";
        return Services.prefs.getBoolPref("network.dns.disableIPv6");
    },


    /* Returns true if the domain specified is in the list of IPv4-only domains */
    is_ip4only_domain : function (domain) {
        "use strict";
        var ip4onlydomains, i;
        ip4onlydomains = Services.prefs.getCharPref("network.dns.ipv4OnlyDomains").replace(/\s+/g, "").toLowerCase().split(",");
        domain = domain.toLowerCase();
        for (i = 0; i < ip4onlydomains.length; i += 1)
        {
            if (domain === ip4onlydomains[i])
            {
                return true;
            }
        }
        return false;
    },

    /* Finding local IP address(es)
       Uses either the built-in Firefox method or OS-native depending on availability */
    resolve_local_async : function (callback) {
        "use strict";
        log("Sixornot - dns_handler:resolve_local_async");
        if (this.local_ctypes) {
            // If remote resolution is happening via ctypes...
            return this.local_ctypes_async(callback);
        } else {
            // Else if using firefox methods
            return this.local_firefox_async(callback);
        }
    },

    /* Use dns_worker thread to perform OS-native DNS lookup for the local host */
    local_ctypes_async : function (callback) {
        "use strict";
        var new_callback_id;
        log("Sixornot - dns_handler:local_ctypes_async - selecting resolver for local host lookup", 2);
        new_callback_id = this.add_callback_id(callback);

        this.worker.postMessage(JSON.stringify({"callbackid": new_callback_id, "reqid": this.reqids.locallookup, "content": null}));

        return this.make_cancel_obj(new_callback_id);
    },

    /* Proxy to remote_firefox_async since it does much the same thing */
    local_firefox_async : function (callback) {
        "use strict";
        var myhostname;
        log("Sixornot - dns_handler:local_firefox_async - resolving local host using Firefox builtin method", 2);
        myhostname = Components.classes["@mozilla.org/network/dns-service;1"]
                        .getService(Components.interfaces.nsIDNSService).myHostName;
        return this.remote_firefox_async(myhostname, callback);
    },


    /* Finding remote IP address(es)
       Resolve IP address(es) of a remote host using DNS */
    resolve_remote_async : function (host, callback) {
        "use strict";
        if (this.remote_ctypes) {
            // If remote resolution is happening via ctypes...
            return this.remote_ctypes_async(host, callback);
        } else {
            // Else if using firefox methods
            return this.remote_firefox_async(host, callback);
        }
    },

    /* Use dns_worker thread to perform OS-native DNS lookup for a remote host */
    remote_ctypes_async : function (host, callback) {
        "use strict";
        var new_callback_id;
        log("Sixornot - dns_handler:remote_ctypes_async - host: " + host + ", callback: " + callback, 2);
        new_callback_id = this.add_callback_id(callback);

        this.worker.postMessage(JSON.stringify({"callbackid": new_callback_id, "reqid": this.reqids.remotelookup, "content": host}));

        return this.make_cancel_obj(new_callback_id);
    },

    remote_firefox_async : function (host, callback) {
        "use strict";
        var my_callback;
        log("Sixornot - dns_handler:remote_firefox_async - host: " + host + ", callback: " + callback, 2);

        my_callback = {
            onLookupComplete : function (nsrequest, dnsresponse, nsstatus) {
                var ip_addresses;
                // Request has been cancelled - ignore
                if (nsstatus === Components.results.NS_ERROR_ABORT) {
                    return;
                }
                // Request has failed for some reason
                if (nsstatus !== 0 || !dnsresponse || !dnsresponse.hasMore()) {
                    if (nsstatus === Components.results.NS_ERROR_UNKNOWN_HOST) {
                        log("Sixornot - dns_handler:remote_firefox_async - resolve host failed, unknown host", 1);
                        callback(["FAIL"]);
                    } else {
                        log("Sixornot - dns_handler:remote_firefox_async - resolve host failed, status: " + nsstatus, 1);
                        callback(["FAIL"]);
                    }
                    // Address was not found in DNS for some reason
                    return;  
                }
                // Otherwise address was found
                ip_addresses = [];
                while (dnsresponse.hasMore()) {
                    ip_addresses.push(dnsresponse.getNextAddrAsString());
                }
                // Call callback for this request with ip_addresses array as argument
                callback(ip_addresses);
            }
        };
        try {
            return Components.classes["@mozilla.org/network/dns-service;1"]
                    .getService(Components.interfaces.nsIDNSService)
                    .asyncResolve(host, 0, my_callback,
                        Components.classes["@mozilla.org/thread-manager;1"]
                        .getService(Components.interfaces.nsIThreadManager)
                        .currentThread);
        } catch (e) {
            Components.utils.reportError("Sixornot EXCEPTION: " + parse_exception(e));
            callback(["FAIL"]);
            return null;
        }
    },


    /*
        ctypes dns callback handling functions
    */
    // Index this.callback_ids and return required callback
    find_callback_by_id : function (callback_id) {
        "use strict";
        var f;
        log("Sixornot - dns_handler:find_callback_by_id - callback_id: " + callback_id, 2);
        // Callback IDs is an array of 2-item arrays - [ID, callback]
        f = function (a) {
            return a[0];
        };
        // Returns -1 if ID not found
        return this.callback_ids.map(f).indexOf(callback_id);
    },

    // Search this.callback_ids for the ID in question, remove it if it exists
    remove_callback_id : function (callback_id) {
        "use strict";
        var i;
        log("Sixornot - dns_handler:remove_callback_id - callback_id: " + callback_id, 2);
        i = this.find_callback_by_id(callback_id);
        if (i !== -1) {
            // Return the callback function
            return this.callback_ids.splice(i, 1)[0][1];
        }
        // If ID not found, return false
        return false;
    },

    // Add a callback to the callback_ids array with the next available ID
    add_callback_id : function (callback) {
        "use strict";
        log("Sixornot - dns_handler:add_callback_id", 2);
        // Use next available callback ID, return that ID
        this.next_callback_id = this.next_callback_id + 1;
        this.callback_ids.push([this.next_callback_id, callback]);
        return this.next_callback_id;
    },

    make_cancel_obj : function (callback_id) {
        "use strict";
        var obj;
        log("Sixornot - dns_handler:make_cancel_obj - callback_id: " + callback_id, 2);
        obj = {
            cancel : function () {
                // Remove ID from callback_ids if it exists there
                dns_handler.remove_callback_id(callback_id);
            }
        };
        return obj;
    },


    /*
        Misc.
    */

    // Cancels an active ctypes DNS lookup request currently being actioned by Worker
    cancel_request : function (request) {
        "use strict";
        log("Sixornot - dns_handler:cancel_request - request: " + request, 2);
        try {
            // This function can be called with request as a null or undefined value
            if (request) {
                request.cancel(Components.results.NS_ERROR_ABORT);
            }
        } catch (e) {
            Components.utils.reportError("Sixornot EXCEPTION: " + parse_exception(e));
        }
    },

    // Returns true if the URL is set to have its DNS lookup proxied via SOCKS
    is_proxied_dns : function (url) {
        "use strict";
        var uri, proxyinfo;
        log("Sixornot - dns_handler:is_proxied_dns - url: " + url, 2);
        uri = Components.classes["@mozilla.org/network/io-service;1"]
                .getService(Components.interfaces.nsIIOService)
                .newURI(url, null, null);
        // Finds proxy (shouldn't block thread; we already did this lookup to load the page)
        // TODO - do this async!
        proxyinfo = Components.classes["@mozilla.org/network/protocol-proxy-service;1"]
                    .getService(Components.interfaces.nsIProtocolProxyService)
                    .resolve(uri, 0);
        // "network.proxy.socks_remote_dns" pref must be set to true for Firefox to set TRANSPARENT_PROXY_RESOLVES_HOST flag when applicable
        return (proxyinfo !== null) && (proxyinfo.flags && proxyinfo.TRANSPARENT_PROXY_RESOLVES_HOST);
    }

/*
    // Convert a base10 representation of a number into a base16 one (zero-padded to two characters, input number less than 256)
    to_hex : function (int_string)
    {
        var hex;
        hex = Number(int_string).toString(16);
        if (hex.length < 2)
        {
            hex = "0" + hex;
        }
        return hex;
    },

    // Ensure decimal number has no spaces etc.
    to_decimal : function (int_string)
    {
        return Number(int_string).toString(10);
    },
*/
};
