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

/* Send updates to popup every Xms */
const sendTimeout = 50;
/* Set to true if popup update needed */
var wantsUpdate = false;
/* Set to true if popup regeneration needed (new page) */
var wantsNew = false;

/* Represent state of settings */
var greyscale = false;
var addressicon = false;

function subscribeToSetting (setting, callback) {
  browser.storage.local.get(setting).then(
    item => {
      if (item[key]) {
        callback(JSON.parse(item[setting]));
      }
    },
    error => {
      console.log(`subscribeToSetting: unable to retrieve setting on init: '${setting}'`);
    }
  );

  browser.storage.onChanged.addListener(changes => {
    var changedItems = Object.keys(changes);

    for (var item of changes) {
      if (item === setting) {
        callback(JSON.parse(changes[item].newValue));
      }
    }
  });
}

function DNSResolver (hostname) {
  // Perform DNS resolution for hostname
}

function IPAddress (ip, fromCache = false) {
  if (fromCache) {
    this.type = 2;
  } else if (!ip) {
    this.type = 1;
  } else if (ip.indexOf(":") === -1) {
    this.type = 4;
  } else {
    this.type = 6;
  }

  this.address = ip;
}

function ProxyInfo (proxyInfo) {
  if (proxyInfo) {
    this.host = proxyInfo.host;
    this.port = proxyInfo.port;
    this.type = proxyInfo.type;
    this.proxyDNS = proxyInfo.proxyDNS;
  } else {
    this.host = '';
    this.port = 0;
    this.type = 'none';
    this.proxyDNS = false;
  }
}

function Host (details) {
  var url = new URL(details.url);

  this.hostname = url.hostname;
  this.proxyInfo = new ProxyInfo(details.proxyInfo);
  this.mainIP = new IPAddress(details.ip, details.fromCache);
  this.dnsIPs = [];
  this.connectionCount = 1;
  this.status = this.getStatus();
}

Host.prototype.updateFrom = function (other) {
  console.log('updateFrom');
  if (other.hostname !== this.hostname) { return; }

  console.log(this.hostname);
  this.connectionCount += 1;
  this.proxyInfo = other.proxyInfo;
  if (!this.mainIP || this.mainIP.type < 4) {
    this.mainIP = other.mainIP;
  }
  this.status = this.getStatus();
};

Host.prototype.getStatus = function () {
  if (this.proxyInfo && (this.proxyInfo.type === "http" || this.proxyInfo.type === "https")) {
      return "proxy";
  }

  if (this.mainIP) {
    var hasIPv6DNS = this.dnsIPs.some(ip => ip.family === 6);
    var hasIPv4DNS = this.dnsIPs.some(ip => ip.family === 4);

    if (this.mainIP.type === 6) {
      if (!hasIPv4DNS && hasIPv6DNS) {
        // Actual is v6, DNS is v6 -> Blue
        return "6only";
      } else {
        // Actual is v6, DNS is v4 + v6 (or not completed) -> Green
        return "6and4";
      }
    } else if (this.mainIP.type === 4) {
      if (hasIPv6DNS) {
        // Actual is v4, DNS is v4 + v6 -> Orange
        return "4pot6";
      } else {
        // Actual is v4, DNS is v4 (or not completed) -> Red
        return "4only";
      }
    } else if (this.mainIP.type === 2) {
      // address family 2 is cached responses
      if (!hasIPv6DNS) {
        if (!hasIPv4DNS) {
          // No addresses, grey cache icon
          return "other_cache";
        } else {
          // Only v4 addresses from DNS, red cache icon
          return "4only_cache";
        }
      } else {
        if (!hasIPv4DNS) {
          // Only v6 addresses from DNS, blue cache icon
          return "6only_cache";
        } else {
          // Both kinds of addresses from DNS, yellow cache icon
          return "4pot6_cache";
        }
      }
    } else if (this.mainIP.type === 0) {
      // This indicates that no addresses were available but request is not cached
      return "error";
    }
  }
  return "other";
};

function Page (details) {
  var self = this;

  self.tabId = details.tabId;

  self.requestIds = new Map();

  self.updateButtons = function () {
    var status;
    if (!self.mainHost) {
      status = 'other';
    } else {
      status = self.mainHost.status;
    }
    var iconset = greyscale ? 'grey' : 'colour';

    browser.pageAction.setIcon({
      path: {
        16: `images/16/${iconset}/${status}.png`,
        32: `images/32/${iconset}/${status}.png`
      },
      tabId: self.tabId
    });
    browser.browserAction.setIcon({
      path: {
        16: `images/16/${iconset}/${status}.png`,
        32: `images/32/${iconset}/${status}.png`
      },
      tabId: self.tabId
    });
  }

  self.mainHost = new Host({ url: details.url });
  self.hosts = {};
  self.hostCount = 0;
  
  function triggerDNS (callback) {
    // Do DNS lookup here
    // if (self.mainIP.type !== 1
    //  && self.proxyInfo.type !== "http"
    //  && self.proxyInfo.type !== "https"
    //  && !self.proxyInfo.resolveDNS) {
    // dnsResolver.resolve(hostname, function (ips) {
    //   self.dnsIPs = ips;
    //   self.status = getStatus(self);
    //   callback();
    // };
    // }
    var dnsResult = {
      ips: []// TODO array of IPAddress objects
    };
    callback(dnsResult);
  }

  self.update = function (host) {
    if (!host.hostname) { return; }
    // Add or update host
    if (host.hostname === self.mainHost.hostname) {
      // Update mainHost
      self.mainHost.updateFrom(host);
      triggerDNS(dnsResult => {
        dnsIPs = dnsResult.ips;
      });
      self.updateButtons();
    } else if (self.hosts[host.hostname]) {
      // Update host
      self.hosts[host.hostname].updateFrom(host);
    } else {
      // Add host
      self.hosts[host.hostname] = host;
      triggerDNS(dnsResult => {
        self.hosts[host.hostname].dnsIPs = dnsResult.ips;
      });
    }
  };
}

