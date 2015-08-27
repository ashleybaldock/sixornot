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

/*jslint es5: true */
// Import dns module (adds global symbol: dns_handler)
Components.utils.import("resource://sixornot/includes/dns.jsm");
/*jslint es5: false */

// Provided by Firefox:
/*global Components */

// Provided by Sixornot
/*global parse_exception, prefs */

var EXPORTED_SYMBOLS = ["requests", "create_new_entry"];


// Make methods in this object for updating its state
// Adding/removing/lookup of entries (hide internal implementation)

/* Prepare and return a new blank entry for the hosts listing */
var create_new_entry = function (host, address, address_family, inner, outer) {
    return {
        data: {
            host: host,
            address: address,
            address_family: address_family,
            remote: true,
            show_detail: true,
            count: 1,
            ipv6s: [],
            ipv4s: [],
            dns_status: "ready",
        },
        dns_cancel: null,
        inner_id: inner,
        outer_id: outer,
        lookup_ips: function (callback) {
            var entry, on_returned_ips;
            // Don't do IP lookup for local file entries
            if (this.data.address_family === 1) {
                this.dns_status = "complete";
                return;
            }
            /* Create closure containing reference to element and trigger async lookup with callback */
            entry = this;
            on_returned_ips = function (ips) {
                entry.dns_cancel = null;
                if (ips[0] === "FAIL") {
                    entry.data.ipv6s = [];
                    entry.data.ipv4s = [];
                    entry.data.dns_status = "failure";
                } else {
                    entry.data.ipv6s = ips.filter(dns_handler.is_ip6);
                    entry.data.ipv4s = ips.filter(dns_handler.is_ip4);
                    entry.data.dns_status = "complete";
                }
                // Also trigger page change event here to refresh display of IP tooltip
                callback(entry.data);
            };
            if (entry.dns_cancel) {
                entry.dns_cancel.cancel();
            }
            entry.dns_cancel = dns_handler.resolve_remote_async(entry.data.host, on_returned_ips);
        }
    };
};

/*
 * Contains two lists:
 * cache - All requests which have been made for webpages which are still in history
 * waitinglist - Requests which have yet to have an innerWindow ID assigned
 */
var requests = {
    cache: [],
    waitinglist: [],
    print_cache: function () {
        var out = "cache is:\n";
        this.cache.forEach(function (item, index, items) {
            out += "[" + index + ": ";
            item.forEach(function (item, index, items) {
                out += "[";
                out += item.host;
                out += ",";
                out += item.inner_id;
                out += ",";
                out += item.outer_id;
                out += "],";
            });
            out += "],\n";
        });
        return out;
    },
    print_waitinglist: function () {
        var out = "waitinglist is:\n";
        this.waitinglist.forEach(function (item, index, items) {
            out += "[" + index + ": ";
            item.forEach(function (item, index, items) {
                out += "[";
                out += item.host;
                out += ",";
                out += item.inner_id;
                out += ",";
                out += item.outer_id;
                out += "],";
            });
            out += "],\n";
        });
        return out;
    }
};

