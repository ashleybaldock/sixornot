/*
 * Copyright 2015 Timothy Baldock. All Rights Reserved.
 */

Components.utils.import("resource://gre/modules/Services.jsm");

/* exported getMessanger */
var EXPORTED_SYMBOLS = ["getMessanger"];

var getMessanger = function (win, updateCallback) {
    var currentBrowserMM;
    var windowMM = win.messageManager;

    // Called by content script of active tab
    // Message contains data to update icon/UI
    var onUpdateUIMessage = function (message) {
        var data = JSON.parse(message.data);
        if (data) {
            updateCallback(data);
        } else {
            updateCallback({main: "", entries: [], innerId: 0});
        }
    };

    var subscribeToBrowser = function (browser) {
        unsubscribe();
        currentBrowserMM = browser.messageManager;
        currentBrowserMM.addMessageListener("sixornot@baldock.me:update-ui", onUpdateUIMessage);
    };

    var subscribeToCurrentBrowser = function () {
    };

    var unsubscribe = function () {
        if (currentBrowserMM) {
            currentBrowserMM.removeMessageListener("sixornot@baldock.me:update-ui", onUpdateUIMessage);
        }
    };

    var requestUpdate = function () {
        if (currentBrowserMM) {
            currentBrowserMM.sendAsyncMessage("sixornot@baldock.me:update-ui");
        }
    };

    var onContentScriptLoaded = function (message) {
        subscribeToCurrentBrowser();
    };

    var onTabSelect = function (evt) {
        subscribeToBrowser(win.gBrowser.getBrowserForTab(evt.target));
        requestUpdate();
    };
    var onTabOpen = function (evt) {
        subscribeToBrowser(win.gBrowser.getBrowserForTab(evt.target));
        requestUpdate();
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
            win.gBrowser.tabContainer.removeEventListener("TabOpen", onTabOpen, false);
            win.gBrowser.tabContainer.removeEventListener("TabSelect", onTabSelect, false);
            unsubscribe();
            currentBrowserMM = null;
            windowMM = null;
        }
    };
};

