/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2008-2014 Timothy Baldock. All Rights Reserved.
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

// JSLint parameters
/*jslint white: true */

// Provided by Firefox:
/*global XPCOM, importScript, ctypes, postMessage, close, onmessage: true */

// Global variables defined by this script
var log, parse_exception, dns;

// Utility functions

log = function (message, level)
{
    "use strict";
    if (level === null) { level = 1 };
    postMessage(JSON.stringify({"reqid": 254, "content": [message, level]}));
};

// Returns a string version of an exception object with its stack trace
// Uncaught exceptions will be handled by the onerror handler added to the worker by its parent
parse_exception = function (e)
{
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

// If you do var onmessage this doesn't function properly
onmessage = function (evt) {
    "use strict";
    log("Sixornot(dns_worker) - onmessage: " + evt.toSource(), 1);

    // Because of new worker implementation we have to manually deserialise here
    if (evt.data) {
        var data = JSON.parse(evt.data);
        if (data.reqid === 255) {
            dns.init(data.content);
        } else {
            dns.dispatch_message(data);
        }
    }
};


// ChromeWorker specific dns functions
dns = {
    reqids: {
        shutdown: 0,        // Shut down DNS resolver, must be last request!
        remotelookup: 1,    // Perform dns.resolve_remote lookup
        locallookup: 2,     // Perform dns.resolve_local lookup
        checkremote: 3,     // Check whether ctypes resolver is in use for remote lookups
        checklocal: 4       // Check whether ctypes resolver is in use for local lookups
    },

    init : function (operatingsystem) {
        "use strict";
        log("Sixornot(dns_worker) - dns:init", 1);

        // OS specific sections
        switch(operatingsystem) {
            case "darwin":
                importScripts("resource://sixornot/includes/ctypes/darwin.js");
                break;

            case "linux":
                importScripts("resource://sixornot/includes/ctypes/linux.js");
                break;

            case "winnt":
                importScripts("resource://sixornot/includes/ctypes/winnt.js");
                break;

            default:
                log("Sixornot(dns_worker) - Unknown platform - unable to init ctypes resolver, falling back to firefox", 1);
                postMessage(JSON.stringify({"reqid": 255, "content": false}));
                postMessage(JSON.stringify({"reqid": this.reqids.checkremote, "content": false}));
                postMessage(JSON.stringify({"reqid": this.reqids.checklocal, "content": false}));
                return;
        }

        postMessage(JSON.stringify({"reqid": 255, "content": true}));
        postMessage(JSON.stringify({"reqid": this.reqids.checkremote, "content": resolver.remote_ctypes}));
        postMessage(JSON.stringify({"reqid": this.reqids.checklocal, "content": resolver.local_ctypes}));
    },

    // Select correct function to execute based on ID code sent by main thread
    dispatch_message : function (message) {
        "use strict";
        var dispatch, f, ret;
        log("Sixornot(dns_worker) - dns:dispatch_message: " + message.toSource(), 2);

        dispatch = [];
        dispatch[this.reqids.shutdown] = this.shutdown;
        dispatch[this.reqids.remotelookup] = this.resolve_remote;
        dispatch[this.reqids.locallookup] = this.resolve_local;
        dispatch[this.reqids.checkremote] = this.check_remote;
        dispatch[this.reqids.checklocal] = this.check_local;

        // Use request_id (data[1]) to select function
        f = dispatch[message.reqid];
        if (f) {
            // Need to use function.call so that the value of "this" in the called function is set correctly
            ret = f.call(this, message.content);
            // Return data to main thread
            postMessage(JSON.stringify({"callbackid": message.callbackid, "reqid": message.reqid, "content": ret}));
        }
    },

    shutdown : function () {
        "use strict";
        resolver.shutdown();
        // Close worker thread
        close();
    },

    check_remote : function () {
        "use strict";
        log("Sixornot(dns_worker) - dns:check_remote, value: " + resolver.remote_ctypes, 1);
        return resolver.remote_ctypes;
    },

    check_local : function () {
        "use strict";
        log("Sixornot(dns_worker) - dns:check_local, value: " + resolver.local_ctypes, 1);
        return resolver.local_ctypes;
    },

    resolve_local : function () {
        "use strict";
        log("Sixornot(dns_worker) - dns:resolve_local", 2);

        return resolver.resolve_local();
    },

    resolve_remote : function (host) {
        "use strict";
        log("Sixornot(dns_worker) - dns:resolve_remote - resolving host: " + host, 2);

        if (typeof host !== typeof "string") {
            log("Sixornot(dns_worker) - dns:resolve_remote - Bad host, not a string", 1);
            return ["FAIL"];
        }

        return resolver.resolve_remote(host);
    }
};

