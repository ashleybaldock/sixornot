/*
 * Copyright 2008-2016 Ashley Baldock. All Rights Reserved.
 */

Components.utils.import("resource://gre/modules/Services.jsm");

/* exported prefs */
var EXPORTED_SYMBOLS = ["prefs"];

var prefs = (function () {
    "use strict";

    var PREF_BRANCH_SIXORNOT = Services.prefs.getBranch("extensions.sixornot.");
    //var PREF_BRANCH_DNS      = Services.prefs.getBranch("network.dns.");
    // disableIPv6, ipv4OnlyDomains
    // network.http.fast-fallback-to-IPv4

    var defaults = {
        showaddressicon:    false,
        greyscaleicons:     false,
        loglevel:           0,
        showallips:         false,
        showlocal:          true
    };

    // Create all preferences with defaults (leave existing settings if present + valid)
    (function () {
        var key, val;
        for (key in defaults) {
            if (defaults.hasOwnProperty(key)) {
                // Preserve pre-existing values for preferences in case user has modified them
                val = defaults[key];
                if (typeof(val) === typeof(true)) {
                    if (PREF_BRANCH_SIXORNOT.getPrefType(key) === Services.prefs.PREF_INVALID) {
                        PREF_BRANCH_SIXORNOT.setBoolPref(key, val);
                    }
                } else if (typeof(val) === typeof(1)) {
                    if (PREF_BRANCH_SIXORNOT.getPrefType(key) === Services.prefs.PREF_INVALID) {
                        PREF_BRANCH_SIXORNOT.setIntPref(key, val);
                    }
                } else if (typeof(val) === typeof("")) {
                    if (PREF_BRANCH_SIXORNOT.getPrefType(key) === Services.prefs.PREF_INVALID) {
                        PREF_BRANCH_SIXORNOT.setCharPref(key, val);
                    }
                }
            }
        }
    }());

    return {
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
            };
        },

        getInt: function (name) {
            try {
                return PREF_BRANCH_SIXORNOT.getIntPref(name);
            } catch (e) {
                if (defaults.hasOwnProperty(name) && typeof(defaults[name]) === typeof(1)) {
                    return defaults[name];
                } else {
                    throw "Sixornot - Preference type mismatch";
                }
            }
        },

        getBool: function (name) {
            try {
                return PREF_BRANCH_SIXORNOT.getBoolPref(name);
            } catch (e) {
                if (defaults.hasOwnProperty(name) && typeof(defaults[name]) === typeof(true)) {
                    return defaults[name];
                } else {
                    throw "Sixornot - Preference type mismatch";
                }
            }
        },

        setBool: function (name, value) {
            PREF_BRANCH_SIXORNOT.setBoolPref(name, value);
        },

        getChar: function (name) {
            try {
                return PREF_BRANCH_SIXORNOT.getCharPref(name);
            } catch (e) {
                if (defaults.hasOwnProperty(name) && typeof(defaults[name]) === typeof("")) {
                    return defaults[name];
                } else {
                    throw "Sixornot - Preference type mismatch";
                }
            }
        },

        setChar: function (name, value) {
            PREF_BRANCH_SIXORNOT.setCharPref(name, value);
        }
    };
}());

