/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2008-2011 Timothy Baldock. All Rights Reserved.
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

/* Portions of this code are based on the Flagfox extension by Dave Garrett.
 * Please see flagfox.net for more information on this extension.
 * */

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MIT/X11 License
 * 
 * Copyright (c) 2011 Finnbarr P. Murphy
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
 * ***** END LICENSE BLOCK ***** */

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
 * Contributor(s):
 *   Erik Vold <erikvvold@gmail.com> (Original Author)
 *   Greg Parris <greg.parris@gmail.com>
 *   Nils Maier <maierman@web.de>
 *
 * ***** END LICENSE BLOCK ***** */


/*
    Constants and global variables
*/
// Import needed code modules
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");

var NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
var BUTTON_ID       = "sixornot-buttonid",
    ADDRESS_BOX_ID  = "sixornot-addressboxid",
    ADDRESS_IMG_ID  = "sixornot-addressimageid",
    TOOLTIP_ID      = "sixornot-tooltipid",
    ADDRESS_MENU_ID = "sixornot-addressmenuid",
    TOOLBAR_MENU_ID = "sixornot-toolbarmenuid",
    PREF_TOOLBAR    = "toolbar",
    PREF_NEXTITEM   = "nextitem";

var PREF_BRANCH_SIXORNOT = Services.prefs.getBranch("extensions.sixornot.");

var PREFS = {
    nextitem:           "bookmarks-menu-button-container",
    toolbar:            "nav-bar",
    showaddressicon:    false,
    use_greyscale:      false
};

var PREF_OBSERVER = {
    observe: function (aSubject, aTopic, aData) {
        log("Sixornot - prefs observer");
        log("aSubject: " + aSubject + ", aTopic: " + aTopic.valueOf() + ", aData: " + aData);
        if (!(aTopic.valueOf() === "nsPref:changed"))
        {
            log("Sixornot - not a pref change event 1");
            return;
        }
        if (!PREFS.hasOwnProperty(aData))
        {
            log("Sixornot - not a pref change event 2");
            return;
        }

        log("Sixornot - prefs observer continues");
        log("Sixornot - aData is: " + aData);
        // If the changed preference is the addressicon one
        if (aData === "showaddressicon")
        {
            log("Sixornot - prefs observer - addressicon has changed");
            // Simply reload all addon's attributes
            reload();
        }
        // If the changed preference is the use_greyscale one
        if (aData === "use_greyscale")
        {
            log("Sixornot - prefs observer - use_greyscale has changed");
            // Simply switch to a different icon set and reload
            set_iconset();
            reload();
        }
    }
}

/*
    ipv6 only                   6only_16.png, 6only_24.png
    ipv4+ipv6 w/ local ipv6     6and4_16.png, 6and4_24.png
    ipv4+ipv6 w/o local ipv6    4pot6_16.png, 4pot6_24.png
    ipv4 only                   4only_16.png, 4only_24.png
    Unknown                     other_16.png, other_24.png
*/
// Colour icons
var s6only_16_c = "", s6and4_16_c = "", s4pot6_16_c = "", s4only_16_c = "", sother_16_c = "",
    s6only_24_c = "", s6and4_24_c = "", s4pot6_24_c = "", s4only_24_c = "", sother_24_c = "",
// Greyscale icons
    s6only_16_g = "", s6and4_16_g = "", s4pot6_16_g = "", s4only_16_g = "", sother_16_g = "",
    s6only_24_g = "", s6and4_24_g = "", s4pot6_24_g = "", s4only_24_g = "", sother_24_g = "",
// Current icons
    s6only_16 = "",   s6and4_16 = "",   s4pot6_16 = "",   s4only_16 = "",   sother_16 = "",
    s6only_24 = "",   s6and4_24 = "",   s4pot6_24 = "",   s4only_24 = "",   sother_24 = "";

(function(global) global.include = function include(src) (
    Services.scriptloader.loadSubScript(src, global)))(this);


