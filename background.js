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

function getStatusForHost (host) {
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

  // details.method;
  // details.statusCode;

  this.hostname = url.hostname;
  this.proxyInfo = new ProxyInfo(details.proxyInfo);
  if (details.ip || details.fromCache) {
    this.mainIP = new IPAddress(details.ip, details.fromCache);
  }
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
  if (!this.mainIP) {
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

// Encompasses information about all hosts contacted to load a page
function Page (details) {
  var self = this;

  self.tabId = details.tabId;

  function updateButtons () {
    var status;
    if (!self.mainHost) {
      status = 'other';
    } else {
      status = self.mainHost.status;
    }
    var iconSet = 'colour'; // TODO

    // Update the image URL for every tab so it's ready when switching
    // Automatically falls back to default icon if no specific one set
    // Could do the same thing for popup URL (add a ?tabId=X param)
    // but not sure we can get the params from URL in popup
    // plus it wouldn't update itself when active tab changes (or would it?)
    browser.pageAction.setIcon({
      path: {
        16: `images/${iconSet}/16/${status}.png`,
        32: `images/${iconSet}/32/${status}.png`
      },
      tabId: self.tabId
    });
    browser.browserAction.setIcon({
      path: {
        16: `images/${iconSet}/16/${status}.png`,
        32: `images/${iconSet}/32/${status}.png`
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
    // Add or update host
    if (host.hostname === self.mainHost.hostname) {
      // Update mainHost
      self.mainHost.updateFrom(host);
      triggerDNS(dnsResult => {
        dnsIPs = dnsResult.ips;
      });
      updateButtons();
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
  self.pageForTab = [];
  self.requestIds = [];

  self.onBeforeRequest = details => {
    if (details.tabId === -1) { return; } // Ignore non-tab requests
    // Map requestId to tab's current page object
    // so that it'll be looked up there later on complete
    //console.log(`pageTracker: onBeforeRequest, details: ${JSON.stringify(details)}`);
    if (self.pageForTab[details.tabId]) {
      // Ignore requests without an associated page/preceeding onBeforeNavigate event
      self.requestIds[details.requestId] = self.pageForTab[details.tabId];
    } else {
      //console.log(`pageTracked: onBeforeRequest tabId ${details.tabId} not in self.pageForTab`);
    }
  };

  self.onComplete = details => {
    if (details.tabId === -1) { return; } // Ignore
    //console.log(`pageTracker: onComplete, tabId: ${details.tabId}`);
    // Look up page object based on earlier association
    // Update page model with new details
    var host = new Host(details);

    var page = self.requestIds[details.requestId];
    if (page) {
      // Ignore requests without an associated page/preceeding onBeforeNavigate event
      page.update(host);
    }
    //self.requestIds.delete(requestId);//TODO
  };

  self.onBeforeNavigate = details => {
    if (details.frameId !== 0) { return; } // Ignore sub-frames
    // Start a new page for the given tabId
    // Subsequent associate calls will use this page
    console.log(`pageTracker: onBeforeNavigate, tabId: ${details.tabId}, windowId: ${details.windowId}`);
    self.pageForTab[details.tabId] = new Page(details);
  };

  self.removeTab = tabId => {
    console.log(`pageTracker: removeTab, id: ${tabId}`);
    // Clean up cached data for tab
    // TODO
  };

  self.getJSON = tabId => {
    var page = self.pageForTab[tabId];
    var send = {
      mainHost: page.mainHost,
      hosts: Object.values(page.hosts)
    };
    return send;
  };

  // Set up events
  browser.tabs.onCreated.addListener(tabInfo => {
    browser.pageAction.show(tabInfo.id);
  });
  browser.tabs.onRemoved.addListener(self.removeTab);

  browser.tabs.onActivated.addListener(activeInfo => {
    browser.pageAction.show(activeInfo.tabId);
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
};

var pageTracker = new PageTracker();


browser.runtime.onConnect.addListener(port => {
  console.log(`incoming connection from: ${port.name}`);

  function sendForTab (tabId) {
    port.postMessage({
      action: 'update',
      data: pageTracker.getJSON(tabId)
    });
  }

  port.onMessage.addListener(message => {
    console.log(`Background received message, action: ${message.action}`);
    if (message.action === 'requestUpdate') {
      sendForTab(message.data.tabId);
    }
  });
});

