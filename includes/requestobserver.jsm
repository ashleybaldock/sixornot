/*
 * Copyright 2008-2015 Timothy Baldock. All Rights Reserved.
 */

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
    var proxy_channel = subject.QueryInterface(Components.interfaces.nsIProxiedChannel);

    if (proxy_channel) {
        var proxyInfo = proxy_channel.proxyInfo;
    }

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

    var security = {
        cipherName: "",
        keyLength: 0,
        secretKeyLength: 0,
        isExtendedValidation: false,
        isDomainMismatch: false,
        isNotValidAtThisTime: false,
        isUntrusted: false,
        shortSecurityDescription: "",
        errorMessage: "",
        securityState: 0    // TODO make this into flags
    };

    // Extract security information
    if (http_channel.securityInfo) {
        // https://dxr.mozilla.org/comm-central/source/mozilla/security/manager/ssl/nsISSLStatus.idl
        var sslStatusProvider = http_channel.securityInfo.QueryInterface(Components.interfaces.nsISSLStatusProvider);
        if (sslStatusProvider && sslStatusProvider.SSLStatus) {
            var sslStatus = sslStatusProvider.SSLStatus.QueryInterface(Components.interfaces.nsISSLStatus);
            if (sslStatus) {
                security.cipherName = sslStatus.cipherName;
                security.keyLength = sslStatus.keyLength;
                security.secretKeyLength = sslStatus.secretKeyLength;
                security.isExtendedValidation = sslStatus.isExtendedValidation;
                security.isDomainMismatch = sslStatus.isDomainMismatch;
                security.isNotValidAtThisTime = sslStatus.isNotValidAtThisTime;
                security.isUntrusted = sslStatus.isUntrusted;
            }
        }
        var nsITransportSecurityInfo = http_channel.securityInfo.QueryInterface(Components.interfaces.nsITransportSecurityInfo);
        if (nsITransportSecurityInfo) {
            security.shortSecurityDescription = nsITransportSecurityInfo.shortSecurityDescription;
            security.errorMessage = nsITransportSecurityInfo.errorMessage;
            security.securityState = nsITransportSecurityInfo.securityState;
        }
    }

    var requestRecord = {
        host: http_channel.URI.host,
        address: remoteAddress,
        addressFamily: remoteAddressFamily,
        security: security
    };

    log("httpRequestObserver: sending: " + JSON.stringify(requestRecord), 0);

    /*jslint bitwise: true */
    if (http_channel.loadFlags & Components.interfaces.nsIChannel.LOAD_INITIAL_DOCUMENT_URI) {
    /*jslint bitwise: false */
        topFrameMM.sendAsyncMessage("sixornot@baldock.me:http-initial-load", requestRecord);
    } else {
        topFrameMM.sendAsyncMessage("sixornot@baldock.me:http-load", requestRecord);
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

