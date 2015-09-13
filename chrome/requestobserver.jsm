/*
 * Copyright 2008-2015 Timothy Baldock. All Rights Reserved.
 */

/* global log, parse_exception */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://sixornot/content/logger.jsm");

/* exported httpRequestObserver */
var EXPORTED_SYMBOLS = ["httpRequestObserver"];

// https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Tabbed_browser#Getting_the_browser_that_fires_the_http-on-modify-request_notification
/*var legacyGetBrowser = function (contentWindow) {
    var aDOMWindow = contentWindow.top.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIWebNavigation)
                                      .QueryInterface(Components.interfaces.nsIDocShellTreeItem).rootTreeItem
                                      .QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindow);
    return aDOMWindow.gBrowser._getTabForContentWindow(contentWindow.top).linkedBrowser;
};*/

var onExamineResponse = function(subject, topic) {
    var httpChannel, httpChannelInternal, proxyChannel,
        notificationCallbacks, loadContext,
        remoteAddress, remoteAddressFamily, topFrameMM;

    httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
    httpChannelInternal = subject.QueryInterface(Components.interfaces.nsIHttpChannelInternal);
    proxyChannel = subject.QueryInterface(Components.interfaces.nsIProxiedChannel);

    notificationCallbacks = httpChannel.notificationCallbacks;
    if (!notificationCallbacks) {
        if (httpChannel.loadGroup) {
            notificationCallbacks = httpChannel.loadGroup.notificationCallbacks;
        }
    }
    if (!notificationCallbacks) {
        log("httpRequestObserver: Unable to determine notificationCallbacks for this httpChannel", 1);
        return;
    }

    /* Try and locate a messageManager for the browser initiating this request */
    try {
        loadContext = notificationCallbacks.getInterface(Components.interfaces.nsILoadContext);
        var topFrameElement = loadContext.topFrameElement;
        /*if (!topFrameElement) { // Compatibility with FF38 and below with E10S disabled
            topFrameElement = legacyGetBrowser(loadContext.associatedWindow);
        }*/
        topFrameMM = topFrameElement.messageManager;
    } catch (e) {
        log("httpRequestObserver: could not find messageManager for request browser - exception: " + parse_exception(e), 1);
        return;
    }

    // Check for browser windows loading things like favicons and filter out
    if (!loadContext.isContent) {   // TODO does this still work?
        log("httpRequestObserver: loadContext is not content - skipping", 1);
        return;
    }

    /* Extract address information */
    if (topic === "http-on-examine-response" || topic === "http-on-examine-merged-response") {
        try {
            remoteAddress = httpChannelInternal.remoteAddress;
            remoteAddressFamily = remoteAddress.indexOf(":") === -1 ? 4 : 6;
        } catch (e) {
            log("httpRequestObserver - http-on-examine-response: remoteAddress was not accessible for: " + httpChannel.URI.spec, 1);
            remoteAddress = "";
            remoteAddressFamily = 0;
        }
    } else {
        log("httpRequestObserver - (probably cache hit) NOT http-on-examine-response: remoteAddress was not accessible for: " + httpChannel.URI.spec, 2);
        remoteAddress = "";
        remoteAddressFamily = 2;
    }

    log("httpRequestObserver: Processing " + httpChannel.URI.host + " (" + (remoteAddress || "FROM_CACHE") + ")", 1);

    /* Extract proxy information */
    var proxyInfo = {
        host: null,
        port: null,
        type: "direct",
        proxyResolvesHost: false
    };

    if (proxyChannel && proxyChannel.proxyInfo) {
        proxyInfo.host = proxyChannel.proxyInfo.host;
        proxyInfo.port = proxyChannel.proxyInfo.port;
        proxyInfo.type = proxyChannel.proxyInfo.type;
        proxyInfo.proxyResolvesHost = proxyChannel.proxyInfo.flags === 1;
    }

    /* Extract security information */
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

    if (httpChannel.securityInfo) {
        // https://dxr.mozilla.org/comm-central/source/mozilla/security/manager/ssl/nsISSLStatus.idl
        var sslStatusProvider = httpChannel.securityInfo.QueryInterface(Components.interfaces.nsISSLStatusProvider);
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
        var nsITransportSecurityInfo = httpChannel.securityInfo.QueryInterface(Components.interfaces.nsITransportSecurityInfo);
        if (nsITransportSecurityInfo) {
            security.shortSecurityDescription = nsITransportSecurityInfo.shortSecurityDescription;
            security.errorMessage = nsITransportSecurityInfo.errorMessage;
            security.securityState = nsITransportSecurityInfo.securityState;
        }
    }

    var requestRecord = {
        host: httpChannel.URI.host,
        address: remoteAddress,
        addressFamily: remoteAddressFamily,
        security: security,
        proxy: proxyInfo
    };

    log("httpRequestObserver: sending: " + JSON.stringify(requestRecord), 1);

    /*jslint bitwise: true */
    if (httpChannel.loadFlags & Components.interfaces.nsIChannel.LOAD_INITIAL_DOCUMENT_URI) {
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
    observe: function (subject, topic) {
        if (topic === "http-on-examine-response"
         || topic === "http-on-examine-cached-response"
         || topic === "http-on-examine-merged-response") {
            onExamineResponse(subject, topic);
        }
    },

    register: function () {
        Services.obs.addObserver(this, "http-on-examine-response", false);
        Services.obs.addObserver(this, "http-on-examine-cached-response", false);
        Services.obs.addObserver(this, "http-on-examine-merged-response", false);
    },

    unregister: function () {
        Services.obs.removeObserver(this, "http-on-examine-response");
        Services.obs.removeObserver(this, "http-on-examine-cached-response");
        Services.obs.removeObserver(this, "http-on-examine-merged-response");
    }
};

