/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2014 Timothy Baldock. All Rights Reserved.
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

// Input is 32bit number, right-shift until right-most bit is 1 then output
var get_ipv4_prefix = function (mask) {
    var lookup = {
        0x00000001: 1,
        0x00000003: 2,
        0x00000007: 3,
        0x0000000f: 4,
        0x0000001f: 5,
        0x0000003f: 6,
        0x0000007f: 7,
        0x000000ff: 8,
        0x000001ff: 9,
        0x000003ff: 10,
        0x000007ff: 11,
        0x00000fff: 12,
        0x00001fff: 13,
        0x00003fff: 14,
        0x00007fff: 15,
        0x0000ffff: 16,
        0x0001ffff: 17,
        0x0003ffff: 18,
        0x0007ffff: 19,
        0x000fffff: 20,
        0x001fffff: 21,
        0x003fffff: 22,
        0x007fffff: 23,
        0x00ffffff: 24,
        0x01ffffff: 25,
        0x03ffffff: 26,
        0x07ffffff: 27,
        0x0fffffff: 28,
        0x1fffffff: 29,
        0x3fffffff: 30,
        0x7fffffff: 31,
        0xffffffff: 32
    };
    log("Sixornot - get_ipv4_prefix - input: " + mask, 1);
    return lookup[mask];
};
// Input is array of chars, for each one use lookup table and add to total
var get_ipv6_prefix = function (mask) {
    var sum = 0;
    var lookup = {
        0x00: 0,
        0x80: 1,
        0xc0: 2,
        0xe0: 3,
        0xf0: 4,
        0xf8: 5,
        0xfc: 6,
        0xfe: 7,
        0xff: 8,
    };

    for (var i = 0; i < mask.length; i++) {
        if (mask[i] === 0) {
            return sum;
        }
        sum += lookup[mask[i]];
    }
    return sum
};


var log = function (message, level) {
    "use strict";
    if (level === null) { level = 1 };
    postMessage(JSON.stringify({"reqid": 254, "content": [message, level]}));
};

// Returns a string version of an exception object with its stack trace
// Uncaught exceptions will be handled by the onerror handler added to the worker by its parent
var parse_exception = function (e) {
    "use strict";
    if (!e) {
        return "";
    } else if (!e.stack) {
        return String(e);
    } else {
        return String(e) + " \n" + e.stack;
    }
};


// Data is a serialised dict
// {"callbackid": , "reqid": , "content": }
// callbackid is a number which will be passed back to the main thread
//      to indicate which callback function (if any) should be executed
//      when this request completes (optional)
// reqid references the type of request, see reqids table
// content is arbitrary information passed to the reqid function (optional)
var reqids = {
    shutdown: 0,        // Shut down DNS resolver, must be last request!
    remotelookup: 1,    // Perform dns.resolve_remote lookup
    locallookup: 2,     // Perform dns.resolve_local lookup
    checkremote: 3,     // Check whether ctypes resolver is in use for remote lookups
    checklocal: 4       // Check whether ctypes resolver is in use for local lookups
};

// If you do var onmessage this doesn't function properly
onmessage = function (evt) {
    "use strict";
    log("Sixornot(dns_worker) - onmessage: " + evt.data, 1);

    // Because of new worker implementation we have to manually deserialise here
    if (evt.data) {
        var data = JSON.parse(evt.data);
        if (data.reqid === reqids.remotelookup) {
            postMessage(JSON.stringify({"callbackid": data.callbackid,
                "reqid": data.reqid, "content": resolver.resolve_remote(data.content)}));
        }
        if (data.reqid === reqids.locallookup) {
            postMessage(JSON.stringify({"callbackid": data.callbackid,
                "reqid": data.reqid, "content": resolver.resolve_local()}));
        }
        if (data.reqid === reqids.checkremote) {
            postMessage(JSON.stringify({"callbackid": data.callbackid,
                "reqid": data.reqid, "content": resolver.remote_ctypes}));
        }
        if (data.reqid === reqids.checklocal) {
            postMessage(JSON.stringify({"callbackid": data.callbackid,
                "reqid": data.reqid, "content": resolver.local_ctypes}));
        }
        if (data.reqid === reqids.shutdown) {
            resolver.shutdown();
            close(); // Close worker thread
        }
    }
};

resolver.init();
postMessage(JSON.stringify({"reqid": reqids.checkremote, "content": resolver.remote_ctypes}));
postMessage(JSON.stringify({"reqid": reqids.checklocal, "content": resolver.local_ctypes}));
log("Sixornot(worker_base) - completed init", 1);

