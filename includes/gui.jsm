/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2014-2015 Timothy Baldock. All Rights Reserved.
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
/*global Components, Services, ChromeWorker */

// Provided by Sixornot
/*global gt, log, parse_exception, stylesheet, createAddressBarIcon */

/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/CustomizableUI.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/locale.jsm");
Components.utils.import("resource://sixornot/includes/stylesheet.jsm");
Components.utils.import("resource://sixornot/includes/widget.jsm");
Components.utils.import("resource://sixornot/includes/addressbaricon.jsm");
/*jslint es5: false */

var EXPORTED_SYMBOLS = [ "ui" ];

const ADDRESSBAR_ICON_ID = "sixornot-addressbaricon";
const BUTTON_ID          = "sixornot-button";

/* Create button widget specification for CustomizableUI */
var createButton = function () {
    return {
        id : BUTTON_ID,
        type : "button",
        defaultArea : CustomizableUI.AREA_NAVBAR,
        label : gt("label"),
        tooltiptext : gt("tt_button"),
        onCreated : function (node) {
            var win = node.ownerDocument.defaultView;
            log("button UI created", 2);
            createWidget(node, win);
        }
    };
};

var ui = {
    /* Call once at addon startup */
    setup: function () {
        log("ui.setup", 1);
        CustomizableUI.createWidget(createButton());
    },
    /* Call once for each window of the browser */
    insert: function (win) {
        // Don't insert into windows that already have UI
        if (win.document.getElementById(ADDRESSBAR_ICON_ID)) {
            log("ui.insert: skipping window - UI already exists", 1);
            return;
        }

        // Add stylesheets
        stylesheet.inject_into_window_with_unload(win, stylesheet.sheets.base);
        stylesheet.inject_into_window_with_unload(win, stylesheet.sheets.customize);

        // Create address bar icon
        createAddressBarIcon(win, ADDRESSBAR_ICON_ID);
    },
    teardown: function () {
        log("ui.teardown", 1);
        CustomizableUI.destroyWidget(BUTTON_ID);
    }
};
