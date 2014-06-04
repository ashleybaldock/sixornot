/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2014 Timothy Baldock. All Rights Reserved.
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

// Provided in included modules:
/*global watchWindows, runOnWindows, log, parse_exception, insert_code, create_button, set_addressbar_icon_visibility, set_greyscale_icons */

/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/prefs.jsm");
Components.utils.import("resource://sixornot/includes/windowwatcher.jsm");
Components.utils.import("resource://sixornot/includes/gui.jsm");
/*jslint es5: false */

var EXPORTED_SYMBOLS = ["PREF_OBSERVER", "PREF_OBSERVER_DNS"];

/*
 * Sixornot Preferences observer
 * Watches our preferences so that if the user changes them manually we update to reflect the changes
 */
var PREF_OBSERVER = {
    observe: function (aSubject, aTopic, aData) {
        "use strict";
        log("Sixornot - PREF_OBSERVER - aSubject: " + aSubject + ", aTopic: " + aTopic.valueOf() + ", aData: " + aData, 2);
        if (aTopic.valueOf() !== "nsPref:changed") {
            return;
        }

        if (aData === "extensions.sixornot.showaddressicon") {
            log("Sixornot - PREF_OBSERVER - addressicon has changed", 2);
            runOnWindows(set_addressbar_icon_visibility);
        }
        if (aData === "extensions.sixornot.greyscaleicons") {
            log("Sixornot - PREF_OBSERVER - greyscaleicons has changed", 2);
            runOnWindows(set_greyscale_icons);
        }
        if (aData === "extensions.sixornot.loglevel") {
            log("Sixornot - PREF_OBSERVER - loglevel has changed", 2);
        }
        if (aData === "extensions.sixornot.overridelocale") {
            log("Sixornot - PREF_OBSERVER - overridelocale has changed", 2);
            // TODO - methods to reload UI panel translations
            //reload();
        }
        if (aData === "extensions.sixornot.showallips") {
            log("Sixornot - PREF_OBSERVER - showallips has changed", 2);
            // TODO - update display of local address info in panels
        }
    },

    register: function () {
        "use strict";
        Services.prefs.addObserver(prefs.sixornot_prefs, PREF_OBSERVER, false);
    },

    unregister: function () {
        "use strict";
        Services.prefs.removeObserver(prefs.sixornot_prefs, PREF_OBSERVER);
    }
};

/*
 * DNS Preferences observer
 * Watches built-in Firefox preferences which have an impact on DNS resolution.
 */
var PREF_OBSERVER_DNS = {
    observe: function (aSubject, aTopic, aData) {
        "use strict";
        log("Sixornot - PREF_OBSERVER_DNS - aSubject: " + aSubject + ", aTopic: " + aTopic.valueOf() + ", aData: " + aData, 2);
        if (aTopic.valueOf() !== "nsPref:changed") {
            return;
        }

        if (aData === "disableIPv6") {
            log("Sixornot - PREF_OBSERVER_DNS - disableIPv6 has changed", 1);
            // TODO send message to all UI instances
        }
        if (aData === "ipv4OnlyDomains") {
            log("Sixornot - PREF_OBSERVER_DNS - ipv4OnlyDomains has changed", 1);
            // TODO send message to all UI instances
        }
    },

    register: function () {
        "use strict";
        Services.prefs.addObserver(prefs.dns_prefs, PREF_OBSERVER_DNS, false);
    },

    unregister: function () {
        "use strict";
        Services.prefs.removeObserver(prefs.dns_prefs, PREF_OBSERVER_DNS);
    }
};
