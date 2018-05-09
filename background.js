/*
 *
 */

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
      if (item[setting]) {
        callback(JSON.parse(item[setting]));
      }
    },
    error => {
      console.log(`SixOrNot:background.js - subscribeToSetting: unable to retrieve setting on init: '${setting}', error: ${error}`);
    }
  );

  browser.storage.onChanged.addListener(changes => {
    var changedItems = Object.keys(changes);

    for (var item of changedItems) {
      if (item === setting) {
        callback(JSON.parse(changes[item].newValue));
      }
    }
  });
}

function mapToString (map) {
  var pairs = [];
  map.forEach((value, key, map) => {
    pairs.push(`${key}: ${value}`);
  });
  return pairs.join(', ');
}

function IPAddress (ip, fromCache = false, trr = false) {
  this.trr = trr;

  if (fromCache) {
    this.type = 2;
    this.address = 'cache';
  } else if (!ip) {
    this.type = 1;
    this.address = 'unknown';
  } else if (ip.indexOf(':') === -1) {
    this.type = 4;
    this.address = ip;
  } else {
    this.type = 6;
    this.address = ip;
  }
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

var DNS_pending = 0,
    DNS_started = 1,
    DNS_done = 2;

function Host (details) {
  var url = new URL(details.url);


  if (details.redirectUrl) {
    var newUrl = new URL(details.redirectUrl);
    this.newHostname = newUrl.hostname;
  }

  this.hostname = url.hostname;
  this.proxyInfo = new ProxyInfo(details.proxyInfo);
  this.retrievedFrom = [new IPAddress(details.ip, details.fromCache)];
  this.dnsIPs = [];
  this.trr = false;
  this.connectionCount = 1;
  this.status = this.getStatus();
  this.dnsStage = DNS_pending;
}

Host.prototype.updateFrom = function (other) {
  if (other.hostname !== this.hostname) { return; }

  // On redirect, update existing hostname
  if (other.newHostname) {
    this.hostname = other.newHostname;
    //console.log('redirect');
    this.dnsLookup();
  }

  this.connectionCount += 1;
  this.proxyInfo = other.proxyInfo;
  this.trr = other.trr;

  other.retrievedFrom.forEach(x => {
    var exists = false;
    this.retrievedFrom.forEach(y => {
      if (x.address === y.address) {
        exists = true;
      }
    });
    if (!exists) {
      this.retrievedFrom.push(x);
    }
  });

  this.status = this.getStatus();
};

Host.prototype.dnsLookup = function (success) {
  if (this.dnsStage !== DNS_pending) { return; }

  if (browser.dns
   && this.retrievedFrom.some(x => x.type === 2 || x.type === 4)
   && this.proxyInfo.type !== 'http'
   && this.proxyInfo.type !== 'https'
   && !this.proxyInfo.resolveDNS) {
    this.dnsStage = DNS_started;
    browser.dns.resolve(this.hostname, []).then(
      response => {
        //console.log(`host: ${this.hostname}, addresses: ${response.addresses}, isTRR: ${response.isTRR}`);
        this.dnsIPs = response.addresses.map(a => new IPAddress(a, false, response.isTRR));

        this.trr = response.isTRR;
        this.status = this.getStatus();
        this.dnsStage = DNS_done;

        wantsUpdate = true;
        success();
      },
      error => {
        console.log(`SixOrNot DNS error: ${error}`);
        this.dnsStage = DNS_pending;
      }
    );
  } else {
    //console.log('skipping dns');
  }
};

Host.prototype.getStatus = function () {
  if (this.proxyInfo && (this.proxyInfo.type === 'http' || this.proxyInfo.type === 'https')) {
      return 'proxy';
  }

  if (this.retrievedFrom.length === 0) { return 'other'; }

  var bestType = this.retrievedFrom.reduce((accumulator, current) => {
    return Math.max(accumulator, current.type);
  }, 0);

  var hasIPv6DNS = this.dnsIPs.some(ip => ip.type === 6);
  var hasIPv4DNS = this.dnsIPs.some(ip => ip.type === 4);

  if (bestType === 6) {
    if (!hasIPv4DNS && hasIPv6DNS) {
      // Actual is v6, DNS is v6 -> Blue
      return '6only';
    } else {
      // Actual is v6, DNS is v4 + v6 (or not completed) -> Green
      return '6and4';
    }
  } else if (bestType === 4) {
    if (hasIPv6DNS) {
      // Actual is v4, DNS is v4 + v6 -> Orange
      return '4pot6';
    } else {
      // Actual is v4, DNS is v4 (or not completed) -> Red
      return '4only';
    }
  } else if (bestType === 2) {
    // address type 2 is cached responses
    if (!hasIPv6DNS) {
      if (!hasIPv4DNS) {
        // No addresses, grey cache icon
        return 'other_cache';
      } else {
        // Only v4 addresses from DNS, red cache icon
        return '4only_cache';
      }
    } else {
      if (!hasIPv4DNS) {
        // Only v6 addresses from DNS, blue cache icon
        return '6only_cache';
      } else {
        // Both kinds of addresses from DNS, yellow cache icon
        return '4pot6_cache';
      }
    }
  } else if (bestType === 1) {
    return 'other';
  } else if (bestType === 0) {
    // This indicates that no addresses were available but request is not cached
    return 'error';
  }
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

    //console.log(`updating pageAction for tabId: ${details.tabId}`);
    browser.pageAction.setIcon({
      path: {
        16: `images/16/${iconset}/${status}.png`,
        32: `images/32/${iconset}/${status}.png`
      },
      tabId: self.tabId
    });

    if (addressicon) {
      browser.pageAction.show(details.tabId);
    } else {
      browser.pageAction.hide(details.tabId);
    }

    browser.browserAction.setIcon({
      path: {
        16: `images/16/${iconset}/${status}.png`,
        32: `images/32/${iconset}/${status}.png`
      },
      tabId: self.tabId
    });
  };

  self.mainHost = new Host({ url: details.url });
  self.hosts = {};
  self.hostCount = 0;

  self.update = function (host) {
    if (!host.hostname) { return; }

    // Add or update host
    if (host.hostname === self.mainHost.hostname) {
      // Update mainHost
      self.mainHost.updateFrom(host);
      self.mainHost.dnsLookup(self.updateButtons);
    } else if (!host.newHostname) {
      // Ignore redirects for non-main host for now TODO
      if (self.hosts[host.hostname]) {
        // Update host
        self.hosts[host.hostname].updateFrom(host);
      } else {
        // Add host
        self.hosts[host.hostname] = host;
        self.hosts[host.hostname].dnsLookup();
      }
    }
  };
}

