
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/utility.jsm");
Components.utils.import("resource://sixornot/includes/locale.jsm");
Components.utils.import("resource://sixornot/includes/prefs.jsm");
Components.utils.import("resource://sixornot/includes/windowwatcher.jsm");
Components.utils.import("resource://sixornot/includes/panel.jsm");

var EXPORTED_SYMBOLS = ["createWidget"];

// Create widget which handles shared logic between button/addressbar icon
var createWidget = function (node, win) {
    var panel, updateIconForNode,
        onClick, onTabSelect, onTabOpen,
        onContentScriptLoaded, onPageShow;

    var updateGreyscale = function () {
        if (prefs.get_bool("greyscaleicons")) {
            add_greyscale_class_to_node(node);
        } else {
            remove_greyscale_class_from_node(node);
        }
    };

    // TODO - split all the MM stuff out into its own object

    // Called by content script of active tab
    // Message contains data to update icon/UI
    var onUpdateUIMessage = function (message) {
        log("gui onUpdateUIMessage: data: " + message.data, 0);
        var data = JSON.parse(message.data);
        if (data) {
            updateIconForNode(data, node);
        }
    };

    onContentScriptLoaded = function (message) {
        log("onContentScriptLoaded, id: " + message.data.id, 1);
        subscribeToCurrentBrowser();
    };

    var currentBrowserMM;
    var windowMM = win.messageManager;

    /* TabOpen event gets fired with a blank <browser>, and the page gets loaded into
     * a different one. Detect initialisation of content script loaded into <browser>s
     * and ensure we are pointed at the correct one to update the UI */
    windowMM.addMessageListener("sixornot@baldock.me:content-script-loaded", onContentScriptLoaded);

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


    // Change icon via class (icon set via stylesheet)
    updateIconForNode = function (data, node) {
        if (data.main === "") {
            // No matching entry for main host (probably a local file)
            remove_sixornot_classes_from(node);
            add_class_to_node("sixornot_other", node);
        } else {
            var mainHost = data.entries.find(function (element, index, array) {
                return element.host === data.main;
            });
            //log("mainHost: " + JSON.stringify(mainHost), 1);
            update_node_icon_for_host(node, mainHost);
        }
    };

    onClick = function () {
        panel.setAttribute("hidden", false);
        panel.openPopup(node, panel.getAttribute("position"), 0, 0, false, false);
    };

    onTabSelect = function (evt) {
        log("widget:onTabSelect", 1);
        subscribeToBrowser(win.gBrowser.getBrowserForTab(evt.target));
        requestUpdate();
    };
    onTabOpen = function (evt) {
        log("widget:onTabOpen", 1);
        subscribeToBrowser(win.gBrowser.getBrowserForTab(evt.target));
        requestUpdate();
    };

    // TODO do we still need pageshow?
    onPageShow = function (evt) {
        log("widget:onPageShow", 1);
        subscribeToCurrentBrowser();
        requestUpdate();
    };

    /* Create a panel to show details when clicked */
    panel = createPanel(win, node.id + "-panel");
    node.appendChild(panel);

    // Update greyscale property + icon
    updateGreyscale();

    // Ensure tab ID is set upon loading into window
    subscribeToCurrentBrowser();
    requestUpdate();

    /* Add event listeners */
    node.addEventListener("click", onClick, false);
    win.gBrowser.tabContainer.addEventListener("TabOpen", onTabOpen, false);
    win.gBrowser.tabContainer.addEventListener("TabSelect", onTabSelect, false);
    win.gBrowser.addEventListener("pageshow", onPageShow, false);
    var greyscaleObserver = prefs.createObserver("extensions.sixornot.greyscaleicons",
                                                  updateGreyscale).register();

    unload(function () {
        log("widget unload function", 2);
        greyscaleObserver.unregister();
        /* Clear messageManager subscriptions */
        windowMM.removeMessageListener("sixornot@baldock.me:content-script-loaded", onContentScriptLoaded);
        unsubscribe();
        /* Clear event handlers */
        node.removeEventListener("click", onClick, false);
        win.gBrowser.tabContainer.removeEventListener("TabOpen", onTabOpen, false);
        win.gBrowser.tabContainer.removeEventListener("TabSelect", onTabSelect, false);
        win.gBrowser.removeEventListener("pageshow", onPageShow, false);
    }, win);
};
