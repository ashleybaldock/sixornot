/*jslint white: true, maxerr: 100, indent: 4 */

// Provided by Firefox:
/*global Components, Services */

// Provided by Sixornot
/*global */

// Module imports we need
/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");

// Import logging

/*jslint es5: false */

var EXPORTED_SYMBOLS = ["prefs"];

var prefs = {
    defaults: {
        nextitem:           "bookmarks-menu-button-container",
        toolbar:            "nav-bar",
        showaddressicon:    false,
        greyscaleicons:     false,
        loglevel:           0,
        overridelocale:     "",
        showallips:         false
    },
    PREF_BRANCH_SIXORNOT: Services.prefs.getBranch("extensions.sixornot."),
    PREF_BRANCH_DNS:      Services.prefs.getBranch("network.dns."),

    get_int: function (name) {
        "use strict";
        try {
            return this.PREF_BRANCH_SIXORNOT.getIntPref(name);
        } catch (e) {
        }
        if (this.defaults.hasOwnProperty(name) && typeof(this.defaults[name]) === typeof(1)) {
            return this.defaults[name];
        } else {
            // TODO raise preference type mismatch error
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
            // TODO raise preference type mismatch error
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
            // TODO raise preference type mismatch error
            throw "Sixornot - Preference type mismatch";
        }
    },

    set_char: function (name, value) {
        "use strict";
        this.PREF_BRANCH_SIXORNOT.setCharPref(name, value);
    }
};