function PageTracker () {
  var self = this;
  self.pageForTab = new Map();

  function nonTabRequest (tabId) {
    return tabId === -1;
  }
  function subFrame (frameId) {
    return frameId !== 0;
  }

  /*
   * Serialise Page to send to popup
   */
  self.getJSON = tabId => {
    var page = self.pageForTab.get(tabId);
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
    self.pageForTab.forEach((value, key, map) => {
      value.updateButtons();
    });
  });

  /*
   * Clean up Page for removed tabs
   */
  browser.tabs.onRemoved.addListener(tabId => {
    self.pageForTab.delete(tabId);
  });

  /*
   * Ensure that our pageAction is visible when creating a new tab
   */
  browser.tabs.onCreated.addListener(tabInfo => {
    if (addressicon) {
      browser.pageAction.show(tabInfo.id);
    }
  });

  /*
   * Ensure that our pageAction is visible whenever switching tabs
   */
  browser.tabs.onActivated.addListener(activeInfo => {
    if (addressicon) {
      browser.pageAction.show(activeInfo.tabId);
    }
  });

  /*
   * This event (with zero frameId) indicates a new page loaded into tab
   * Set up a new Page for the given tabId to associated future requests with
   */
  browser.webNavigation.onBeforeNavigate.addListener(details => {
    if (subFrame(details.frameId)) { return; }

    //console.log(`pageTracker: onBeforeNavigate, tabId: ${details.tabId}, windowId: ${details.windowId}`);
    self.pageForTab.set(details.tabId, new Page(details));
    wantsNew = true;
  });

  /*
   * Associate each request when it starts with current Page for the tab
   */
  browser.webRequest.onBeforeRequest.addListener(
    details => {
      //console.log(`onBeforeRequest for tabId: ${details.tabId}, requestId: ${details.requestId}`);
      if (nonTabRequest(details.tabId)) { return; }
      if (self.pageForTab.has(details.tabId)) {
        self.pageForTab.get(details.tabId).requestIds.set(details.requestId, true);
      }
    },
    { urls: ['<all_urls>'] }
  );

  /*
   * Update associated Page for each completed request
   * Ignore requests which haven't been previously associated,
   * or are associated with a defunct Page
   */
  browser.webRequest.onCompleted.addListener(
    details => {
      //console.log(`onCompleted for tabId: ${details.tabId}, requestId: ${details.requestId}, url: ${details.url}`);
      if (nonTabRequest(details.tabId)) { return; }

      var page = self.pageForTab.get(details.tabId);
      if (page && page.requestIds.has(details.requestId)) {
        //console.log(`requestIds: '{ ${mapToString(page.requestIds)} }', requestId: '${details.requestId}'`);

        page.update(new Host(details));
        wantsUpdate = true;
        page.requestIds.delete(details.requestId);
      }
    },
    { urls: ['<all_urls>'] }
  );

  /*
   * Requests can be redirected, if so the main hostname can change
   * For now, just update mainHost name
   * TODO - handle and show in UI details of redirections
   * e.g. google.com -> www.google.co.uk
   */
  browser.webRequest.onBeforeRedirect.addListener(
    details => {
      //console.log(`onBeforeRedirect for tabId: ${details.tabId}, requestId: ${details.requestId}, url: ${details.url}, redirectUrl: ${details.redirectUrl}`);
      if (nonTabRequest(details.tabId)) { return; }

      var page = self.pageForTab.get(details.tabId);
      if (page && page.requestIds.has(details.requestId)) {
        page.update(new Host(details));
        wantsUpdate = true;
      }
    },
    { urls: ['<all_urls>'] }
  );

  /*
   * For requests that end in an error, clean up requestId
   */
  browser.webRequest.onErrorOccurred.addListener(
    details => {
      if (nonTabRequest(details.tabId)) { return; }

      var page = self.pageForTab.get(details.tabId);
      if (page && page.requestIds.has(details.requestId)) {
        page.requestIds.delete(details.requestId);
      }
    },
    { urls: ['<all_urls>'] }
  );
};


var pageTracker = new PageTracker();


browser.runtime.onConnect.addListener(port => {
  //console.log(`incoming connection from: ${port.name}`);
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
    //console.log(`Background received message, action: ${message.action}`);
    if (message.action === 'requestUpdate') {
      lastTabId = message.data.tabId;
      newForTab(lastTabId);
    }
  });
});

