/* ***** BEGIN LICENSE BLOCK *****
 * Version: MIT/X11 License
 * 
 * Copyright (c) 2010 Erik Vold
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Contributor(s):
 *   Erik Vold <erikvvold@gmail.com> (Original Author)
 *   Finnbarr P. Murphy <fpm@hotmail.com>
 *   Timothy Baldock <tb@entropy.me.uk>
 *
 * ***** END LICENSE BLOCK ***** */

// Provided by Firefox:
/*global Components, Services */

// Provided in file which includes this one
/*global log */

// Note: The anonymous function is immediately invoked with this as the value assigned to global,
// returning a function which takes two parameters, addon and filename
var initLocalisation = (function(global)
{
    var regex, locale, getStr;
    regex = /(\w+)-\w+/;

    // get user's locale
    locale = Components.classes["@mozilla.org/chrome/chrome-registry;1"].getService(Components.interfaces.nsIXULChromeRegistry).getSelectedLocale("global");
    log("Sixornot - initLocalisation - detected locale as: " + locale, 2);

    getStr = function (aStrBundle, aKey)
    {
        if (!aStrBundle)
        {
            return false;
        }
        try
        {
            return aStrBundle.GetStringFromName(aKey);
        }
        catch (e)
        {
        }
        return "";
    };

    return function (addon, filename)
    {
        var defaultLocale, filepath, defaultBundle, defaultBasicBundle, locale_base, addonsDefaultBundle;

        defaultLocale = "en";

        filepath = function (locale)
        {
            return addon.getResourceURI("locale/" + locale + "/" + filename).spec;
        };

        defaultBundle = Services.strings.createBundle(filepath(locale));
        // Locale made up of two parts, language code and country code
        // We try to use more specific option first (localeBundle) or less specific second (localeBasicBundle)
        // E.g. locale is "en-US", try to find a file called "en-US/sixornot.properties" first, but fall back to "en/sixornot.properties" if not
        locale_base = locale.match(regex);

        if (locale_base)
        {
            defaultBasicBundle = Services.strings.createBundle(filepath(locale_base[1]));
        }

        addonsDefaultBundle = Services.strings.createBundle(filepath(defaultLocale));

        // Set this function to act in addon-global scope
        // If called with only one argument, return translated string
        // If called with two arguments, return translated string for the locale specified in second argument (if possible)
        global.gt = function l10n_underscore (aKey, aLocale)
        {
            var localeBundle, localeBasicBundle, locale_base;
            if (aLocale)
            {
                localeBundle = Services.strings.createBundle(filepath(aLocale));
                // Locale made up of two parts, language code and country code
                // We try to use more specific option first (localeBundle) or less specific second (localeBasicBundle)
                // E.g. locale is "en-US", try to find a file called "en-US/sixornot.properties" first, but fall back to "en/sixornot.properties" if not
                locale_base = aLocale.match(regex);
                if (locale_base)
                {
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
            return getStr(localeBundle, aKey)
                || getStr(localeBasicBundle, aKey)
                || (defaultBundle && getStr(defaultBundle, aKey))
                || (defaultBasicBundle && getStr(defaultBasicBundle, aKey))
                || getStr(addonsDefaultBundle, aKey)
                || aKey;
        };
    };
}(this));
