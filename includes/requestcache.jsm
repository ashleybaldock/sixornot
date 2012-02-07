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
/*global Components, Services */

// Provided by Sixornot
/*global parse_exception, prefs */

// Module imports we need
/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");
/*jslint es5: false */

var EXPORTED_SYMBOLS = ["requests"];


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