function PageTracker () {
  var self = this;
  self.pageForTab = new Map();

  self.onBeforeRequest = details => {
    if (details.tabId === -1) { return; } // Ignore non-tab requests
    // Map requestId to tab's current page object
    // so that it'll be looked up there later on complete
    //console.log(`pageTracker: onBeforeRequest, details: ${JSON.stringify(details)}`);
    if (self.pageForTab[details.tabId]) {
      // Ignore requests without an associated page/preceeding onBeforeNavigate event
      self.pageForTab[details.tabId].requestIds[details.requestId] = true;
    } else {
      //console.log(`pageTracked: onBeforeRequest tabId ${details.tabId} not in self.pageForTab`);
    }
  };

  self.onComplete = details => {
    if (details.tabId === -1) { return; } // Ignore non-tab requests
    //console.log(`pageTracker: onComplete, tabId: ${details.tabId}`);
    // Look up page object based on earlier association
    // Update page model with new details
    var host = new Host(details);

    var page = self.pageForTab[details.tabId];
    // Ignore requests that aren't associated with an active tab page
    if (page && page.requestIds.has(details.requestId)) {
      page.update(host);
      wantsUpdate = true;
      page.requestIds.delete(details.requestId);
    }
  };

  self.onErrorOccurred = details => {
    if (details.tabId === -1) { return; } // Ignore non-tab requests

    var page = self.pageForTab[details.tabId];
    // Ignore requests that aren't associated with an active tab page
    if (page && page.requestIds.has(details.requestId)) {
      page.requestIds.delete(details.requestId);
    }
  };

  self.onBeforeNavigate = details => {
    if (details.frameId !== 0) { return; } // Ignore sub-frames
    // Start a new page for the given tabId
    // Subsequent associate calls will use this page
    console.log(`pageTracker: onBeforeNavigate, tabId: ${details.tabId}, windowId: ${details.windowId}`);
    self.pageForTab[details.tabId] = new Page(details);
    wantsNew = true;
  };

  self.getJSON = tabId => {
    var page = self.pageForTab[tabId];
    if (page) {
      return {
        mainHost: page.mainHost,
        hosts: Object.values(page.hosts)
      };
    } else {
      return {};
    }
    return send;
  };

  // Monitor settings
  subscribeToSetting('option_greyscale', newValue => {
    greyscale = newValue;
    self.pageForTab.forEach((value, key, map) => {
      value.updateButtons();
    });
  });
  subscribeToSetting('option_addressicon', newValue => {
    addressicon = newValue;
    browser.tabs.query({}).then(
      tabs => {
        tabs.forEach(tab => {
          if (addressicon) {
            browser.pageAction.show(tab.id);
          } else {
            browser.pageAction.hide(tab.id);
          }
        });
      },
      error => {
        console.log(`option_addressicon sub, tabs query error: ${error}`);
      }
    );
  });

  // Set up events
  browser.tabs.onCreated.addListener(tabInfo => {
    if (addressicon) {
      browser.pageAction.show(tabInfo.id);
    }
  });

  browser.tabs.onRemoved.addListener(tabId => {
    console.log(`pageTracker: removeTab, id: ${tabId}`);
    pageForTab.delete(tabId);
  });

  browser.tabs.onActivated.addListener(activeInfo => {
    if (addressicon) {
      browser.pageAction.show(activeInfo.tabId);
    }
  });

  browser.webNavigation.onBeforeNavigate.addListener(self.onBeforeNavigate);

  browser.webRequest.onBeforeRequest.addListener(
    self.onBeforeRequest,
    { urls: ["<all_urls>"] }
  );

  browser.webRequest.onCompleted.addListener(
    self.onComplete,
    { urls: ["<all_urls>"] }
  );

  browser.webRequest.onErrorOccurred.addListener(
    self.onErrorOccurred,
    { urls: ["<all_urls>"] }
  );
};

var pageTracker = new PageTracker();


browser.runtime.onConnect.addListener(port => {
  console.log(`incoming connection from: ${port.name}`);
  var timeoutId, lastTabId;

  function sendForTab (tabId) {
    port.postMessage({
      action: 'update',
      data: pageTracker.getJSON(tabId)
    });
  }

  function newForTab (tabId) {
    port.postMessage({
      action: 'new',
      data: pageTracker.getJSON(tabId)
    });
  }

  function updateIfNeeded () {
    if (lastTabId) {
      if (wantsNew) {
        newForTab(lastTabId);
        wantsUpdate = false;
        wantsNew = false;
      }
      if (wantsUpdate) {
        sendForTab(lastTabId);
        wantsUpdate = false;
      }
    }
    timeoutId = window.setTimeout(updateIfNeeded, sendTimeout);
  }

  updateIfNeeded();

  port.onDisconnect.addListener(disconnectingPort => {
    window.clearTimeout(timeoutId);
  });

  port.onMessage.addListener(message => {
    console.log(`Background received message, action: ${message.action}`);
    if (message.action === 'requestUpdate') {
      lastTabId = message.data.tabId;
      newForTab(lastTabId);
    }
  });
});

