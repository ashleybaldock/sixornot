/*
 * Copyright 2015 Timothy Baldock. All Rights Reserved.
 */

/* global log, prefs */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/prefs.jsm");

/* exported gt */
var EXPORTED_SYMBOLS = ["gt"];

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
    };

    var locale = prefs.get_char("overridelocale");
    if (locale !== "") {
        stringBundle = Services.strings.createBundle("resource://sixornot/locale/" + locale + "/sixornot.properties");
        if (isValidBundle(stringBundle)) {
            log("init locale - overriding locale as: " + locale, 1);
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
                log("init locale - overriding locale as: " + locale, 1);
            }
        }
    } else {
        log("init locale - using system locale", 1);
        // This has to be a chrome:// URI or it doesn't work
        stringBundle = Services.strings.createBundle("chrome://sixornot/locale/sixornot.properties");
    }

    return function (key, args) {
        if (args) {
            return stringBundle.formatStringFromName(key, args, args.length);
        } else {
            return stringBundle.GetStringFromName(key);
        }
    };
}());

