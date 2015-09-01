/*
 * Copyright 2008-2015 Timothy Baldock. All Rights Reserved.
 */

// Provided by Firefox:
/*global Components, Services */

// Module imports we need
/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");
/*jslint es5: false */

var EXPORTED_SYMBOLS = ["prefs"];

var PREF_SIXORNOT = "extensions.sixornot.";
var PREF_DNS= "network.dns.";
// disableIPv6, ipv4OnlyDomains
// network.http.fast-fallback-to-IPv4

var prefs = {
    defaults: {
        toolbar:            "nav-bar",
        nextitem:           "",
        showaddressicon:    false,
        greyscaleicons:     false,
        loglevel:           0,
        overridelocale:     "",
        showallips:         false,
        showlocal:          true
    },

    sixornot_prefs: PREF_SIXORNOT,
    dns_prefs: PREF_DNS,

    PREF_BRANCH_SIXORNOT: Services.prefs.getBranch(PREF_SIXORNOT),
    PREF_BRANCH_DNS:      Services.prefs.getBranch(PREF_DNS),

    createObserver: function (prefToObserve, callback) {
        return {
            observe: function (aSubject, aTopic, aData) {
                if (aTopic.valueOf() !== "nsPref:changed") {
                    return;
                }
                if (aData === prefToObserve) {
                    callback();
                }
            },
            register: function () {
                Services.prefs.addObserver(prefToObserve, this, false);
                return this;
            },
            unregister: function () {
                Services.prefs.removeObserver(prefToObserve, this);
                return this;
            }
        }
    },

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