/*
    Core functionality
*/
function main (win)
{
    log("Sixornot - main");
    // Set up variables for this instance
    var contentDoc = null;      // Reference to the current page document object
    var url = "";               // The URL of the current page
    var host = "";              // The host name of the current URL
    var ipv4s = [];             // The IP addresses of the current host
    var ipv6s = [];             // The IP addresses of the current host
    var localipv6s = [];        // Local IPv6 addresses
    var localipv4s = [];        // Local IPv4 addresses
    var usingv6 = null;         // True if we can connect to the site using IPv6, false otherwise
    var specialLocation = null;
    var dns_request = null;     // Reference to this window's active DNS lookup request
                                // There can be only one at a time per window
    var pollLoopID = win.setInterval(pollForContentChange, 250);

    let doc = win.document;

    // Add tooltip, iconized button and address bar icon to browser window
    // These are created in their own scope, they need to be found again using their IDs for the current window
    let (tooltip = doc.createElementNS(NS_XUL, "tooltip"),
         toolbarPopupMenu = doc.createElementNS(NS_XUL, "menupopup"),
         toolbarButton = doc.createElementNS(NS_XUL, "toolbarbutton"))
    {
        // Tooltip setup
        tooltip.setAttribute("id", TOOLTIP_ID);
        // Add event listener for tooltip showing (to update tooltip contents dynamically)
        tooltip.addEventListener("popupshowing", update_tooltip_content, false);

        // Menu setup
        toolbarPopupMenu.setAttribute("id", TOOLBAR_MENU_ID);
        toolbarPopupMenu.setAttribute("position", "after_start");
        // Add event listener for popupMenu opening (to update popupMenu contents dynamically)
        toolbarPopupMenu.addEventListener("popupshowing", update_menu_content, false);
        toolbarPopupMenu.addEventListener("command", onMenuCommand, false);

        // Iconized button setup
        toolbarButton.setAttribute("id", BUTTON_ID);
        toolbarButton.setAttribute("label", gt("label"));
        toolbarButton.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional");
        toolbarButton.setAttribute("tooltip", TOOLTIP_ID);
        toolbarButton.setAttribute("type", "menu");
        toolbarButton.setAttribute("orient", "horizontal");

        toolbarButton.style.listStyleImage = "url('" + sother_16 + "')";

        // Menu which the button should open
        toolbarButton.appendChild(toolbarPopupMenu);

        gbi(doc, "navigator-toolbox").palette.appendChild(toolbarButton);

        // Add tooltip to urlbar (has to be added to something)
        gbi(doc, "urlbar-icons").appendChild(tooltip);
 
        // Move to location specified in prefs
        let toolbarId = PREF_BRANCH_SIXORNOT.getCharPref(PREF_TOOLBAR);
        let toolbar = toolbarId && gbi(doc, toolbarId);
        if (toolbar)
        {
            let nextItem = gbi(doc, PREF_BRANCH_SIXORNOT.getCharPref(PREF_NEXTITEM));
            toolbar.insertItem(BUTTON_ID, nextItem && nextItem.parentNode.id === toolbarId && nextItem);
        }

        // Add event listeners
        win.addEventListener("online", onChangedOnlineStatus, false);
        win.addEventListener("offline", onChangedOnlineStatus, false);
        win.addEventListener("aftercustomization", toggle_customise, false);
    }
    // Add address bar icon only if desired by preferences
    if (get_bool_pref("showaddressicon"))
    {
        let (addressPopupMenu = doc.createElementNS(NS_XUL, "menupopup"),
             addressIcon = doc.createElementNS(NS_XUL, "image"),
             addressButton = doc.createElementNS(NS_XUL, "box")) 
        {
            // Menu setup
            addressPopupMenu.setAttribute("id", ADDRESS_MENU_ID);
            addressPopupMenu.setAttribute("position", "after_start");
            // Add event listener for popupMenu opening (to update popupMenu contents dynamically)
            addressPopupMenu.addEventListener("popupshowing", update_menu_content, false);
            addressPopupMenu.addEventListener("command", onMenuCommand, false);

            // Address bar icon setup
            addressButton.setAttribute("id", ADDRESS_BOX_ID);
            addressButton.setAttribute("width", "16");
            addressButton.setAttribute("height", "16");
            addressButton.setAttribute("align", "center");
            addressButton.setAttribute("pack", "center");

            addressIcon.setAttribute("id", ADDRESS_IMG_ID);
            addressIcon.setAttribute("tooltip", TOOLTIP_ID);
            addressIcon.setAttribute("popup", ADDRESS_MENU_ID);
            addressIcon.setAttribute("width", "16");
            addressIcon.setAttribute("height", "16");
            addressIcon.setAttribute("src", sother_16);

            // Position the icon
            let urlbaricons = gbi(doc, "urlbar-icons");
            let starbutton = gbi(doc, "star-button");
            addressButton.appendChild(addressIcon);
            addressButton.appendChild(addressPopupMenu);

            // If star icon visible, insert before it, otherwise just append to urlbaricons
            if (!starbutton)
            {
                urlbaricons.appendChild(addressButton);
            }
            else
            {
                urlbaricons.insertBefore(addressButton, starbutton);
            }
        }
    }

    // Add a callback to our unload list to remove the UI when addon is disabled
    unload(function () {
        log("Sixornot - main:unload");
        // Cancel any active DNS lookups for this window
        dns_handler.cancel_request(dns_request);

        // Get UI elements
        let toolbarButton = gbi(doc, BUTTON_ID) || gbi(gbi(doc, "navigator-toolbox").palette, BUTTON_ID);
        let tooltip = gbi(doc, TOOLTIP_ID);
        let toolbarPopupMenu = gbi(doc, TOOLBAR_MENU_ID);

        // Clear interval
        win.clearInterval(pollLoopID);

        // Clear event handlers
        win.removeEventListener("aftercustomization", toggle_customise, false);
        win.removeEventListener("offline", onChangedOnlineStatus, false);
        win.removeEventListener("online", onChangedOnlineStatus, false);
        tooltip.removeEventListener("popupshowing", update_tooltip_content, false);
        toolbarPopupMenu.removeEventListener("popupshowing", update_menu_content, false);
        toolbarPopupMenu.removeEventListener("command", onMenuCommand, false);

        // Remove UI
        tooltip && tooltip.parentNode.removeChild(tooltip);
        toolbarPopupMenu && toolbarPopupMenu.parentNode.removeChild(toolbarPopupMenu);
        toolbarButton && toolbarButton.parentNode.removeChild(toolbarButton);
    }, win);

    // If we loaded the address bar icon UI, add a callback to remove it on unload
    if (get_bool_pref("showaddressicon"))
    {
        unload(function () {
            log("Sixornot - address bar unload function");
            // Get UI elements
            let addressPopupMenu = gbi(doc, ADDRESS_MENU_ID);
            let addressIcon = gbi(doc, ADDRESS_IMG_ID);
            let addressButton = gbi(doc, ADDRESS_BOX_ID);

            // Clear event handlers
            addressPopupMenu.removeEventListener("popupshowing", update_menu_content, false);
            addressPopupMenu.removeEventListener("command", onMenuCommand, false);

            // Remove UI
            addressPopupMenu && addressPopupMenu.parentNode.removeChild(addressPopupMenu);
            addressIcon && addressIcon.parentNode.removeChild(addressIcon);
            addressButton && addressButton.parentNode.removeChild(addressButton);
        }, win);
    }


    /* Poll for content change to ensure this is updated on all pages including errors */
    function pollForContentChange ()
    {
        log("Sixornot - main:pollForContentChange", 3);
        try
        {
            if (contentDoc !== win.content.document)
            {
                updateState();
            }
        }
        catch (e)
        {
            Components.utils.reportError("Sixornot EXCEPTION: " + parse_exception(e));
        }
    }

    // Updates icon/tooltip etc. state if needed - called by the polling loop
    // TODO - This whole process needs a rethink - needs a better workflow
    function updateState ()
    {
        var addressIcon, toolbarButton, set_icon, onReturnedIPs ;
        log("Sixornot - main:updateState", 2);

        addressIcon = gbi(doc, ADDRESS_IMG_ID);
        toolbarButton = gbi(doc, BUTTON_ID) || gbi(gbi(doc, "navigator-toolbox").palette, BUTTON_ID);

        contentDoc = win.content.document;
        url = contentDoc.location.href;
        host = "";
        ipv6s = [];
        ipv4s = [];
        localipv6s = [];
        localipv4s = [];

        // If we've changed pages before completing a lookup, then abort the old request first
        dns_handler.cancel_request(dns_request);
        dns_request = null;

        // TODO - this is duplicated with the one in update_icon - move out?
        set_icon = function (icon)
        {
            // If this is null, address icon isn't showing
            if (addressIcon !== null)
            {
                addressIcon.src = icon;
            }
            toolbarButton.style.listStyleImage = "url('" + icon + "')";
        };

        // Tries to update icon based on protocol type (e.g. for local pages which don't need to be looked up)
        // If this fails returns false and we need to do lookup
        if (update_icon())
        {
            return;
        }

        // Need to look up host
        try
        {
            host = crop_trailing_char(contentDoc.location.hostname, ".");
        } 
        catch (e)
        {
            log("Sixornot - Unable to look up host");
        }
        if (host === "")
        {
            set_icon(sother_16);
            specialLocation = ["unknownsite"];
            log("Sixornot warning: no host returned for \"" + url + "\"");
            return;
        }

        // Offline mode or otherwise not connected
        if (!win.navigator.onLine)
        {
            set_icon(sother_16);
            specialLocation = ["offlinemode"];
            log("Sixornot is in offline mode");
            return;
        }

        // Proxy in use for DNS; can't do a DNS lookup
        if (dns_handler.is_proxied_dns(url))
        {
            set_icon(sother_16);
            specialLocation = ["nodnserror"];
            log("Sixornot is in proxied mode");
            return;
        }

        onReturnedIPs = function (remoteips)
        {
            var onReturnedLocalIPs;
            log("Sixornot - main:updateState:onReturnedIPs", 2);
            dns_request = null;

            // DNS lookup failed
            // TODO - we should still perform local lookup at this point?
            if (remoteips[0] === "FAIL")
            {
                set_icon(sother_16);
                specialLocation = ["lookuperror"];
                return;
            }

            log("Sixornot - main:updateState:onReturnedIPs - remoteips is: " + remoteips + "; typeof remoteips is: " + typeof remoteips, 2);

            // Parse list of IPs for IPv4/IPv6
            ipv6s = remoteips.filter(dns_handler.is_ip6);
            ipv4s = remoteips.filter(dns_handler.is_ip4);

            log("Sixornot - main:updateState:onReturnedIPs - found remote IP addresses, trying local next", 2);

            // Update our local IP addresses (need these for the update_icon phase, and they ought to be up-to-date)
            // Should do this via an async process to avoid blocking (but getting local IPs should be really quick!)

            onReturnedLocalIPs = function (localips)
            {
                log("Sixornot - main:updateState:onReturnedIPs:onReturnedLocalIPs", 2);
                dns_request = null;

                log("Sixornot - main:updateState:onReturnedIPs:onReturnedLocalIPs - localips is: " + localips + "; typeof localips is: " + typeof localips);
                // Parse list of local IPs for IPv4/IPv6
                localipv6s = localips.filter(function (a) {
                    return dns_handler.is_ip6(a) && dns_handler.typeof_ip6(a) !== "localhost"; });
                localipv4s = localips.filter(function (a) {
                    return dns_handler.is_ip4(a) && dns_handler.typeof_ip4(a) !== "localhost"; });

                log("Sixornot - main:updateState:onReturnedIPs:onReturnedLocalIPs - found local IP addresses");

                // This must now work as we have a valid IP address
                update_icon();
            };

            dns_request = dns_handler.resolve_local_async(onReturnedLocalIPs);

            /* let localips = [];
            try
            {
                localips = dns_handler.resolve_local_async();
            }
            catch (e)
            {
                log("Sixornot - Unable to look up local IP addresses");
                Components.utils.reportError("Sixornot EXCEPTION: " + parse_exception(e));
            } */
        }

        // Ideally just hitting the DNS cache here
        dns_request = dns_handler.resolve_remote_async(host, onReturnedIPs);
    }


    // Update the status icon state (icon & tooltip)
    // Returns true if it's done and false if unknown
    function update_icon ()
    {
        var addressIcon, toolbarButton, loc_options;
        log("Sixornot - main:update_icon", 2);
        addressIcon = gbi(doc, ADDRESS_IMG_ID);
        toolbarButton = gbi(doc, BUTTON_ID) || gbi(gbi(doc, "navigator-toolbox").palette, BUTTON_ID);

        loc_options = ["file:", "data:", "about:", "chrome:", "resource:"];

        log("Sixornot - ipv4s: " + ipv4s + ", ipv6s: " + ipv6s + ", localipv4s: " + localipv4s + ", localipv6s: " + localipv6s + ", ", 2);

        function set_icon (icon)
        {
            log("Sixornot - main:update_icon:set_icon - icon: " + icon, 2);
            // If this is null, address icon isn't showing
            if (addressIcon !== null)
            {
                addressIcon.src = icon;
            }
            toolbarButton.style.listStyleImage = "url('" + icon + "')";
        }

        // For any of these protocols, display "other" icon
        if (loc_options.indexOf(contentDoc.location.protocol) !== -1)
        {
            set_icon(sother_16);
            specialLocation = ["localfile"];
            return true;
        }

        // Unknown host -> still need to look up
        if (host === "")
        {
            return false;
        }

        // Valid URL, valid host etc., ready to update the icon
        if (ipv6s.length === 0)
        {
            // We only have IPv4 addresses for the website
            if (ipv4s.length === 0)
            {
                // No addresses at all, question mark icon
                set_icon(sother_16);
            }
            else
            {
                // v4 only icon
                set_icon(s4only_16);
            }
        }
        else
        {
            // They have at least one IPv6 address
            if (ipv4s.length === 0)
            {
                // They only have IPv6 addresses, v6 only icon
                set_icon(s6only_16);
            }
            else
            {
                // v6 and v4 addresses, depending on possibility of v6 connection display green or yellow
                if (localipv6s.length === 0)
                {
                    // Site has a v6 address, but we do not, so we're probably not using v6 to connect
                    set_icon(s4pot6_16);
                }
                else
                {
                    // If at least one of the IPv6 addresses we have is of the global type show green icon
                    if (localipv6s.map(dns_handler.typeof_ip6).indexOf("global") !== -1)
                    {
                        set_icon(s6and4_16);
                    }
                    // Otherwise show only yellow icon, we may have an IPv6 address but it may not be globally routeable
                    else
                    {
                        set_icon(s4pot6_16);
                    }
                }
            }
        }
        specialLocation = null;
        return true;
    }

    // Called whenever an item on the menu is clicked and bound to each menu item as an event handler
    // Look up appropriate action by ID and perform that action
    function onMenuCommand (evt)
    {
        var commandID, commandString, currentWindow, currentBrowser, toggle;
        log("Sixornot - main:onMenuCommand");

        commandID = evt.target.value.substring(0,5);
        commandString = evt.target.value.substring(5);
        // Actions
        // "prefs" - Open preferences
        // "copyc" - Copy text to clipboard
        // "gotow" - Go to SixOrNot website
        // "taddr" - Show or hide the address bar icon
        if (commandID === "copyc")
        {
            log("Sixornot - main:onMenuCommand - copy to clipboard", 2);
            clipboardHelper.copyString(commandString);
        }
        else if (commandID === "gotow")
        {
            log("Sixornot - main:onMenuCommand - goto web page", 2);
            // Add tab to most recent window, regardless of where this function was called from
            currentWindow = get_current_window();
            currentWindow.focus();
            currentBrowser = currentWindow.getBrowser();
            currentBrowser.selectedTab = currentBrowser.addTab(commandString);
        }
        else if (commandID === "tbool")
        {
            // Toggle address bar icon visibility
            toggle = (evt.target.hasAttribute("checked") && evt.target.getAttribute("checked") === "true");
            log("Sixornot - main:onMenuCommand - set boolean pref value: " + commandString + " to " + toggle, 2);
            PREF_BRANCH_SIXORNOT.setBoolPref(commandString, toggle);
        }
    }

    // Update the contents of the popupMenu whenever it is opened
    // Value of "this" will be the menu (since this is an event handler)
    function update_menu_content (evt)
    {
        var i, popupMenu, add_menu_item, add_toggle_menu_item, add_disabled_menu_item, add_menu_separator, remotestring, localstring;
        log("Sixornot - main:update_menu_content", 2);
        log("Sixornot - ipv4s: " + ipv4s + ", ipv6s: " + ipv6s + ", localipv4s: " + localipv4s + ", localipv6s: " + localipv6s + ", ", 2);
        // Set value so that functions within this one can still access correct value of "this"
        popupMenu = this;

        // Clear previously generated popupMenu, if one exists
        while (popupMenu.firstChild)
        {
            popupMenu.removeChild(popupMenu.firstChild);
        }

        // labelName - displayed on menu item
        // ttText - tooltip for menu item
        // commandID - string of arbitrary data
        //  first 5 characters determine function call
        //  rest of string (if any) is data to use for function call
        add_menu_item = function (labelName, ttText, commandID)
        {
            var menuitem;
            log("Sixornot - main:update_menu_content:add_menu_item: " + labelName + ", " + ttText + ", " + commandID, 2);
            menuitem = doc.createElementNS(NS_XUL, "menuitem");
            menuitem.setAttribute("label", labelName);
            menuitem.setAttribute("tooltiptext", ttText);
            menuitem.setAttribute("value", commandID);
            popupMenu.appendChild(menuitem);
        };
        add_toggle_menu_item = function (labelName, ttText, commandID, initialState)
        {
            var menuitem;
            log("Sixornot - main:update_menu_content:add_toggle_menu_item: " + labelName + ", " + ttText + ", " + commandID + ", " + initialState, 2);
            menuitem = doc.createElementNS(NS_XUL, "menuitem");
            menuitem.setAttribute("label", labelName);
            menuitem.setAttribute("tooltiptext", ttText);
            menuitem.setAttribute("value", commandID);
            menuitem.setAttribute("type", "checkbox");
            menuitem.setAttribute("checked", initialState);
            popupMenu.appendChild(menuitem);
        };
        add_disabled_menu_item = function (labelName)
        {
            var menuitem;
            log("Sixornot - main:update_menu_content:add_disabled_menu_item: " + labelName, 2);
            menuitem = doc.createElementNS(NS_XUL, "menuitem")
            menuitem.setAttribute("label", labelName);
            menuitem.setAttribute("disabled", true);
            popupMenu.appendChild(menuitem);
        };
        add_menu_separator = function ()
        {
            var menuseparator;
            log("Sixornot - main:update_menu_content:add_menu_separator", 2);
            menuseparator = doc.createElementNS(NS_XUL, "menuseparator")
            popupMenu.appendChild(menuseparator);
        };

        if (ipv4s.length !== 0 || ipv6s.length !== 0 || host !== "")
        {
            if (host !== "")
            {
                // If host is an IP address and appears in either array of addresses do not display as hostname
                // (This would occur if the URL contains an IP address rather than a hostname)
                if (ipv4s.indexOf(host) === -1 && ipv6s.indexOf(host) === -1)
                {
                    // Build string containing list of all IP addresses (for copying to clipboard)
                    remotestring = Array.concat([host], ipv6s, ipv4s).join(", ");
                    add_menu_item(host, gt("tt_copydomclip"), "copyc" + remotestring);
                }
                else
                {
                    // In this case there will only ever be one IP address record
                    add_disabled_menu_item(gt("hostnameisip"));
                }
            }
            else
            {
                add_disabled_menu_item(gt("nohostnamefound"));
            }

            for (i = 0; i < ipv6s.length; i++)
            {
                add_menu_item(ipv6s[i], gt("tt_copyip6clip"), "copyc" + ipv6s[i]);
            }
            for (i = 0; i < ipv4s.length; i++)
            {
                add_menu_item(ipv4s[i], gt("tt_copyip4clip"), "copyc" + ipv4s[i]);
            }
        }
        else
        {
            add_disabled_menu_item(gt("noremoteloaded"));
        }

        add_menu_separator();

        // Produce string containing all IP data for copy
        localstring = Array.concat([dnsService.myHostName], localipv6s, localipv4s).join(", ");
        add_menu_item(dnsService.myHostName + " (localhost)",
                      gt("tt_copylocalclip"),
                      "copyc" + localstring);

        for (i = 0; i < localipv6s.length; i++)
        {
            add_menu_item(localipv6s[i], gt("tt_copyip6clip"), "copyc" + localipv6s[i]);
        }
        for (i = 0; i < localipv4s.length; i++)
        {
            add_menu_item(localipv4s[i], gt("tt_copyip4clip"), "copyc" + localipv4s[i]);
        }

        add_menu_separator();

        // Preferences toggle menu items
        add_toggle_menu_item(gt("showaddressicon"),
                             gt("tt_showaddressicon"),
                             "tbool" + "showaddressicon",
                             PREF_BRANCH_SIXORNOT.getBoolPref("showaddressicon"));
        add_toggle_menu_item(gt("usegreyscale"),
                             gt("tt_usegreyscale"),
                             "tbool" + "use_greyscale",
                             PREF_BRANCH_SIXORNOT.getBoolPref("use_greyscale"));

        add_menu_separator();
        add_menu_item(gt("gotowebsite"),
                      gt("tt_gotowebsite"),
                      "gotow" + "http://entropy.me.uk/sixornot/");
    }

    // Update the contents of the tooltip whenever it is shown
    // Value of "this" will be the tooltip (since this is an event handler)
    function update_tooltip_content (evt)
    {
        var tooltip, grid, rows, i, add_tt_title_line, add_tt_labeled_line, v6_italic, v4_italic, extraString, extraLine;
        log("Sixornot - main:update_tooltip_content", 2);
        log("Sixornot - ipv4s: " + ipv4s + ", ipv6s: " + ipv6s + ", localipv4s: " + localipv4s + ", localipv6s: " + localipv6s + ", ", 2);
        tooltip = this;

        // Clear previously generated tooltip, if one exists
        while (tooltip.firstChild)
        {
            tooltip.removeChild(tooltip.firstChild);
        }

        grid = doc.createElement("grid");
        rows = doc.createElement("rows");

        add_tt_title_line = function (labelName)
        {
            var row, label, value;
            log("Sixornot - main:update_tooltip_content:add_tt_title_line - labelName: " + labelName, 2);
            row = doc.createElementNS(NS_XUL, "row");
            label = doc.createElementNS(NS_XUL, "label");
            value = doc.createElementNS(NS_XUL, "label");

            label.setAttribute("value", labelName);
            label.setAttribute("style", "font-weight: bold; text-align: right;");
            row.appendChild(value);
            row.appendChild(label);
            rows.appendChild(row);
        };

        add_tt_labeled_line = function (labelName, lineValue, italic)
        {
            var row, label, value;
            log("Sixornot - main:update_tooltip_content:add_tt_labeled_line - labelName: " + labelName + ", lineValue: " + lineValue + ", italic: " + italic, 2);
            row = doc.createElementNS(NS_XUL, "row");
            label = doc.createElementNS(NS_XUL, "label");
            value = doc.createElementNS(NS_XUL, "label");
            // Set defaults
            labelName = labelName || " ";
            lineValue = lineValue || " ";

            label.setAttribute("value", labelName);
            label.setAttribute("style", "font-weight: bold;");
            value.setAttribute("value", lineValue);
            if (italic)
            {
                value.setAttribute("style", "font-style: italic;");
            }
            row.appendChild(label);
            row.appendChild(value);
            rows.appendChild(row);
        };

        if (ipv4s.length !== 0 || ipv6s.length !== 0 || host !== "")
        {
            add_tt_title_line(gt("header_remote"), "");
        }

        if (host !== "")
        {
            add_tt_labeled_line(gt("prefix_domain"), host);
        }

        // Add IPv6 address(es) to tooltip with special case if only one
        if (ipv6s.length === 1)
        {
            log("Sixornot - ipv6s.length is 1");
            add_tt_labeled_line(gt("prefix_v6_single"), ipv6s[0]);
        }
        else if (ipv6s.length > 1)
        {
            log("Sixornot - ipv6s.length is > 1");
            add_tt_labeled_line(gt("prefix_v6_multi"), ipv6s[0]);
            for (i = 1; i < ipv6s.length; i++)
            {
                add_tt_labeled_line(" ", ipv6s[i]);
            }
        }

        // Add IPv4 address(es) to tooltip with special case if only one
        if (ipv4s.length === 1)
        {
            add_tt_labeled_line(gt("prefix_v4_single"), ipv4s[0]);
        }
        else if (ipv4s.length > 1)
        {
            add_tt_labeled_line(gt("prefix_v4_multi"), ipv4s[0]);
            for (i = 1; i < ipv4s.length; i++)
            {
                add_tt_labeled_line(" ", ipv4s[i]);
            }
        }

        // Add local IP address information if available
        if (localipv4s.length !== 0 || localipv6s.length !== 0)
        {
            add_tt_labeled_line();
            add_tt_title_line(gt("header_local"));
            add_tt_labeled_line(gt("prefix_host"), dnsService.myHostName);
        }

        // Append local IP address information
        v6_italic = function (ip6_address)
        {
            return dns_handler.typeof_ip6(ip6_address) !== "global";
        };
        if (localipv6s.length === 1)
        {
            add_tt_labeled_line(gt("prefix_v6_single"), localipv6s[0], v6_italic(localipv6s[0]));
        }
        else if (localipv6s.length > 1)
        {
            add_tt_labeled_line(gt("prefix_v6_multi"), localipv6s[0], v6_italic(localipv6s[0]));
            for (i = 1; i < localipv6s.length; i++)
            {
                add_tt_labeled_line(" ", localipv6s[i], v6_italic(localipv6s[i]));
            }
        }

        v4_italic = function (ip4_address)
        {
            return ["global", "rfc1918"].indexOf(dns_handler.typeof_ip4(ip4_address)) === -1;
        };
        // Add local IPv4 address(es) to tooltip with special case if only one
        if (localipv4s.length === 1)
        {
            add_tt_labeled_line(gt("prefix_v4_single"), localipv4s[0], v4_italic(localipv4s[0]));
        }
        else if (localipv4s.length > 1)
        {
            add_tt_labeled_line(gt("prefix_v4_multi"), localipv4s[0], v4_italic(localipv4s[0]));
            for (i = 1; i < localipv4s.length; i++)
            {
                add_tt_labeled_line(" ", localipv4s[i], v4_italic(localipv4s[i]));
            }
        }

        // TODO - Replace this with an array mapping/lookup table
        // TODO - If a special location is set no need to do any of the IP address stuff!
        if (specialLocation)
        {
            if (specialLocation[0] === "localfile")
            {
                extraString = gt("other_localfile");
            }
            else if (specialLocation[0] === "lookuperror")
            {
                extraString = gt("other_lookuperror");
            }
            else if (specialLocation[0] === "nodnserror")
            {
                extraString = gt("other_nodnserror");
            }
            else if (specialLocation[0] === "offlinemode")
            {
                extraString = gt("other_offlinemode");
            }

            if (specialLocation[1])
            {
                extraString += " (" + specialLocation[1] + ")";
            }
            extraLine = doc.createElement("label");
            extraLine.setAttribute("value", extraString);
            if (["unknownsite", "lookuperror", "nodnserror", "offlinemode"].indexOf(specialLocation[0]) !== -1)
            {
                extraLine.setAttribute("style", "font-style: italic;");
            }
            rows.appendChild(extraLine);
        }

        grid.appendChild(rows);
        tooltip.appendChild(grid);
    }

    // Online/Offline events can trigger multiple times, reset contentDoc so that the next time the timer fires it'll be updated
    function onChangedOnlineStatus(event)
    {
        contentDoc = null;
    }
}


