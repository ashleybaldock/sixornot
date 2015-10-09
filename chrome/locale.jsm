/*
 * Copyright 2015 Timothy Baldock. All Rights Reserved.
 */

Components.utils.import("resource://gre/modules/Services.jsm");

/* exported gt */
var EXPORTED_SYMBOLS = ["gt"];

var gt = (function () {
    "use strict";
    var stringBundle = Services.strings.createBundle("chrome://sixornot/locale/sixornot.properties");

    return function (key, args) {
        if (args) {
            return stringBundle.formatStringFromName(key, args, args.length);
        } else {
            return stringBundle.GetStringFromName(key);
        }
    };
}());

