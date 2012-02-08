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

var EXPORTED_SYMBOLS = ["gt"];


var regex = /(\w+)-\w+/;

// get user's locale
var locale = Components.classes["@mozilla.org/chrome/chrome-registry;1"].getService(Components.interfaces.nsIXULChromeRegistry).getSelectedLocale("global");
log("Sixornot - init Localisation - detected locale as: " + locale, 2);

var getstring = function (string_bundle, aKey) {
    "use strict";
    if (!string_bundle) {
        return false;
    }
    try {
        return string_bundle.GetStringFromName(aKey);
    } catch (e) {
    }
    return "";
};

var gt = (function () {
    "use strict";
    var filepath, defaultBundle, defaultBasicBundle,
        locale_base, addonsDefaultBundle;

    if (prefs.get_char("overridelocale") !== "") {
        locale = prefs.get_char("overridelocale");
    }

    filepath = function (locale) {
        return "resource://sixornot/locale/" + locale + "/sixornot.properties";
    };

    defaultBundle = Services.strings.createBundle(filepath(locale));
    // Locale made up of two parts, language code and country code
    // We try to use more specific option first (localeBundle) or less specific second (localeBasicBundle)
    // E.g. locale is "en-US", try to find a file called "en-US/sixornot.properties" first, but fall back to "en/sixornot.properties" if not
    locale_base = locale.match(regex);

    if (locale_base) {
        defaultBasicBundle = Services.strings.createBundle(filepath(locale_base[1]));
    }

    addonsDefaultBundle = Services.strings.createBundle(filepath("en"));

    // If called with only one argument, return translated string
    // If called with two arguments, return translated string for the locale specified in second argument (if possible)
    return function (aKey, aLocale) {
        var localeBundle, localeBasicBundle, locale_base;
        if (aLocale) {
            localeBundle = Services.strings.createBundle(filepath(aLocale));
            // Locale made up of two parts, language code and country code
            // We try to use more specific option first (localeBundle) or less specific second (localeBasicBundle)
            // E.g. locale is "en-US", try to find a file called "en-US/sixornot.properties" first, but fall back to "en/sixornot.properties" if not
            locale_base = aLocale.match(regex);
            if (locale_base) {
                localeBasicBundle = Services.strings.createBundle(filepath(locale_base[1]));
            }
        }

        // Search from most specific to least specific locale(s)
        // 1. locale passed into function, e.g. en-US
        // 2. generic locale passed in, e.g. en
        // 3. Locale set on init, e.g. en-GB
        // 4. generic form of that locale, e.g. en
        // 5. fall-back default, e.g. en
        // 6. If all else fails, return the string passed in
        return getstring(localeBundle, aKey)
            || getstring(localeBasicBundle, aKey)
            || (defaultBundle && getstring(defaultBundle, aKey))
            || (defaultBasicBundle && getstring(defaultBasicBundle, aKey))
            || getstring(addonsDefaultBundle, aKey)
            || aKey;
    };
}());