// Image set is either colour or greyscale
function set_iconset ()
{
    log("Sixornot - set_iconset", 2);
    // If use_greyscale is set to true, load grey icons, otherwise load default set
    if (get_bool_pref("use_greyscale"))
    {
        s6only_16 = s6only_16_g;
        s6and4_16 = s6and4_16_g;
        s4pot6_16 = s4pot6_16_g;
        s4only_16 = s4only_16_g;
        sother_16 = sother_16_g;
        s6only_24 = s6only_24_g;
        s6and4_24 = s6and4_24_g;
        s4pot6_24 = s4pot6_24_g;
        s4only_24 = s4only_24_g;
        sother_24 = sother_24_g;
    }
    else
    {
        s6only_16 = s6only_16_c;
        s6and4_16 = s6and4_16_c;
        s4pot6_16 = s4pot6_16_c;
        s4only_16 = s4only_16_c;
        sother_16 = sother_16_c;
        s6only_24 = s6only_24_c;
        s6and4_24 = s6and4_24_c;
        s4pot6_24 = s4pot6_24_c;
        s4only_24 = s4only_24_c;
        sother_24 = sother_24_c;
    }
}

/*
    bootstrap.js API
*/
function startup (aData, aReason)
{
    var resource, alias;
    log("Sixornot - startup - reason: " + aReason, 0);
    // Set up resource URI alias
    resource = Services.io.getProtocolHandler("resource").QueryInterface(Components.interfaces.nsIResProtocolHandler);
    alias = Services.io.newFileURI(aData.installPath);
    if (!aData.installPath.isDirectory())
    {
        alias = Services.io.newURI("jar:" + alias.spec + "!/", null, null);
    }
    resource.setSubstitution("sixornot", alias);

    AddonManager.getAddonByID(aData.id, function (addon, data)
    {
        var prefs;

        // Include libraries
        log("Sixornot - startup - " + addon.getResourceURI("includes/utils.js").spec);
        log("Sixornot - startup - " + addon.getResourceURI("includes/locale.js").spec);
        include(addon.getResourceURI("includes/utils.js").spec);
        include(addon.getResourceURI("includes/locale.js").spec);

        // Init dns_handler
        dns_handler.init();

        // Run dns_handler tests
        dns_handler.test_normalise_ip6();
        dns_handler.test_typeof_ip6();
        dns_handler.test_is_ip6();

        log("Sixornot - startup - initLocalisation...");
        initLocalisation(addon, "sixornot.properties");

        // Load image sets
        log("Sixornot - startup - loading image sets...");
        // Greyscale
        s6only_16_g = addon.getResourceURI("images/6only_g_16.png").spec;
        s6and4_16_g = addon.getResourceURI("images/6and4_g_16.png").spec;
        s4pot6_16_g = addon.getResourceURI("images/4pot6_g_16.png").spec;
        s4only_16_g = addon.getResourceURI("images/4only_g_16.png").spec;
        sother_16_g = addon.getResourceURI("images/other_g_16.png").spec;
        s6only_24_g = addon.getResourceURI("images/6only_g_24.png").spec;
        s6and4_24_g = addon.getResourceURI("images/6and4_g_24.png").spec;
        s4pot6_24_g = addon.getResourceURI("images/4pot6_g_24.png").spec;
        s4only_24_g = addon.getResourceURI("images/4only_g_24.png").spec;
        sother_24_g = addon.getResourceURI("images/other_g_24.png").spec;
        // Colour
        s6only_16_c = addon.getResourceURI("images/6only_c_16.png").spec;
        s6and4_16_c = addon.getResourceURI("images/6and4_c_16.png").spec;
        s4pot6_16_c = addon.getResourceURI("images/4pot6_c_16.png").spec;
        s4only_16_c = addon.getResourceURI("images/4only_c_16.png").spec;
        sother_16_c = addon.getResourceURI("images/other_c_16.png").spec;
        s6only_24_c = addon.getResourceURI("images/6only_c_24.png").spec;
        s6and4_24_c = addon.getResourceURI("images/6and4_c_24.png").spec;
        s4pot6_24_c = addon.getResourceURI("images/4pot6_c_24.png").spec;
        s4only_24_c = addon.getResourceURI("images/4only_c_24.png").spec;
        sother_24_c = addon.getResourceURI("images/other_c_24.png").spec;

        // Set active image set
        log("Sixornot - startup - setting active image set...");
        set_iconset();

        // Load into existing windows and set callback to load into any new ones too
        log("Sixornot - startup - loading into windows...");
        watchWindows(main);

        log("Sixornot - startup - setting up prefs observer...");
        prefs = PREF_BRANCH_SIXORNOT;
        prefs = prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
        prefs.addObserver("", PREF_OBSERVER, false);

    });
}

