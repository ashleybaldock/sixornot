/*
 * Copyright 2008-2015 Timothy Baldock. All Rights Reserved.
 */

/* global log, parse_exception, cacheEntry */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://sixornot/content/logger.jsm");
Components.utils.import("chrome://sixornot/content/requestcache.jsm");

/* exported httpRequestObserver */
var EXPORTED_SYMBOLS = ["httpRequestObserver"];

var onExamineResponse = function(subject, topic) {
    var httpChannel, httpChannelInternal, proxyChannel,
        notificationCallbacks, loadContext, topFrameMM;

    httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
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
        topFrameMM = loadContext.topFrameElement.messageManager;
    } catch (e) {
        log("httpRequestObserver: could not find messageManager for request browser - exception: " + parse_exception(e), 1);
        return;
    }

    if (!topFrameMM || !topFrameMM.sendAsyncMessage) {
        log("httpRequestObserver: topFrameMM was undefined for this request", 1);
    }

    // Check for browser windows loading things like favicons and filter out
    if (!loadContext.isContent) {   // TODO does this still work?
        log("httpRequestObserver: loadContext is not content - skipping", 1);
        return;
    }

    var entry = cacheEntry.create();
    entry.host = httpChannel.URI.host;

    /* Extract address information */
    if (topic === "http-on-examine-response" || topic === "http-on-examine-merged-response") {
        httpChannelInternal = subject.QueryInterface(Components.interfaces.nsIHttpChannelInternal);
        try {
            entry.ip.address = httpChannelInternal.remoteAddress;
            entry.ip.family = entry.ip.address.indexOf(":") === -1 ? 4 : 6;
        } catch (e) {
            log("httpRequestObserver - http-on-examine-response: remoteAddress was not accessible for: " + httpChannel.URI.spec, 1);
        }
    } else {
        log("httpRequestObserver - (probably cache hit) NOT http-on-examine-response: remoteAddress was not accessible for: " + httpChannel.URI.spec, 2);
        entry.ip.family = 2;
    }

    /* Extract proxy information */
    proxyChannel = subject.QueryInterface(Components.interfaces.nsIProxiedChannel);
    if (proxyChannel && proxyChannel.proxyInfo) {
        entry.proxy.host = proxyChannel.proxyInfo.host;
        entry.proxy.port = proxyChannel.proxyInfo.port;
        entry.proxy.type = proxyChannel.proxyInfo.type;
        entry.proxy.proxyResolvesHost = proxyChannel.proxyInfo.flags === 1;
    }

    /* Extract security information */
    if (httpChannel.securityInfo) {
        // https://dxr.mozilla.org/comm-central/source/mozilla/security/manager/ssl/nsISSLStatus.idl
        var sslStatusProvider = httpChannel.securityInfo.QueryInterface(Components.interfaces.nsISSLStatusProvider);
        if (sslStatusProvider && sslStatusProvider.SSLStatus) {
            var sslStatus = sslStatusProvider.SSLStatus.QueryInterface(Components.interfaces.nsISSLStatus);
            if (sslStatus) {
                entry.security.cipherName = sslStatus.cipherName;
                entry.security.keyLength = sslStatus.keyLength;
                entry.security.secretKeyLength = sslStatus.secretKeyLength;
                entry.security.isExtendedValidation = sslStatus.isExtendedValidation;
                entry.security.isDomainMismatch = sslStatus.isDomainMismatch;
                entry.security.isNotValidAtThisTime = sslStatus.isNotValidAtThisTime;
                entry.security.isUntrusted = sslStatus.isUntrusted;
            }
        }
        var nsITransportSecurityInfo = httpChannel.securityInfo.QueryInterface(Components.interfaces.nsITransportSecurityInfo);
        if (nsITransportSecurityInfo) {
            entry.security.shortSecurityDescription = nsITransportSecurityInfo.shortSecurityDescription;
            entry.security.errorMessage = nsITransportSecurityInfo.errorMessage;
            entry.security.securityState = nsITransportSecurityInfo.securityState;
        }
    }

    log("httpRequestObserver: sending: " + JSON.stringify(entry), 1);

    if (httpChannel.loadFlags & Components.interfaces.nsIChannel.LOAD_INITIAL_DOCUMENT_URI) {
        topFrameMM.sendAsyncMessage("sixornot@baldock.me:http-initial-load", entry);
    } else {
        topFrameMM.sendAsyncMessage("sixornot@baldock.me:http-load", entry);
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

