/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2008-2015 Timothy Baldock. All Rights Reserved.
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

/*jslint es5: true */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
/*jslint es5: false */

var EXPORTED_SYMBOLS = ["httpRequestObserver"];

var on_examine_response = function(subject, topic) {
    var http_channel, http_channel_internal, notificationCallbacks,
        domWindow, domWindowUtils,
        original_window, new_page, new_entry, loadContext,
        e1, e2, remoteAddress, remoteAddressFamily, topFrameMM;

    http_channel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
    http_channel_internal = subject.QueryInterface(Components.interfaces.nsIHttpChannelInternal);

    notificationCallbacks = http_channel.notificationCallbacks;
    if (!notificationCallbacks) {
        if (http_channel.loadGroup) {
            notificationCallbacks = http_channel.loadGroup.notificationCallbacks;
        }
    }
    if (!notificationCallbacks) {
        log("httpRequestObserver: Unable to determine notificationCallbacks for this http_channel", 1);
        return;
    }

    try {
        // TODO - work out what exceptions from these lines actually mean
        loadContext = notificationCallbacks.getInterface(Components.interfaces.nsILoadContext);
        var topFrameElement = loadContext.topFrameElement;  // TODO - will this always be the browser element, e.g. for iframes?
        topFrameMM = topFrameElement.messageManager;
    } catch (e2) {
        log("httpRequestObserver: non-DOM request", 2);
        return;
    }

    // Check for browser windows loading things like favicons and filter out
    if (!loadContext.isContent) {   // TODO does this work?
        log("httpRequestObserver: loadContext is not content - skipping", 1);
        return;
    }

    // Extract address information
    if (topic === "http-on-examine-response") {
        try {
            remoteAddress = http_channel_internal.remoteAddress;
            remoteAddressFamily = remoteAddress.indexOf(":") === -1 ? 4 : 6;
        } catch (e1) {
            log("httpRequestObserver - http-on-examine-response: remoteAddress was not accessible for: " + http_channel.URI.spec, 1);
            remoteAddress = "";
            remoteAddressFamily = 0;
        }
    } else {
        log("httpRequestObserver - (probably cache hit) NOT http-on-examine-response: remoteAddress was not accessible for: " + http_channel.URI.spec, 2);
        remoteAddress = "";
        remoteAddressFamily = 2;
    }

    log("httpRequestObserver: Processing " + http_channel.URI.host + " (" + (remoteAddress || "FROM_CACHE") + ")", 1);

    // Extract security information
    if (http_channel.securityInfo) {
        var sslStatusProvider = http_channel.securityInfo.QueryInterface(Components.interfaces.nsISSLStatusProvider);
        if (sslStatusProvider && sslStatusProvider.SSLStatus) {
            var sslStatus = sslStatusProvider.SSLStatus.QueryInterface(Components.interfaces.nsISSLStatus);
            log("httpRequestObserver: sslStatus - cipherName: " + sslStatus.cipherName + ", keyLength: " + sslStatus.keyLength, 1);
        }
        var nsITransportSecurityInfo = http_channel.securityInfo.QueryInterface(Components.interfaces.nsITransportSecurityInfo);
        if (nsITransportSecurityInfo) {
            log("httpRequestObserver: nsITransportSecurityInfo - shortSecurityDescription: " + nsITransportSecurityInfo.shortSecurityDescription, 1);
        }
    }

    /*jslint bitwise: true */
    if (http_channel.loadFlags & Components.interfaces.nsIChannel.LOAD_INITIAL_DOCUMENT_URI) {
    /*jslint bitwise: false */
        topFrameMM.sendAsyncMessage("sixornot@baldock.me:http-initial-load", {
            host: http_channel.URI.host,
            address: remoteAddress,
            addressFamily: remoteAddressFamily
        });
    } else {
        topFrameMM.sendAsyncMessage("sixornot@baldock.me:http-load", {
            host: http_channel.URI.host,
            address: remoteAddress,
            addressFamily: remoteAddressFamily
        });
    }
};


/*
 * HTTP Request observer
 * Observes all HTTP requests to determine the details of connections
 * Ignores connections which aren't related to browser windows
 */
var httpRequestObserver = {
    observe: function (subject, topic, data) {
        if (topic === "http-on-examine-response"
         || topic === "http-on-examine-cached-response") {
            on_examine_response(subject, topic);
        }
    },

    register: function () {
        // TODO http-on-examine-merged-response
        Services.obs.addObserver(this, "http-on-examine-response", false);
        Services.obs.addObserver(this, "http-on-examine-cached-response", false);
    },

    unregister: function () {
        Services.obs.removeObserver(this, "http-on-examine-response");
        Services.obs.removeObserver(this, "http-on-examine-cached-response");
    }
};