// Reload addon in all windows, e.g. when preferences change
function reload ()
{
    log("Sixornot - reload", 1);
    unload();
    watchWindows(main);
}

function shutdown (aData, aReason)
{
    var prefs, resource;
    log("Sixornot - shutdown - reason: " + aReason, 0);

    if (aReason !== APP_SHUTDOWN)
    {
        // Unload all UI via init-time unload() callbacks
        unload();
        
        // Shutdown dns_handler
        dns_handler.shutdown();

        prefs = PREF_BRANCH_SIXORNOT;
        prefs = prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
        prefs.removeObserver("", PREF_OBSERVER);

        resource = Services.io.getProtocolHandler("resource").QueryInterface(Components.interfaces.nsIResProtocolHandler);
        resource.setSubstitution("sixornot", null);
    }
}

function install (aData, aReason)
{
    log("Sixornot - install - reason: " + aReason, 0);
    set_initial_prefs();
}

function uninstall (aData, aReason)
{
    log("Sixornot - uninstall - reason: " + aReason, 0);
    // TODO If this is due to an upgrade then don't delete preferences?
    // Some kind of upgrade function to potentially upgrade preference settings may be required
    PREF_BRANCH_SIXORNOT.deleteBranch("");             
}


/*
    Utility functions
*/

