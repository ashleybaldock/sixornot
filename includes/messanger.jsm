/*
 * Copyright 2015 Timothy Baldock. All Rights Reserved.
 */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");

var EXPORTED_SYMBOLS = [ "getMessanger" ];

var getMessanger = function (win, updateCallback) {
    var currentBrowserMM;
    var windowMM = win.messageManager;

    // Called by content script of active tab
    // Message contains data to update icon/UI
    var onUpdateUIMessage = function (message) {
        log("messanger:onUpdateUIMessage: data: " + message.data, 1);
        var data = JSON.parse(message.data);
        if (data) {
            updateCallback(data);
        }
    };

    var onTabSelect = function (evt) {
        log("messanger:onTabSelect", 1);
        subscribeToBrowser(win.gBrowser.getBrowserForTab(evt.target));
        requestUpdate();
    };
    var onTabOpen = function (evt) {
        log("messanger:onTabOpen", 1);
        subscribeToBrowser(win.gBrowser.getBrowserForTab(evt.target));
        requestUpdate();
    };

    var onContentScriptLoaded = function (message) {
        log("messanger:onContentScriptLoaded, id: " + message.data.id, 1);
        subscribeToCurrentBrowser();
    };

    var subscribeToCurrentBrowser = function () {
        subscribeToBrowser(win.gBrowser.mCurrentBrowser);// TODO use selectedBrowser?
    };

    var unsubscribe = function () {
        if (currentBrowserMM) {
            currentBrowserMM.removeMessageListener("sixornot@baldock.me:update-ui", onUpdateUIMessage);
        }
    };

    var subscribeToBrowser = function (browser) {
        unsubscribe();
        currentBrowserMM = browser.messageManager;
        currentBrowserMM.addMessageListener("sixornot@baldock.me:update-ui", onUpdateUIMessage);
    };

    // Ask active content script to send us an update, e.g. when switching tabs
    var requestUpdate = function () {
        currentBrowserMM.sendAsyncMessage("sixornot@baldock.me:update-ui");
    };

    /* TabOpen event gets fired with a blank <browser>, and the page gets loaded into
     * a different one. Detect initialisation of content script loaded into <browser>s
     * and ensure we are pointed at the correct one to update the UI */
    windowMM.addMessageListener("sixornot@baldock.me:content-script-loaded", onContentScriptLoaded);

    win.gBrowser.tabContainer.addEventListener("TabOpen", onTabOpen, false);
    win.gBrowser.tabContainer.addEventListener("TabSelect", onTabSelect, false);

    subscribeToCurrentBrowser();
    requestUpdate();

    return {
        subscribeToCurrentBrowser: subscribeToCurrentBrowser,
        unsubscribe: unsubscribe,
        subscribeToBrowser: subscribeToBrowser,
        requestUpdate: requestUpdate,
        shutdown: function () {
            windowMM.removeMessageListener("sixornot@baldock.me:content-script-loaded", onContentScriptLoaded);
            unsubscribe();
            win.gBrowser.tabContainer.removeEventListener("TabOpen", onTabOpen, false);
            win.gBrowser.tabContainer.removeEventListener("TabSelect", onTabSelect, false);
        }
    };
};

