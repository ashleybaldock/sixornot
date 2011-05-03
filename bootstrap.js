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
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const BUTTON_ID     = "sixornot-buttonid",
      ADDRESS_BOX_ID = "sixornot-addressboxid",
      ADDRESS_IMG_ID = "sixornot-addressimageid",
      TOOLTIP_ID = "sixornot-tooltipid",
      ADDRESS_MENU_ID = "sixornot-addressmenuid",
      TOOLBAR_MENU_ID = "sixornot-toolbarmenuid",
      PREF_TOOLBAR  = "toolbar",
      PREF_NEXTITEM = "nextitem";

const PREF_BRANCH_SIXORNOT = Services.prefs.getBranch("extensions.sixornot.");

const PREFS = {
    nextitem:           "bookmarks-menu-button-container",
    toolbar:            "nav-bar",
    showaddressicon:    false,
    use_greyscale:      false
};

let PREF_OBSERVER = {
    observe: function (aSubject, aTopic, aData) {
        consoleService.logStringMessage("Sixornot - prefs observer");
        consoleService.logStringMessage("aSubject: " + aSubject + ", aTopic: " + aTopic.valueOf() + ", aData: " + aData);
        if (!(aTopic.valueOf() === "nsPref:changed"))
        {
            consoleService.logStringMessage("Sixornot - not a pref change event 1");
            return;
        }
        if (!PREFS.hasOwnProperty(aData))
        {
            consoleService.logStringMessage("Sixornot - not a pref change event 2");
            return;
        }

        consoleService.logStringMessage("Sixornot - prefs observer continues");
        consoleService.logStringMessage("Sixornot - aData is: " + aData);
        // If the changed preference is the addressicon one
        if (aData === "showaddressicon")
        {
            consoleService.logStringMessage("Sixornot - prefs observer - addressicon has changed");
            // Simply reload all addon's attributes
            reload();
        }
        // If the changed preference is the use_greyscale one
        if (aData === "use_greyscale")
        {
            consoleService.logStringMessage("Sixornot - prefs observer - use_greyscale has changed");
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
let s6only_16_c = "", s6and4_16_c = "", s4pot6_16_c = "", s4only_16_c = "", sother_16_c = "";
let s6only_24_c = "", s6and4_24_c = "", s4pot6_24_c = "", s4only_24_c = "", sother_24_c = "";
// Greyscale icons
let s6only_16_g = "", s6and4_16_g = "", s4pot6_16_g = "", s4only_16_g = "", sother_16_g = "";
let s6only_24_g = "", s6and4_24_g = "", s4pot6_24_g = "", s4only_24_g = "", sother_24_g = "";
// Current icons
let s6only_16 = "",   s6and4_16 = "",   s4pot6_16 = "",   s4only_16 = "",   sother_16 = "";
let s6only_24 = "",   s6and4_24 = "",   s4pot6_24 = "",   s4only_24 = "",   sother_24 = "";

(function(global) global.include = function include(src) (
    Services.scriptloader.loadSubScript(src, global)))(this);


/*
    Core functionality
*/
function main (win)
{
    consoleService.logStringMessage("Sixornot - main");
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
        tooltip.addEventListener("popupshowing", updateTooltipContent, false);

        // Menu setup
        toolbarPopupMenu.setAttribute("id", TOOLBAR_MENU_ID);
        toolbarPopupMenu.setAttribute("position", "after_start");
        // Add event listener for popupMenu opening (to update popupMenu contents dynamically)
        toolbarPopupMenu.addEventListener("popupshowing", updateMenuContent, false);
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
        win.addEventListener("aftercustomization", toggleCustomize, false);
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
            addressPopupMenu.addEventListener("popupshowing", updateMenuContent, false);
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
        consoleService.logStringMessage("Sixornot - main unload function");
        // Cancel any active DNS lookups
        dns_handler.cancel_request(dns_request);

        // Get UI elements
        let toolbarButton = gbi(doc, BUTTON_ID) || gbi(gbi(doc, "navigator-toolbox").palette, BUTTON_ID);
        let tooltip = gbi(doc, TOOLTIP_ID);
        let toolbarPopupMenu = gbi(doc, TOOLBAR_MENU_ID);

        // Clear interval
        win.clearInterval(pollLoopID);

        // Clear event handlers
        win.removeEventListener("aftercustomization", toggleCustomize, false);
        win.removeEventListener("offline", onChangedOnlineStatus, false);
        win.removeEventListener("online", onChangedOnlineStatus, false);
        tooltip.removeEventListener("popupshowing", updateTooltipContent, false);
        toolbarPopupMenu.removeEventListener("popupshowing", updateMenuContent, false);
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
            consoleService.logStringMessage("Sixornot - address bar unload function");
            // Get UI elements
            let addressPopupMenu = gbi(doc, ADDRESS_MENU_ID);
            let addressIcon = gbi(doc, ADDRESS_IMG_ID);
            let addressButton = gbi(doc, ADDRESS_BOX_ID);

            // Clear event handlers
            addressPopupMenu.removeEventListener("popupshowing", updateMenuContent, false);
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
        try
        {
            if (contentDoc !== win.content.document)
                updateState();
        }
        catch (e)
        {
            Components.utils.reportError("Sixornot EXCEPTION: " + parseException(e));
        }
    }

    /* Updates icon/tooltip etc. state if needed - called by the polling loop */
    function updateState ()
    {
        consoleService.logStringMessage("Sixornot - updateState");

        let addressIcon = gbi(doc, ADDRESS_IMG_ID);
        let toolbarButton = gbi(doc, BUTTON_ID) || gbi(gbi(doc, "navigator-toolbox").palette, BUTTON_ID);

        contentDoc = win.content.document;
        url = contentDoc.location.href;
        host = "";
        consoleService.logStringMessage("Sixornot - ipv4s: " + ipv4s + ", ipv6s: " + ipv6s + ", localipv4s: " + localipv4s + ", localipv6s: " + localipv6s + ", ");
        ipv6s = [];
        ipv4s = [];
        localipv6s = [];
        localipv4s = [];
        consoleService.logStringMessage("Sixornot - ipv4s: " + ipv4s + ", ipv6s: " + ipv6s + ", localipv4s: " + localipv4s + ", localipv6s: " + localipv6s + ", ");

        // If we've changed pages before completing a lookup, then abort the old request first
        dns_handler.cancel_request(dns_request);
        dns_request = null;

        let set_icon = function (icon)
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
        if (updateIcon())
        {
            return;
        }

        // Need to look up host
        try
        {
            host = cropTrailingChar(contentDoc.location.hostname, ".");
        } 
        catch (e)
        {
            consoleService.logStringMessage("Sixornot - Unable to look up host");
        }
        if (host === "")
        {
            set_icon(sother_16);
            specialLocation = ["unknownsite"];
            consoleService.logStringMessage("Sixornot warning: no host returned for \"" + url + "\"");
            return;
        }

        // Offline mode or otherwise not connected
        if (!win.navigator.onLine)
        {
            set_icon(sother_16);
            specialLocation = ["offlinemode"];
            consoleService.logStringMessage("Sixornot is in offline mode");
            return;
        }

        // Proxy in use for DNS; can't do a DNS lookup
        if (dns_handler.is_proxied_dns(url))
        {
            set_icon(sother_16);
            specialLocation = ["nodnserror"];
            consoleService.logStringMessage("Sixornot is in proxied mode");
            return;
        }

        let onReturnedIPs = function (remoteips)
        {
            consoleService.logStringMessage("Sixornot - onReturnedIPs");
            dns_request = null;

            // DNS lookup failed
            if (remoteips[0] === "FAIL")
            {
                set_icon(sother_16);
                specialLocation = ["lookuperror"];
                consoleService.logStringMessage("Sixornot - DNS lookup failed");
                return;
            }

            consoleService.logStringMessage("Sixornot - remoteips is: " + remoteips + "; typeof remoteips is: " + typeof remoteips);

            // Parse list of IPs for IPv4/IPv6
            ipv6s = remoteips.filter(dns_handler.is_ip6);
            ipv4s = remoteips.filter(dns_handler.is_ip4);

            consoleService.logStringMessage("Sixornot - found remote IP addresses, trying local next");

            // Update our local IP addresses (need these for the updateIcon phase, and they ought to be up-to-date)
            // Should do this via an async process to avoid blocking (but getting local IPs should be really quick!)

            let onReturnedLocalIPs = function (localips)
            {
                consoleService.logStringMessage("Sixornot - onReturnedLocalIPs");
                dns_request = null;

                consoleService.logStringMessage("Sixornot - localips is: " + localips + "; typeof localips is: " + typeof localips);
                // Parse list of local IPs for IPv4/IPv6
                localipv6s = localips.filter(function (a) {
                    return dns_handler.is_ip6(a) && dns_handler.typeof_ip6(a) !== "localhost"; });
                localipv4s = localips.filter(function (a) {
                    return dns_handler.is_ip4(a) && dns_handler.typeof_ip4(a) !== "localhost"; });

                consoleService.logStringMessage("Sixornot - found local IP addresses");

                // This must now work as we have a valid IP address
                updateIcon();
            };

            dns_request = dns_handler.resolve_local_async(onReturnedLocalIPs);

            /* let localips = [];
            try
            {
                localips = dns_handler.resolve_local_async();
            }
            catch (e)
            {
                consoleService.logStringMessage("Sixornot - Unable to look up local IP addresses");
                Components.utils.reportError("Sixornot EXCEPTION: " + parseException(e));
            } */
        }

        // Ideally just hitting the DNS cache here
//        onReturnedIPs(dns_handler.resolve_remote_async(host));
        dns_request = dns_handler.resolve_remote_async(host, onReturnedIPs);
    }


    /* Update the status icon state (icon & tooltip)
       Returns true if it's done and false if unknown */
    function updateIcon ()
    {
        consoleService.logStringMessage("Sixornot - updateIcon");
        let addressIcon = gbi(doc, ADDRESS_IMG_ID);
        let toolbarButton = gbi(doc, BUTTON_ID) || gbi(gbi(doc, "navigator-toolbox").palette, BUTTON_ID);

        let loc_options = ["file:", "data:", "about:", "chrome:", "resource:"];

        consoleService.logStringMessage("Sixornot - ipv4s: " + ipv4s + ", ipv6s: " + ipv6s + ", localipv4s: " + localipv4s + ", localipv6s: " + localipv6s + ", ");
        function set_icon (icon)
        {
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
        consoleService.logStringMessage("Sixornot - onMenuCommand");

        let commandID = evt.target.value.substring(0,5);
        let commandString = evt.target.value.substring(5);
        // Actions
        // "prefs" - Open preferences
        // "copyc" - Copy text to clipboard
        // "gotow" - Go to SixOrNot website
        // "taddr" - Show or hide the address bar icon
        if (commandID === "copyc")
        {
            consoleService.logStringMessage("Sixornot - onMenuCommand, copy to clipboard");
            clipboardHelper.copyString(commandString);
        }
        else if (commandID === "gotow")
        {
            consoleService.logStringMessage("Sixornot - onMenuCommand, goto web page");
            // Add tab to most recent window, regardless of where this function was called from
            let currentWindow = getCurrentWindow();
            currentWindow.focus();
            let currentBrowser = currentWindow.getBrowser();
            currentBrowser.selectedTab = currentBrowser.addTab(commandString);
        }
        else if (commandID === "tbool")
        {
            // Toggle address bar icon visibility
            let toggle = (evt.target.hasAttribute("checked") && evt.target.getAttribute("checked") === "true");
            consoleService.logStringMessage("Sixornot - onMenuCommand, set boolean pref value: " + commandString + " to " + toggle);
            PREF_BRANCH_SIXORNOT.setBoolPref(commandString, toggle);
        }
    }

    // Update the contents of the popupMenu whenever it is opened
    function updateMenuContent (evt)
    {
        consoleService.logStringMessage("Sixornot - updateMenuContent");
        consoleService.logStringMessage("Sixornot - ipv4s: " + ipv4s + ", ipv6s: " + ipv6s + ", localipv4s: " + localipv4s + ", localipv6s: " + localipv6s + ", ");
        let popupMenu = this;

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
        let addMenuItem = function (labelName, ttText, commandID)
        {
            consoleService.logStringMessage("Sixornot - addMenuItem: " + labelName + ", " + ttText + ", " + commandID);
            let (menuitem = doc.createElementNS(NS_XUL, "menuitem"))
            {
                menuitem.setAttribute("label", labelName);
                menuitem.setAttribute("tooltiptext", ttText);
                menuitem.setAttribute("value", commandID);
                popupMenu.appendChild(menuitem);
            }
        };
        let addToggleMenuItem = function (labelName, ttText, commandID, initialState)
        {
            consoleService.logStringMessage("Sixornot - addToggleMenuItem: " + labelName + ", " + ttText + ", " + commandID + ", " + initialState);
            let (menuitem = doc.createElementNS(NS_XUL, "menuitem"))
            {
                menuitem.setAttribute("label", labelName);
                menuitem.setAttribute("tooltiptext", ttText);
                menuitem.setAttribute("value", commandID);
                menuitem.setAttribute("type", "checkbox");
                menuitem.setAttribute("checked", initialState);
                popupMenu.appendChild(menuitem);
            }
        };
        let addDisabledMenuItem = function (labelName)
        {
            consoleService.logStringMessage("Sixornot - addDisabledMenuItem: " + labelName);
            let (menuitem = doc.createElementNS(NS_XUL, "menuitem"))
            {
                menuitem.setAttribute("label", labelName);
                menuitem.setAttribute("disabled", true);
                popupMenu.appendChild(menuitem);
            }
        };
        let addMenuSeparator = function ()
        {
            consoleService.logStringMessage("Sixornot - addMenuSeparator");
            let (menuseparator = doc.createElementNS(NS_XUL, "menuseparator"))
            {
                popupMenu.appendChild(menuseparator);
            }
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
                    let remotestring = Array.concat([host], ipv6s, ipv4s).join(", ");
                    addMenuItem(host, gt("tt_copydomclip"), "copyc" + remotestring);
                }
                else
                {
                    // In this case there will only ever be one IP address record
                    addDisabledMenuItem(gt("hostnameisip"));
                }
            }
            else
            {
                addDisabledMenuItem(gt("nohostnamefound"));
            }

            for (i = 0; i < ipv6s.length; i++)
            {
                addMenuItem(ipv6s[i], gt("tt_copyip6clip"), "copyc" + ipv6s[i]);
            }
            for (i = 0; i < ipv4s.length; i++)
            {
                addMenuItem(ipv4s[i], gt("tt_copyip4clip"), "copyc" + ipv4s[i]);
            }
        }
        else
        {
            addDisabledMenuItem(gt("noremoteloaded"));
        }

        addMenuSeparator();

        // Produce string containing all IP data for copy
        let localstring = Array.concat([dnsService.myHostName], localipv6s, localipv4s).join(", ");
        addMenuItem(dnsService.myHostName + " (localhost)",
                    gt("tt_copylocalclip"),
                    "copyc" + localstring);

        for (i = 0; i < localipv6s.length; i++)
        {
            addMenuItem(localipv6s[i], gt("tt_copyip6clip"), "copyc" + localipv6s[i]);
        }
        for (i = 0; i < localipv4s.length; i++)
        {
            addMenuItem(localipv4s[i], gt("tt_copyip4clip"), "copyc" + localipv4s[i]);
        }

        addMenuSeparator();

        // Preferences toggle menu items
        addToggleMenuItem(gt("showaddressicon"),
                          gt("tt_showaddressicon"),
                          "tbool" + "showaddressicon",
                          PREF_BRANCH_SIXORNOT.getBoolPref("showaddressicon"));
        addToggleMenuItem(gt("usegreyscale"),
                          gt("tt_usegreyscale"),
                          "tbool" + "use_greyscale",
                          PREF_BRANCH_SIXORNOT.getBoolPref("use_greyscale"));

        addMenuSeparator();
        addMenuItem(gt("gotowebsite"),
                    gt("tt_gotowebsite"),
                    "gotow" + "http://entropy.me.uk/sixornot/");
    }

    // Update the contents of the tooltip whenever it is shown
    function updateTooltipContent (evt)
    {
        consoleService.logStringMessage("Sixornot - updateTooltipContent");
        consoleService.logStringMessage("Sixornot - ipv4s: " + ipv4s + ", ipv6s: " + ipv6s + ", localipv4s: " + localipv4s + ", localipv6s: " + localipv6s + ", ");
        let tooltip = this;

        // Clear previously generated tooltip, if one exists
        while (tooltip.firstChild)
        {
            tooltip.removeChild(tooltip.firstChild);
        }

        let grid = doc.createElement("grid");
        let rows = doc.createElement("rows");

        let i;

        let addTitleLine = function (labelName)
        {
            consoleService.logStringMessage("Sixornot - addTitleLine");
            let row = doc.createElementNS(NS_XUL, "row");
            let label = doc.createElementNS(NS_XUL, "label");
            let value = doc.createElementNS(NS_XUL, "label");

            label.setAttribute("value", labelName);
            label.setAttribute("style", "font-weight: bold; text-align: right;");
            row.appendChild(value);
            row.appendChild(label);
            rows.appendChild(row);
        };

        let addLabeledLine = function (labelName, lineValue, italic)
        {
            consoleService.logStringMessage("Sixornot - addLabeledLine");
            let row = doc.createElementNS(NS_XUL, "row");
            let label = doc.createElementNS(NS_XUL, "label");
            let value = doc.createElementNS(NS_XUL, "label");
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
            addTitleLine(gt("header_remote"), "");
        }

        if (host !== "")
        {
            addLabeledLine(gt("prefix_domain"), host);
        }

        // Add IPv6 address(es) to tooltip with special case if only one
        if (ipv6s.length === 1)
        {
            consoleService.logStringMessage("Sixornot - ipv6s.length is 1");
            addLabeledLine(gt("prefix_v6_single"), ipv6s[0]);
        }
        else if (ipv6s.length > 1)
        {
            consoleService.logStringMessage("Sixornot - ipv6s.length is > 1");
            addLabeledLine(gt("prefix_v6_multi"), ipv6s[0]);
            for (i = 1; i < ipv6s.length; i++)
            {
                addLabeledLine(" ", ipv6s[i]);
            }
        }

        // Add IPv4 address(es) to tooltip with special case if only one
        if (ipv4s.length === 1)
        {
            addLabeledLine(gt("prefix_v4_single"), ipv4s[0]);
        }
        else if (ipv4s.length > 1)
        {
            addLabeledLine(gt("prefix_v4_multi"), ipv4s[0]);
            for (i = 1; i < ipv4s.length; i++)
            {
                addLabeledLine(" ", ipv4s[i]);
            }
        }

        // Add local IP address information if available
        if (localipv4s.length !== 0 || localipv6s.length !== 0)
        {
            addLabeledLine();
            addTitleLine(gt("header_local"));
            addLabeledLine(gt("prefix_host"), dnsService.myHostName);
        }

        // Append local IP address information
        // TODO - Convert other functions to this form
        let v6_italic = function (ip6_address)
        {
            return dns_handler.typeof_ip6(ip6_address) !== "global";
        };
        if (localipv6s.length === 1)
        {
            addLabeledLine(gt("prefix_v6_single"), localipv6s[0], v6_italic(localipv6s[0]));
        }
        else if (localipv6s.length > 1)
        {
            addLabeledLine(gt("prefix_v6_multi"), localipv6s[0], v6_italic(localipv6s[0]));
            for (i = 1; i < localipv6s.length; i++)
            {
                addLabeledLine(" ", localipv6s[i], v6_italic(localipv6s[i]));
            }
        }

        let v4_italic = function (ip4_address)
        {
            return ["global", "rfc1918"].indexOf(dns_handler.typeof_ip4(ip4_address)) === -1;
        };
        // Add local IPv4 address(es) to tooltip with special case if only one
        if (localipv4s.length === 1)
        {
            addLabeledLine(gt("prefix_v4_single"), localipv4s[0], v4_italic(localipv4s[0]));
        }
        else if (localipv4s.length > 1)
        {
            addLabeledLine(gt("prefix_v4_multi"), localipv4s[0], v4_italic(localipv4s[0]));
            for (i = 1; i < localipv4s.length; i++)
            {
                addLabeledLine(" ", localipv4s[i], v4_italic(localipv4s[i]));
            }
        }

        // TODO - Replace this with an array mapping/lookup table
        // TODO - If a special location is set no need to do any of the IP address stuff!
        if (specialLocation)
        {
            let extraString, extraLine;

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
    // Set up resource URI alias
    let resource = Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
    let alias = Services.io.newFileURI(aData.installPath);
    resource.setSubstitution("sixornot", alias);

    AddonManager.getAddonByID(aData.id, function (addon, data) {
        consoleService.logStringMessage("Sixornot - startup");

        // Include libraries
        include(addon.getResourceURI("includes/utils.js").spec);
        include(addon.getResourceURI("includes/locale.js").spec);

        // Init dns_handler
        dns_handler.init();

        // Run dns_handler tests
        dns_handler.test_normalise_ip6();
        dns_handler.test_typeof_ip6();
        dns_handler.test_is_ip6();

        consoleService.logStringMessage("Sixornot - startup - initLocalisation...");
        initLocalisation(addon, "sixornot.properties");

        // Load image sets
        consoleService.logStringMessage("Sixornot - startup - loading image sets...");
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
        consoleService.logStringMessage("Sixornot - startup - setting active image set...");
        set_iconset();

        // Load into existing windows and set callback to load into any new ones too
        consoleService.logStringMessage("Sixornot - startup - loading into windows...");
        watchWindows(main);

        consoleService.logStringMessage("Sixornot - startup - setting up prefs observer...");
        let prefs = PREF_BRANCH_SIXORNOT;
        prefs = prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
        prefs.addObserver("", PREF_OBSERVER, false);

    });
}

// Reload addon in all windows, e.g. when preferences change
function reload ()
{
    consoleService.logStringMessage("Sixornot - reload");
    unload();
    watchWindows(main);
}

function shutdown (data, reason)
{
    consoleService.logStringMessage("Sixornot - shutdown");
    // Shutdown dns_handler
    dns_handler.shutdown();

    if (reason !== APP_SHUTDOWN)
    {
        unload();
        
        let prefs = PREF_BRANCH_SIXORNOT;
        prefs = prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
        prefs.removeObserver("", PREF_OBSERVER);

        let resource = Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
        resource.setSubstitution("sixornot", null);
    }
}

function install ()
{
    consoleService.logStringMessage("Sixornot - install");
    setInitialPrefs();
}

function uninstall ()
{
    consoleService.logStringMessage("Sixornot - uninstall");
    // TODO If this is due to an upgrade then don't delete preferences?
    // Some kind of upgrade function to potentially upgrade preference settings may be required
    PREF_BRANCH_SIXORNOT.deleteBranch("");             
}


/*
    Utility functions
*/

// Update preference which determines location of button when loading into new windows
function toggleCustomize (evt)
{
    consoleService.logStringMessage("Sixornot - toggleCustomize");
    let toolbox = evt.target, toolbarId, nextItemId;
    let button = gbi(toolbox.parentNode, BUTTON_ID);
    if (button)
    {
        let parent = button.parentNode, nextItem = button.nextSibling;
        if (parent && parent.localName === "toolbar")
        {
            toolbarId = parent.id;
            nextItemId = nextItem && nextItem.id;
        }
    }
    PREF_BRANCH_SIXORNOT.setCharPref(PREF_TOOLBAR,  toolbarId || "");
    PREF_BRANCH_SIXORNOT.setCharPref(PREF_NEXTITEM, nextItemId || "");
}

// Return boolean preference value, either from prefs store or from internal defaults
function get_bool_pref (name)
{
    consoleService.logStringMessage("Sixornot - get_bool_pref");
    try
    {
        return PREF_BRANCH_SIXORNOT.getBoolPref(name);
    }
    catch (e)
    {
        consoleService.logStringMessage("Sixornot - get_bool_pref error - " + e);
    }
    if (PREFS.hasOwnProperty(name))
    {
        consoleService.logStringMessage("Sixornot - get_bool_pref returning PREFS[name] : " + PREFS[name]);
        return PREFS[name]
    }
    else
    {
        consoleService.logStringMessage("Sixornot - get_bool_pref error - No default preference value!");
    }
}

// Return the current browser window
function getCurrentWindow ()
{
    return Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator)
                     .getMostRecentWindow("navigator:browser");
}

// Proxy to getElementById
function gbi (node, childId)
{
    if (node.getElementById)
    {
        return node.getElementById(childId);
    }
    else
    {
        return node.querySelector("#" + childId);
    }
}

// Set up initial values for preferences
function setInitialPrefs ()
{
    consoleService.logStringMessage("Sixornot - setInitialPrefs");
    let branch = PREF_BRANCH_SIXORNOT;
    for (let [key, val] in Iterator(PREFS))
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
function parseException (e)
{
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
        return String(e) + " \n" + cleanExceptionStack(e.stack);
    }
}
// Undo conversion of resource:// urls into file:// urls in exceptions
function cleanExceptionStack (stack)
{
    try
    {
        const shortPath = "resource://sixornot/";
        const longPath = ioService.newChannel(shortPath, null, null).URI.spec;
        return stack.replace(new RegExp(longPath, "ig"), shortPath);
    }
    catch (e)
    {
        return stack;
    }
}

// String modification
function truncateBeforeFirstChar (str, character)
{
    let pos = str.indexOf(character);
    return (pos !== -1) ? str.substring(0, pos) : str.valueOf();
}
function truncateAfterLastChar (str, character)
{
    let pos = str.lastIndexOf(character);
    return (pos !== -1) ? str.substring(pos + 1) : str.valueOf();
}
function cropTrailingChar (str, character)
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


// The DNS Handler which does most of the work of the extension
var dns_handler =
{
    AF_UNSPEC: null,
    AF_INET: null,
    AF_INET6: null,
    AF_LINK: null,
    library: null,
    sockaddr: null,
    addrinfo: null,
    getaddrinfo: null,
    ifaddrs: null,
    getifaddrs: null,
    remote_ctypes: false,
    local_ctypes: false,

    callback_ids: [],
    next_callback_id: 0,

    worker: null,

    init : function (worker_url)
    {
        consoleService.logStringMessage("Sixornot - dns_handler - init");
        // Import ctypes module (not needed, this is all handled by our worker)
        // Cu.import("resource://gre/modules/ctypes.jsm");

        // Initialise ChromeWorker which will be used to do DNS lookups either via ctypes or dnsService
        this.worker = workerFactory.newChromeWorker("resource://sixornot/includes/dns_worker.js");

  	    // Shim to get 'this' to refer to dns_handler, not the
  	    // worker, when a message is received.
  	    var self = this;
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
        // Then the callback is removed from the array and called

    },

    shutdown : function ()
    {
        if (this.remote_ctypes)
        {
            this.library.close();
        }
    },

    validate_ip4 : function (ip_address)
    {
        // TODO - Write this function if needed, extensive validation of IPv4 address
        return false;
    },

    // Quick check for address family, not a validator (see validate_ip4)
    is_ip4 : function (ip_address)
    {
        return (ip_address.indexOf(".") !== -1);
    },

    typeof_ip4 : function (ip_address)
    {
        // TODO - Function in_subnet (network, subnetmask, ip) to check if specified IP is in the specified subnet range
        if (!dns_handler.is_ip4(ip_address))
        {
            return false;
        }
        // For IPv4 addresses types are (from RFC 3330)
        /*
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
        */
        /*
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
        let split_address = ip_address.split(".").map(Number);
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
        let overall = true;
        let tests = [
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
                        ["1::2::3",                                 false],
                    ];
        for (let i = 0; i < tests.length; i++)
        {
            let result = this.is_ip6(tests[i][0]);
            if (result === tests[i][1])
            {
                consoleService.logStringMessage("Sixornot - test_is_ip6, passed test value: " + tests[i][0] + ", result: " + result);
            }
            else
            {
                consoleService.logStringMessage("Sixornot - test_is_ip6, failed test value: " + tests[i][0] + ", expected result: " + tests[i][1] + ", actual result: " + result);
                overall = false;
            }
        }
        return overall;
    },

    validate_ip6 : function (ip_address)
    {
        // TODO - Write this function if needed, extensive validation of IPv6 address
        return false;
    },

    // Quick check for address family, not a validator (see validate_ip6)
    is_ip6 : function (ip_address)
    {
        return (ip_address.indexOf(":") !== -1);
    },

    test_normalise_ip6 : function ()
    {
        let overall = true;
        let tests = [
                        ["::",                                      "0000:0000:0000:0000:0000:0000:0000:0000"],
                        ["::1",                                     "0000:0000:0000:0000:0000:0000:0000:0001"],
                        ["fe80::fa22:22ff:fee8:2222",               "fe80:0000:0000:0000:fa22:22ff:fee8:2222"],
                        ["fc00::",                                  "fc00:0000:0000:0000:0000:0000:0000:0000"],
                        ["ff00:1234:5678:9abc:def0:d:ee:fff",       "ff00:1234:5678:9abc:def0:000d:00ee:0fff"],
                        ["2:0::1:2",                                "0002:0000:0000:0000:0000:0000:0001:0002"],
                        ["2001:8b1:1fe4:1::2222",                   "2001:08b1:1fe4:0001:0000:0000:0000:2222"],
                        ["2001:08b1:1fe4:0001:0000:0000:0000:2222", "2001:08b1:1fe4:0001:0000:0000:0000:2222"],
                        ["fe80::fa1e:dfff:fee8:db18%en1",           "fe80:0000:0000:0000:fa1e:dfff:fee8:db18"],
                    ];
        for (let i = 0; i < tests.length; i++)
        {
            let result = this.normalise_ip6(tests[i][0]);
            if (result === tests[i][1])
            {
                consoleService.logStringMessage("Sixornot - test_normalise_ip6, passed test value: " + tests[i][0] + ", result: " + result);
            }
            else
            {
                consoleService.logStringMessage("Sixornot - test_normalise_ip6, failed test value: " + tests[i][0] + ", expected result: " + tests[i][1] + ", actual result: " + result);
                overall = false;
            }
        }
        return overall;
    },

    // Expand IPv6 address into long version
    normalise_ip6 : function (ip6_address)
    {
        // Split by instances of ::
        let sides = ip6_address.split("::");
        // Split remaining sections by instances of :
        let left_parts = sides[0].split(":");
        let right_parts = sides[1] && sides[1].split(":") || [];

        let middle = ["0", "0", "0", "0", "0", "0", "0", "0"].slice(0, 8 - left_parts.length - right_parts.length);
        let outarray = Array.concat(left_parts, middle, right_parts);

        // Pad each component to 4 char length with zeros to left (and convert to lowercase)
        let pad_left = function (str)
        {
            return ("0000" + str).slice(-4);
        }

        return outarray.map(pad_left).join(":").toLowerCase();
    },

    // Unit test suite for typeof_ip6 function, returns false if a test fails
    test_typeof_ip6 : function ()
    {
        let overall = true;
        let tests = [
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
                        ["...", false],
                    ];
        for (let i = 0; i < tests.length; i++)
        {
            let result = this.typeof_ip6(tests[i][0]);
            if (result === tests[i][1])
            {
                consoleService.logStringMessage("Sixornot - test_typeof_ip6, passed test value: " + tests[i][0] + ", result: " + result);
            }
            else
            {
                consoleService.logStringMessage("Sixornot - test_typeof_ip6, failed test value: " + tests[i][0] + ", expected result: " + i[1] + ", actual result: " + result);
                overall = false;
            }
        }
        return overall;
    },

    // Return the type of an IPv6 address
    typeof_ip6 : function (ip_address)
    {
        // 1. Check IP version, return false if v4
        if (!dns_handler.is_ip6(ip_address))
        {
            return false;
        }
        // 2. Normalise address, return false if normalisation fails
        let norm_address = dns_handler.normalise_ip6(ip_address);
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
        // For IPv6 addresses types are:
        /*
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
    },

    // Return the IP address(es) of the local host
    resolve_local_async : function (callback)
    {
        consoleService.logStringMessage("Sixornot - dns_handler:resolve_local_async");
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
        consoleService.logStringMessage("Sixornot - _local_ctypes_async - resolving local host");
        // This uses dns_worker to do the work asynchronously
        // Add callback to request mapping table
        this.next_callback_id = this.next_callback_id + 1;
        this.callback_ids[this.next_callback_id] = callback;
        let request_id = 2;
        this.worker.postMessage([this.next_callback_id, request_id, null]);
        return true;
    },

    // Proxy to _remote_firefox_async since it does much the same thing
    _local_firefox_async : function (callback)
    {
        consoleService.logStringMessage("Sixornot - _local_firefox_async - resolving local host");
        return this._remote_firefox_async(dnsService.myHostName, callback);
    },


    // Resolve IP address(es) of a remote host using DNS
    // This should return an object which can be used to cancel the pending request
    resolve_remote_async : function (host, callback)
    {
        consoleService.logStringMessage("Sixornot - dns_handler:resolve_remote_async");
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
        consoleService.logStringMessage("Sixornot - dns_handler:_remote_ctypes_async");
        // This uses dns_worker to do the work asynchronously
        this.next_callback_id = this.next_callback_id + 1;
        this.callback_ids[this.next_callback_id] = callback;
        let request_id = 1;
        this.worker.postMessage([this.next_callback_id, request_id, host]);
        // TODO - This should return an object with a cancel() method which cancels the request
        return true;
    },

    _remote_firefox_async : function (host, callback)
    {
        consoleService.logStringMessage("Sixornot - dns_handler:_remote_firefox_async");

        let my_callback =
        {
            onLookupComplete : function (nsrequest, dnsresponse, nsstatus)
            {
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
                        consoleService.logStringMessage("Sixornot - dns_handler:_remote_firefox_async - resolve host failed, unknown host");
                        callback(["FAIL"]);
                    }
                    else
                    {
                        consoleService.logStringMessage("Sixornot - dns_handler:_remote_firefox_async - resolve host failed, status: " + nsstatus);
                        callback(["FAIL"]);
                    }
                    // Address was not found in DNS for some reason
                    return;  
                }
                // Otherwise address was found
                let ip_addresses = [];
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
            Components.utils.reportError("Sixornot EXCEPTION: " + parseException(e));
            callback(["FAIL"]);
            return null;
        }
    },

    // Called by worker to pass information back to main thread
    onworkermessage : function (evt)
    {
        consoleService.logStringMessage("Sixornot - dns_handler:onworkermessage - message is: " + evt.data);
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
            let callback = this.callback_ids[evt.data[0]];
            // Execute callback
            callback(evt.data[2]);
            // TODO - Remove expired callback from array
        }
    },

    // Cancels an active DNS lookup request
    cancel_request : function (request)
    {
        try
        {
            request.cancel(Components.results.NS_ERROR_ABORT);
        }
        catch (e)
        {
            // TODO - Maybe hide this exception?
            Components.utils.reportError("Sixornot EXCEPTION: " + parseException(e));
        }
    },

    // Returns true if the URL is set to have its DNS lookup proxied via SOCKS
    is_proxied_dns : function (url)
    {
        var uri = ioService.newURI(url, null, null);
        var proxyinfo = proxyService.resolve(uri, 0);  // Finds proxy (shouldn't block thread; we already did this lookup to load the page)
        return (proxyinfo !== null) && (proxyinfo.flags & proxyinfo.TRANSPARENT_PROXY_RESOLVES_HOST);
        // "network.proxy.socks_remote_dns" pref must be set to true for Firefox to set TRANSPARENT_PROXY_RESOLVES_HOST flag when applicable
    },

/*
    // Convert a base10 representation of a number into a base16 one (zero-padded to two characters, input number less than 256)
    to_hex : function (int_string)
    {
        let hex = Number(int_string).toString(16);
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