// Update preference which determines location of button when loading into new windows
function toggle_customise (evt)
{
    var toolbox, button, b_parent;
    log("Sixornot - toggle_customise");
    toolbox = evt.target, toolbarId, nextItemId;
    button = gbi(toolbox.parentNode, BUTTON_ID);
    if (button)
    {
        b_parent = button.parentNode, nextItem = button.nextSibling;
        if (b_parent && b_parent.localName === "toolbar")
        {
            toolbarId = b_parent.id;
            nextItemId = nextItem && nextItem.id;
        }
    }
    PREF_BRANCH_SIXORNOT.setCharPref(PREF_TOOLBAR,  toolbarId || "");
    PREF_BRANCH_SIXORNOT.setCharPref(PREF_NEXTITEM, nextItemId || "");
}

// Return boolean preference value, either from prefs store or from internal defaults
function get_bool_pref (name)
{
    log("Sixornot - get_bool_pref - name: " + name, 2);
    try
    {
        return PREF_BRANCH_SIXORNOT.getBoolPref(name);
    }
    catch (e)
    {
        log("Sixornot - get_bool_pref error - " + e, 0);
    }
    if (PREFS.hasOwnProperty(name))
    {
        log("Sixornot - get_bool_pref returning PREFS[name] : " + PREFS[name], 2);
        return PREFS[name]
    }
    else
    {
        log("Sixornot - get_bool_pref error - No default preference value for requested preference: " + name, 0);
    }
}

// Return the current browser window
function get_current_window ()
{
    return Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator)
                     .getMostRecentWindow("navigator:browser");
}

// Proxy to getElementById
function gbi (node, child_id)
{
    log("Sixornot - gbi - node: " + node + ", child_id: " + child_id, 2);
    if (node.getElementById)
    {
        return node.getElementById(child_id);
    }
    else
    {
        return node.querySelector("#" + child_id);
    }
}

// Set up initial values for preferences
function set_initial_prefs ()
{
    var branch, key, val;
    log("Sixornot - set_initial_prefs", 2);
    branch = PREF_BRANCH_SIXORNOT;
    for ([key, val] in Iterator(PREFS))
    {
        if (typeof val === "boolean")
        {
            branch.setBoolPref(key, val);
        }
        else if (typeof val === "number")
        {
            branch.setIntPref(key, val);
        }
        else if (typeof val === "string")
        {
            branch.setCharPref(key, val);
        }
    }
}

// Returns a string version of an exception object with its stack trace
function parse_exception (e)
{
    log("Sixornot - parse_exception", 2);
    if (!e)
    {
        return "";
    }
    else if (!e.stack)
    {
        return String(e);
    }
    else
    {
        return String(e) + " \n" + e.stack;
    }
}

