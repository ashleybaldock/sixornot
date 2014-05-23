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

// Module imports we need
/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");
/*jslint es5: false */

var EXPORTED_SYMBOLS = ["prefs"];

var PREF_SIXORNOT = "extensions.sixornot.";
var PREF_DNS= "network.dns.";

var prefs = {
    defaults: {
        showaddressicon:    false,
        greyscaleicons:     false,
        loglevel:           0,
        overridelocale:     "",
        showallips:         false
    },

    sixornot_prefs: PREF_SIXORNOT,
    dns_prefs: PREF_DNS,

    PREF_BRANCH_SIXORNOT: Services.prefs.getBranch(PREF_SIXORNOT),
    PREF_BRANCH_DNS:      Services.prefs.getBranch(PREF_DNS),

    get_int: function (name) {
        "use strict";
        try {
            return this.PREF_BRANCH_SIXORNOT.getIntPref(name);
        } catch (e) {
        }
        if (this.defaults.hasOwnProperty(name) && typeof(this.defaults[name]) === typeof(1)) {
            return this.defaults[name];
        } else {
            throw "Sixornot - Preference type mismatch";
        }
    },

    set_int: function (name, value) {
        "use strict";
        this.PREF_BRANCH_SIXORNOT.setCharPref(name, value);
    },

    get_bool: function (name) {
        "use strict";
        try {
            return this.PREF_BRANCH_SIXORNOT.getBoolPref(name);
        } catch (e) {
        }
        if (this.defaults.hasOwnProperty(name) && typeof(this.defaults[name]) === typeof(true)) {
            return this.defaults[name];
        } else {
            throw "Sixornot - Preference type mismatch";
        }
    },

    set_bool: function (name, value) {
        "use strict";
        this.PREF_BRANCH_SIXORNOT.setBoolPref(name, value);
    },

    get_char: function (name) {
        "use strict";
        try {
            return this.PREF_BRANCH_SIXORNOT.getCharPref(name);
        } catch (e) {
        }
        if (this.defaults.hasOwnProperty(name) && typeof(this.defaults[name]) === typeof("")) {
            return this.defaults[name];
        } else {
            throw "Sixornot - Preference type mismatch";
        }
    },

    set_char: function (name, value) {
        "use strict";
        this.PREF_BRANCH_SIXORNOT.setCharPref(name, value);
    },

    // Create all preferences with defaults (leave existing settings if present + valid)
    create: function () {
        "use strict";
        var key, val;
        for (key in this.defaults) {
            if (this.defaults.hasOwnProperty(key)) {
                // Preserve pre-existing values for preferences in case user has modified them
                val = this.defaults[key];
                if (typeof(val) === typeof(true)) {
                    if (this.PREF_BRANCH_SIXORNOT.getPrefType(key) === Services.prefs.PREF_INVALID) {
                        this.PREF_BRANCH_SIXORNOT.setBoolPref(key, val);
                    }
                } else if (typeof(val) === typeof(1)) {
                    if (this.PREF_BRANCH_SIXORNOT.getPrefType(key) === Services.prefs.PREF_INVALID) {
                        this.PREF_BRANCH_SIXORNOT.setIntPref(key, val);
                    }
                } else if (typeof(val) === typeof("")) {
                    if (this.PREF_BRANCH_SIXORNOT.getPrefType(key) === Services.prefs.PREF_INVALID) {
                        this.PREF_BRANCH_SIXORNOT.setCharPref(key, val);
                    }
                }
            }
        }
    }
};

