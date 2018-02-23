// Can have multiples of this
// All run in the same context (as if in the same webpage)
//
// One central object to keep track of current state of addon
//  - DNS requests in-flight
//  - Listing of requests per-page etc.
//
//  Also listen to webrequest events here
//
//
//


function onRequestCompleted (details) {
  details.frameId; // 0 = main frame
  details.parentFrameId;
  details.tabId; // -1 = unrelated to tab
}


var pageTracker = function () {
  var tabs = [];
  var requestIds = [];

  return {
    associate: function (details) {
      // Map requestId to tab's current page object
      // so that it'll be looked up there later on complete
      requestIds[details.requestId] = tabs[details.tabId];//TODO create if doesn't exist
    },
    complete: function (details) {
      // Look up page object based on earlier association
      // Update page model with new details
      details.url;
      details.proxyInfo;
      details.fromCache;
      details.ip;
      details.method;
      details.statusCode;

      var page = requestIds[details.requestId];
      page.update(details);
      //requestIds.delete(requestId);//TODO
    },
    newPage: function (details) {
      // Start a new page for the given tabId
      // Subsequent associate calls will use this page
      var page = new Page();
      tabs[details.tabId] = page;
    },
    removeTab: function (tabId) {
      // Clean up cached data for tab
    },
    setActiveTab: function (activeInfo) {
      // Trigger event update for popups/icons
    }
  };
}();

browser.tabs.onRemoved.addListener(
  function (tabId) {
    pageTracker.removeTab(tabId);
  }
);

browser.tabs.onActivated.addListener(
  function (activeInfo) {
    activeInfo.tabId;
    activeInfo.windowId;
    pageTracker.setActiveTab(activeInfo);
  }
);

browser.webNavigation.onBeforeNavigate.addListener(
  function (details) {
    pageTracker.newPage(details);
  }
);

browser.webRequest.onBeforeRequest.addListener(
  function (details) {
    pageTracker.associate(details);
  },
  {urls: ["<all_urls>"]}
);

browser.webRequest.onCompleted.addListener(
  function (details) {
    var tabId = details.tabId;
    var requestId = details.requestId;

    pageTracker.complete(details);
  },
  {urls: ["<all_urls>"]}
);