// String modification
/* function truncateBeforeFirstChar (str, character)
{
    var pos;
    pos = str.indexOf(character);
    return (pos !== -1) ? str.substring(0, pos) : str.valueOf();
}
function truncateAfterLastChar (str, character)
{
    var pos;
    pos = str.lastIndexOf(character);
    return (pos !== -1) ? str.substring(pos + 1) : str.valueOf();
} */
function crop_trailing_char (str, character)
{
    return (str.charAt(str.length - 1) === character) ? str.slice(0, str.length - 1) : str.valueOf();
}


// Lazy getter services
function defineLazyGetter (getterName, getterFunction)
{
    this.__defineGetter__(getterName, function ()
        {
            delete this[getterName];
            return this[getterName] = getterFunction.apply(this);
        }
    );
}

defineLazyGetter("consoleService", function () {
    return Components.classes["@mozilla.org/consoleservice;1"]
                    .getService(Components.interfaces.nsIConsoleService);
});
defineLazyGetter("ioService", function () {
    return Components.classes["@mozilla.org/network/io-service;1"]
                    .getService(Components.interfaces.nsIIOService);
});
defineLazyGetter("proxyService", function () {
    return Components.classes["@mozilla.org/network/protocol-proxy-service;1"]
                    .getService(Components.interfaces.nsIProtocolProxyService);
});
defineLazyGetter("dnsService", function () {
    return Components.classes["@mozilla.org/network/dns-service;1"]
                    .getService(Components.interfaces.nsIDNSService);
});
defineLazyGetter("clipboardHelper", function () {
    return Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                    .getService(Components.interfaces.nsIClipboardHelper);
});
defineLazyGetter("workerFactory", function () {
    return Components.classes["@mozilla.org/threads/workerfactory;1"]
                    .createInstance(Components.interfaces.nsIWorkerFactory);
});
defineLazyGetter("threadManager", function() {
    return Components.classes["@mozilla.org/thread-manager;1"]
                     .getService(Components.interfaces.nsIThreadManager);
});

// Log a message to error console, but only if it is important enough
function log (message, level)
{
    // Three log levels, 0 = critical, 1 = normal, 2 = verbose
    // Default level is 1
    level = level || 1;
    // If preference unset, default to 1 (normal) level
    if (level <= 1)
    {
        consoleService.logStringMessage(message);
    }
}


