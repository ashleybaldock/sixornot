/*
 * Copyright (c) 2015 Timothy Baldock. All Rights Reserved.
 */

/*jslint white: true, maxerr: 100, indent: 4 */

// Provided by Firefox:
/*global Components, Services */

// Provided by Sixornot
/*global log, parse_exception, prefs */

// Module imports we need
/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/prefs.jsm");
/*jslint es5: false */

var EXPORTED_SYMBOLS = [ "gt" ];

var gt = (function () {
    "use strict";
    var stringBundle;

    var isValidBundle = function (bundle) {
        try {
            bundle.GetStringFromName("label");
            return true;
        } catch (e) {
            return false;
        }
    }

    var locale = prefs.get_char("overridelocale");
    if (locale !== "") {
        stringBundle = Services.strings.createBundle("resource://sixornot/locale/" + locale + "/sixornot.properties");
        if (isValidBundle(stringBundle)) {
            log("init locale - overriding locale as: " + locale, 0);
        } else {
            var localeBase = locale.match(/(\w+)-\w+/);
            if (localeBase) {
                locale = locale.match(/(\w+)-\w+/)[1];
                if (locale) {
                    stringBundle = Services.strings.createBundle("resource://sixornot/locale/" + locale + "/sixornot.properties");
                }
            }
            if (!localeBase || !locale || !isValidBundle(stringBundle)) {
                log("SixOrNot warning: override locale setting invalid, falling back to system locale", 0);
                stringBundle = Services.strings.createBundle("chrome://sixornot/locale/sixornot.properties");
            } else {
                log("init locale - overriding locale as: " + locale, 0);
            }
        }
    } else {
        log("init locale - using system locale", 0);
        stringBundle = Services.strings.createBundle("chrome://sixornot/locale/sixornot.properties");
    }

    return function (key) {
        return stringBundle.GetStringFromName(key);
    };
}());