// The DNS Handler which does most of the work of the extension
var dns_handler =
{
    remote_ctypes: false,
    local_ctypes: false,

    callback_ids: [],
    next_callback_id: 0,

    worker: null,


    /*
        Startup/shutdown functions for dns_handler - call init before using!
    */
    init : function ()
    {
        var self;
        log("Sixornot - dns_handler - init", 1);

        // Initialise ChromeWorker which will be used to do DNS lookups either via ctypes or dnsService
        this.worker = workerFactory.newChromeWorker("resource://sixornot/includes/dns_worker.js");

        // Shim to get 'this' to refer to dns_handler, not the
        // worker, when a message is received.
        self = this;
        this.worker.onmessage = function (evt) {
            self.onworkermessage.call(self, evt);
        };

        // Check whether to use ctypes methods for remote hosts
        this.worker.postMessage([-1, 3, null]);
        // Check whether to use ctypes methods for local hosts
        this.worker.postMessage([-1, 4, null]);

        // Set up request map, which will map async requests to their callbacks
        this.callback_ids = [];
        this.next_callback_id = 0;
        // Every time a request is processed its callback is added to the callback_ids
        // When a request is completed the callback_ids can be queried to find the correct callback to call
    },

    shutdown : function ()
    {
        log("Sixornot - dns_handler:shutdown", 1);
        // Shutdown async resolver
        this.worker.postMessage([-1, 0, null]);
    },


    /*
        IP Address utility functions
    */
    validate_ip4 : function (ip_address)
    {
        log("Sixornot - dns_handler:validate_ip4: " + ip_address, 2);
        // TODO - Write this function if needed, extensive validation of IPv4 address
        return false;
    },

    // Quick check for address family, not a validator (see validate_ip4)
    is_ip4 : function (ip_address)
    {
        log("Sixornot - dns_handler:is_ip4 " + ip_address, 2);
        return (ip_address.indexOf(".") !== -1 && ip_address.indexOf(":") === -1);
    },

    // Return the type of an IPv6 address
    /*
        -- For IPv4 addresses types are (from RFC 3330) --

        Address Block             Present Use                       Reference
        ---------------------------------------------------------------------
        0.0.0.0/8            "This" Network                 [RFC1700, page 4]
        10.0.0.0/8           Private-Use Networks                   [RFC1918]
        14.0.0.0/8           Public-Data Networks         [RFC1700, page 181]
        24.0.0.0/8           Cable Television Networks                    --
        39.0.0.0/8           Reserved but subject
                               to allocation                       [RFC1797]
        127.0.0.0/8          Loopback                       [RFC1700, page 5]
        128.0.0.0/16         Reserved but subject
                               to allocation                             --
        169.254.0.0/16       Link Local                                   --
        172.16.0.0/12        Private-Use Networks                   [RFC1918]
        191.255.0.0/16       Reserved but subject
                               to allocation                             --
        192.0.0.0/24         Reserved but subject
                               to allocation                             --
        192.0.2.0/24         Test-Net
        192.88.99.0/24       6to4 Relay Anycast                     [RFC3068]
        192.168.0.0/16       Private-Use Networks                   [RFC1918]
        198.18.0.0/15        Network Interconnect
                               Device Benchmark Testing            [RFC2544]
        223.255.255.0/24     Reserved but subject
                               to allocation                             --
        224.0.0.0/4          Multicast                              [RFC3171]
        240.0.0.0/4          Reserved for Future Use        [RFC1700, page 4]

        route           0.0.0.0/8                                   Starts with 0
        local           127.0.0.0/24                                Starts with 127
        rfc1918         10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16   Starts with 10, 172.16-31, 192.168
        linklocal       169.254.0.0/16                              Starts with 169.254
        reserved        240.0.0.0/4                                 Starts with 240-255
        documentation   192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24   Starts with 192.0.2, 198.51.100, 203.0.113
        6to4relay       192.88.99.0/24                              Starts with 192.88.99
        benchmark       198.18.0.0/15                               Starts with 198.18, 198.19
        multicast       224.0.0.0/4                                 Starts with 224-239
    */
    typeof_ip4 : function (ip_address)
    {
        var split_address;
        log("Sixornot - dns_handler:typeof_ip4 " + ip_address, 2);
        // TODO - Function in_subnet (network, subnetmask, ip) to check if specified IP is in the specified subnet range
        if (!dns_handler.is_ip4(ip_address))
        {
            return false;
        }
        split_address = ip_address.split(".").map(Number);
        if (split_address[0] === 0)
        {
            return "route";
        }
        else if (split_address[0] === 127)
        {
            return "localhost";
        }
        else if (split_address[0] === 10
             || (split_address[0] === 172 && split_address[1] >= 16 && split_address[1] <= 31)
             || (split_address[0] === 192 && split_address[1] === 168))
        {
            return "rfc1918";
        }
        else if (split_address[0] === 169 && split_address[1] === 254)
        {
            return "linklocal";
        }
        else if (split_address[0] >= 240)
        {
            return "reserved";
        }
        else if ((split_address[0] === 192 && split_address[1] === 0  && split_address[2] === 2)
              || (split_address[0] === 198 && split_address[1] === 51 && split_address[2] === 100)
              || (split_address[0] === 203 && split_address[1] === 0  && split_address[2] === 113))
        {
            return "documentation";
        }
        else if (split_address[0] === 192 && split_address[1] === 88 && split_address[2] === 99)
        {
            return "6to4relay";
        }
        else if (split_address[0] === 198 && [18,19].indexOf(split_address[1]) !== -1)
        {
            return "benchmark";
        }
        else if (split_address[0] >= 224 && split_address[0] <= 239)
        {
            return "multicast";
        }
        else
        {
            return "global";
        }
    },

    test_is_ip6 : function ()
    {
        var overall, tests, i, result;
        overall = true;
        tests = [
                        ["::",                                      true],
                        ["::1",                                     true],
                        ["fe80::fa22:22ff:fee8:2222",               true],
                        ["fc00::",                                  true],
                        ["ff00:1234:5678:9abc:def0:d:ee:fff",       true],
                        ["2:0::1:2",                                true],
                        ["2001:8b1:1fe4:1::2222",                   true],
                        ["2001:08b1:1fe4:0001:0000:0000:0000:2222", true],
                        ["192.168.2.1",                             false],
                        ["blah",                                    false],
                        [":::",                                     false],
                        [":",                                       false],
                        ["1::2::3",                                 false]
                    ];
        for (i = 0; i < tests.length; i++)
        {
            result = this.is_ip6(tests[i][0]);
            if (result === tests[i][1])
            {
                log("Sixornot - test_is_ip6, passed test value: " + tests[i][0] + ", result: " + result);
            }
            else
            {
                log("Sixornot - test_is_ip6, failed test value: " + tests[i][0] + ", expected result: " + tests[i][1] + ", actual result: " + result);
                overall = false;
            }
        }
        return overall;
    },

    validate_ip6 : function (ip_address)
    {
        log("Sixornot - dns_handler:validate_ip6: " + ip_address, 2);
        // TODO - Write this function if needed, extensive validation of IPv6 address
        return false;
    },

    // Quick check for address family, not a validator (see validate_ip6)
    is_ip6 : function (ip_address)
    {
        log("Sixornot - dns_handler:is_ip6: " + ip_address, 2);
        return (ip_address.indexOf(":") !== -1);
    },

    test_normalise_ip6 : function ()
    {
        var overall, tests, i, result;
        overall = true;
        tests = [
                        ["::",                                      "0000:0000:0000:0000:0000:0000:0000:0000"],
                        ["::1",                                     "0000:0000:0000:0000:0000:0000:0000:0001"],
                        ["fe80::fa22:22ff:fee8:2222",               "fe80:0000:0000:0000:fa22:22ff:fee8:2222"],
                        ["fc00::",                                  "fc00:0000:0000:0000:0000:0000:0000:0000"],
                        ["ff00:1234:5678:9abc:def0:d:ee:fff",       "ff00:1234:5678:9abc:def0:000d:00ee:0fff"],
                        ["2:0::1:2",                                "0002:0000:0000:0000:0000:0000:0001:0002"],
                        ["2001:8b1:1fe4:1::2222",                   "2001:08b1:1fe4:0001:0000:0000:0000:2222"],
                        ["2001:08b1:1fe4:0001:0000:0000:0000:2222", "2001:08b1:1fe4:0001:0000:0000:0000:2222"],
                        ["fe80::fa1e:dfff:fee8:db18%en1",           "fe80:0000:0000:0000:fa1e:dfff:fee8:db18"]
                    ];
        for (i = 0; i < tests.length; i++)
        {
            result = this.normalise_ip6(tests[i][0]);
            if (result === tests[i][1])
            {
                log("Sixornot - test_normalise_ip6, passed test value: " + tests[i][0] + ", result: " + result, 1);
            }
            else
            {
                log("Sixornot - test_normalise_ip6, failed test value: " + tests[i][0] + ", expected result: " + tests[i][1] + ", actual result: " + result, 1);
                overall = false;
            }
        }
        return overall;
    },

    // Expand IPv6 address into long version
    normalise_ip6 : function (ip6_address)
    {
        var sides, left_parts, right_parts, middle, outarray, pad_left;
        log("Sixornot - dns_handler:normalise_ip6: " + ip6_address, 2);
        // Split by instances of ::
        sides = ip6_address.split("::");
        // Split remaining sections by instances of :
        left_parts = sides[0].split(":");
        right_parts = (sides[1] && sides[1].split(":")) || [];

        middle = ["0", "0", "0", "0", "0", "0", "0", "0"].slice(0, 8 - left_parts.length - right_parts.length);
        outarray = Array.concat(left_parts, middle, right_parts);

        // Pad each component to 4 char length with zeros to left (and convert to lowercase)
        pad_left = function (str)
        {
            return ("0000" + str).slice(-4);
        };

        return outarray.map(pad_left).join(":").toLowerCase();
    },

    // Unit test suite for typeof_ip6 function, returns false if a test fails
    test_typeof_ip6 : function ()
    {
        var overall, tests, i, result;
        overall = true;
        tests = [
                        ["::", "unspecified"],
                        ["::1", "localhost"],
                        ["fe80::fa22:22ff:fee8:2222", "linklocal"],
                        ["fec0::ffff:fa22:22ff:fee8:2222", "sitelocal"],
                        ["fc00::1", "uniquelocal"],
                        ["ff00::1", "multicast"],
                        ["2002::1", "6to4"],
                        ["2001:0000::1", "teredo"],
                        ["2001:8b1:1fe4:1::2222", "global"],
                        ["192.168.2.1", false],
                        ["blah", false],
                        [":", false],
                        ["...", false]
                    ];
        for (i = 0; i < tests.length; i++)
        {
            result = this.typeof_ip6(tests[i][0]);
            if (result === tests[i][1])
            {
                log("Sixornot - test_typeof_ip6, passed test value: " + tests[i][0] + ", result: " + result);
            }
            else
            {
                log("Sixornot - test_typeof_ip6, failed test value: " + tests[i][0] + ", expected result: " + i[1] + ", actual result: " + result);
                overall = false;
            }
        }
        return overall;
    },

    // Return the type of an IPv6 address
    /*
        -- For IPv6 addresses types are: --
        unspecified     ::/128                                          All zeros
        local           ::1/128         0000:0000:0000:0000:0000:0000:0000:0001
        linklocal       fe80::/10                                       Starts with fe8, fe9, fea, feb
        sitelocal       fec0::/10   (deprecated)                        Starts with fec, fed, fee, fef
        uniquelocal     fc00::/7    (similar to RFC1918 addresses)      Starts with: fc or fd
        pdmulticast     ff00::/8                                        Starts with ff
        v4transition    ::ffff:0:0/96 (IPv4-mapped)                     Starts with 0000:0000:0000:0000:0000:ffff
                        ::ffff:0:0:0/96 (Stateless IP/ICMP Translation) Starts with 0000:0000:0000:0000:ffff:0000
                        0064:ff9b::/96 ("Well-Known" prefix)            Starts with 0064:ff9b:0000:0000:0000:0000
        6to4            2002::/16                                       Starts with 2002
        teredo          2001::/32                                       Starts with 2001:0000
        benchmark       2001:2::/48                                     Starts with 2001:0002:0000
        documentation   2001:db8::/32                                   Starts with 2001:0db8
    */
    typeof_ip6 : function (ip_address)
    {
        var norm_address;
        log("Sixornot - dns_handler:typeof_ip6: " + ip_address, 2);
        // 1. Check IP version, return false if v4
        if (!dns_handler.is_ip6(ip_address))
        {
            return false;
        }
        // 2. Normalise address, return false if normalisation fails
        norm_address = dns_handler.normalise_ip6(ip_address);
        // 3. Compare against type patterns
        if (norm_address === "0000:0000:0000:0000:0000:0000:0000:0000")
        {
            return "unspecified";
        }
        if (norm_address === "0000:0000:0000:0000:0000:0000:0000:0001")
        {
            return "localhost";
        }
        if (["fe8", "fe9", "fea", "feb"].indexOf(norm_address.substr(0, 3)) !== -1)
        {
            return "linklocal";
        }
        if (["fec", "fed", "fee", "fef"].indexOf(norm_address.substr(0, 3)) !== -1)
        {
            return "sitelocal";
        }
        if (["fc", "fd"].indexOf(norm_address.substr(0, 2)) !== -1)
        {
            return "uniquelocal";
        }
        if (["ff"].indexOf(norm_address.substr(0, 2)) !== -1)
        {
            return "multicast";
        }
        if (["2002"].indexOf(norm_address.substr(0, 4)) !== -1)
        {
            return "6to4";
        }
        if (["2001:0000"].indexOf(norm_address.substr(0, 9)) !== -1)
        {
            return "teredo";
        }
        // If no other type then address is global
        return "global";
    },


    /*
        Finding local IP address(es)
    */
    // Return the IP address(es) of the local host
    resolve_local_async : function (callback)
    {
        log("Sixornot - dns_handler:resolve_local_async");
        if (this.local_ctypes)
        {
            // If remote resolution is happening via ctypes...
            return this._local_ctypes_async(callback);
        }
        else
        {
            // Else if using firefox methods
            return this._local_firefox_async(callback);
        }
    },

    _local_ctypes_async : function (callback)
    {
        var new_callback_id;
        log("Sixornot - dns_handler:_local_ctypes_async - selecting resolver for local host lookup", 2);
        // This uses dns_worker to do the work asynchronously

        new_callback_id = this.add_callback_id(callback);

        this.worker.postMessage([new_callback_id, 2, null]);

        return this.make_cancel_obj(new_callback_id);
    },

    // Proxy to _remote_firefox_async since it does much the same thing
    _local_firefox_async : function (callback)
    {
        log("Sixornot - dns_handler:_local_firefox_async - resolving local host using Firefox builtin method", 2);
        return this._remote_firefox_async(dnsService.myHostName, callback);
    },


    /*
        Finding remote IP address(es)
    */
    // Resolve IP address(es) of a remote host using DNS
    resolve_remote_async : function (host, callback)
    {
        log("Sixornot - dns_handler:resolve_remote_async - host: " + host + ", callback: " + callback, 2);
        if (this.remote_ctypes)
        {
            // If remote resolution is happening via ctypes...
            return this._remote_ctypes_async(host, callback);
        }
        else
        {
            // Else if using firefox methods
            return this._remote_firefox_async(host, callback);
        }
    },

    _remote_ctypes_async : function (host, callback)
    {
        var new_callback_id;
        log("Sixornot - dns_handler:_remote_ctypes_async - host: " + host + ", callback: " + callback, 2);
        // This uses dns_worker to do the work asynchronously

        new_callback_id = this.add_callback_id(callback);

        this.worker.postMessage([new_callback_id, 1, host]);

        return this.make_cancel_obj(new_callback_id);
    },

    _remote_firefox_async : function (host, callback)
    {
        var my_callback;
        log("Sixornot - dns_handler:_remote_firefox_async - host: " + host + ", callback: " + callback, 2);

        my_callback =
        {
            onLookupComplete : function (nsrequest, dnsresponse, nsstatus)
            {
                var ip_addresses;
                // Request has been cancelled - ignore
                if (nsstatus === Components.results.NS_ERROR_ABORT)
                {
                    return;
                }
                // Request has failed for some reason
                if (nsstatus !== 0 || !dnsresponse || !dnsresponse.hasMore())
                {
                    if (nsstatus === Components.results.NS_ERROR_UNKNOWN_HOST)
                    {
                        log("Sixornot - dns_handler:_remote_firefox_async - resolve host failed, unknown host", 1);
                        callback(["FAIL"]);
                    }
                    else
                    {
                        log("Sixornot - dns_handler:_remote_firefox_async - resolve host failed, status: " + nsstatus, 1);
                        callback(["FAIL"]);
                    }
                    // Address was not found in DNS for some reason
                    return;  
                }
                // Otherwise address was found
                ip_addresses = [];
                while (dnsresponse.hasMore())
                {
                    ip_addresses.push(dnsresponse.getNextAddrAsString());
                }
                // Call callback for this request with ip_addresses array as argument
                callback(ip_addresses);
            }
        };
        try
        {
            return dnsService.asyncResolve(host, 0, my_callback, threadManager.currentThread);
        }
        catch (e)
        {
            Components.utils.reportError("Sixornot EXCEPTION: " + parse_exception(e));
            callback(["FAIL"]);
            return null;
        }
    },


    /*
        ctypes dns callback handling functions
    */
    // Index this.callback_ids and return required callback
    find_callback_by_id : function (callback_id)
    {
        var f;
        log("Sixornot - dns_handler:find_callback_by_id - callback_id: " + callback_id, 2);
        // Callback IDs is an array of 2-item arrays - [ID, callback]
        f = function (a)
        {
            return a[0];
        };
        // Returns -1 if ID not found
        return this.callback_ids.map(f).indexOf(callback_id);
    },

    // Search this.callback_ids for the ID in question, remove it if it exists
    remove_callback_id : function (callback_id)
    {
        var i;
        log("Sixornot - dns_handler:remove_callback_id - callback_id: " + callback_id, 2);
        i = this.find_callback_by_id(callback_id);
        if (i !== -1)
        {
            // Return the callback function
            return this.callback_ids.splice(i, 1)[0][1];
        }
        // If ID not found, return false
        return false;
    },

    // Add a callback to the callback_ids array with the next available ID
    add_callback_id : function (callback)
    {
        log("Sixornot - dns_handler:add_callback_id - callback: " + callback, 2);
        // Use next available callback ID, return that ID
        this.next_callback_id = this.next_callback_id + 1;
        this.callback_ids.push([this.next_callback_id, callback]);
        return this.next_callback_id;
    },

    make_cancel_obj : function (callback_id)
    {
        var obj;
        log("Sixornot - dns_handler:make_cancel_obj - callback_id: " + callback_id, 2);
        obj =
        {
            cancel : function ()
            {
                // Remove ID from callback_ids if it exists there
                dns_handler.remove_callback_id(callback_id);
            }
        };
        return obj;
    },


    /*
        Recieve and act on messages from Worker
    */
    // Called by worker to pass information back to main thread
    onworkermessage : function (evt)
    {
        var callback;
        log("Sixornot - dns_handler:onworkermessage - message: " + evt.data, 2);
        // evt.data is the information passed back
        // This is an array: [callback_id, request_id, data]
        // data will usually be a list of IP addresses
        // Look up correct callback in callback_ids array

        // checkremote, set remote ctypes status
        if (evt.data[1] === 3)
        {
            this.remote_ctypes = evt.data[2];
        }
        // checklocal, set local ctypes status
        else if (evt.data[1] === 4)
        {
            this.local_ctypes = evt.data[2];
        }
        // remotelookup/locallookup, find correct callback and call it
        else if (evt.data[1] === 1 || evt.data[1] === 2)
        {
            callback = this.remove_callback_id(evt.data[0]);
            log("Sixornot - dns_handler:onworkermessage, typeof callback: " + typeof callback, 1);
            // Execute callback
            if (callback)
            {
                callback(evt.data[2]);
            }
        }
    },


    /*
        Misc.
    */

    // Cancels an active ctypes DNS lookup request currently being actioned by Worker
    cancel_request : function (request)
    {
        log("Sixornot - dns_handler:cancel_request - request: " + request, 2);
        try
        {
            // This function can be called with request as a null or undefined value
            if (request)
            {
                request.cancel(Components.results.NS_ERROR_ABORT);
            }
        }
        catch (e)
        {
            Components.utils.reportError("Sixornot EXCEPTION: " + parse_exception(e));
        }
    },

    // Returns true if the URL is set to have its DNS lookup proxied via SOCKS
    is_proxied_dns : function (url)
    {
        var uri, proxyinfo;
        log("Sixornot - dns_handler:is_proxied_dns - url: " + url, 2);
        uri = ioService.newURI(url, null, null);
        // Finds proxy (shouldn't block thread; we already did this lookup to load the page)
        proxyinfo = proxyService.resolve(uri, 0);
        // "network.proxy.socks_remote_dns" pref must be set to true for Firefox to set TRANSPARENT_PROXY_RESOLVES_HOST flag when applicable
        return (proxyinfo !== null) && (proxyinfo.flags & proxyinfo.TRANSPARENT_PROXY_RESOLVES_HOST);
    }

/*
    // Convert a base10 representation of a number into a base16 one (zero-padded to two characters, input number less than 256)
    to_hex : function (int_string)
    {
        var hex;
        hex = Number(int_string).toString(16);
        if (hex.length < 2)
        {
            hex = "0" + hex;
        }
        return hex;
    },

    // Ensure decimal number has no spaces etc.
    to_decimal : function (int_string)
    {
        return Number(int_string).toString(10);
    },
*/
};



