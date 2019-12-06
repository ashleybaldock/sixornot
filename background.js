/* Send updates to popup every Xms */
const sendTimeout = 100;
/* Set to true if popup update needed */
let wantsUpdate = false;
/* Set to true if popup regeneration needed (new page) */
let wantsNew = false;

/* Represent state of settings */
let greyscale = false;
let addressicon = false;

const subscribeToSetting = (setting, callback) => {
  browser.storage.local.get(setting).then(
    item => {
      if (item[setting]) {
        callback(JSON.parse(item[setting]));
      }
    },
    error => {
      console.error(`SixOrNot:background.js - subscribeToSetting: unable to retrieve setting on init: '${setting}', error: ${error}`);
    }
  );

  browser.storage.onChanged.addListener(changes => {
    let changedItems = Object.keys(changes);

    for (let item of changedItems) {
      if (item === setting) {
        callback(JSON.parse(changes[item].newValue));
      }
    }
  });
}

const getStatus = (proxyInfo, retrievedFrom, dnsIPs) => {
  if (proxyInfo && (proxyInfo.type === 'http' || proxyInfo.type === 'https')) {
    return 'proxy';
  }

  if (retrievedFrom.length === 0) { return 'other'; }

  let bestType = retrievedFrom.reduce((accumulator, current) => {
    return Math.max(accumulator, current.type);
  }, 0);

  let hasIPv6DNS = dnsIPs.some(ip => ip.type === 6);
  let hasIPv4DNS = dnsIPs.some(ip => ip.type === 4);

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
  } else {
    // This indicates that no addresses were available but request is not cached
    return 'error';
  }
};

const newIPAddress = (ip, fromCache = false, trr = false) => {
  const address = {
    trr,
    type: 1,
    address: 'unknown',
  };

  if (fromCache) {
    address.type = 2;
    address.address = 'cache';
  }
  if (ip) {
    if (ip.indexOf(':') === -1) {
      address.type = 4;
      address.address = ip;
    } else {
      address.type = 6;
      address.address = ip;
    }
  }

  return address;
};

const newProxyInfo = (proxyInfo) => {
  if (proxyInfo) {
    return {
      host: proxyInfo.host,
      port: proxyInfo.port,
      type: proxyInfo.type,
      proxyDNS: proxyInfo.proxyDNS,
    };
  } else {
    return {
      host: '',
      port: 0,
      type: 'none',
      proxyDNS: false,
    };
  }
};

const newSecurityInfo = (securityInfo) => ({
  certificateTransparencyStatus: undefined,
  cipherSuite: undefined,
  errorMessage: undefined,
  hpkp: undefined,
  hsts: undefined,
  isDomainMismatch: undefined,
  isExtendedValidation: undefined,
  isNotValidAtThisTime: undefined,
  isUntrusted: undefined,
  keaGroupName: undefined,
  protocolVersion: undefined,
  signatureSchemeName: undefined,
  state: undefined,
  weaknessReasons: undefined,
  ...securityInfo,
  certificates: securityInfo && securityInfo.certificates ? securityInfo.certificates.map((certificate) => ({
    ...certificate,
    fingerprint: { ...certificate.fingerprint },
    subjectPublicKeyInfoDigest: { ...certificate.subjectPublicKeyInfoDigest },
    validity: { ...certificate.validity },
  })) : {},
});

const updateButtons = (tabId, status = 'other') => {
  const iconset = greyscale ? 'grey' : 'colour';

  //console.log(`updating pageAction for tabId: ${tabId}, status: ${status}`);
  browser.pageAction.setIcon({
    path: {
      16: `images/16/${iconset}/${status}.png`,
      32: `images/32/${iconset}/${status}.png`
    },
    tabId
  });

  if (addressicon) {
    browser.pageAction.show(tabId);
  } else {
    browser.pageAction.hide(tabId);
  }

  browser.browserAction.setIcon({
    path: {
      16: `images/16/${iconset}/${status}.png`,
      32: `images/32/${iconset}/${status}.png`
    },
    tabId
  });
};

const DNS_pending = 0,
    DNS_started = 1,
    DNS_done = 2;

const newHost = (details) => {
  let hostname = undefined;
  let proxyInfo = undefined;
  let securityInfo = undefined;
  let connectionCount = -1;
  let retrievedFrom = [];
  let dnsIPs = [];
  let dnsStage = DNS_pending;
  let trr = false;
  let status = 'other';

  const toObject = () => ({
    hostname,
    proxyInfo,
    securityInfo,
    connectionCount,
    retrievedFrom,
    dnsIPs,
    dnsStage,
    trr,
    status,
  });

  const dnsLookup = (success) => {
    if (dnsStage !== DNS_pending
     || !browser.dns
     || !retrievedFrom.some(x => x.type === 2 || x.type === 4 || x.type === 6)
     || proxyInfo.type === 'http'
     || proxyInfo.type === 'https'
     || proxyInfo.resolveDNS) {
      return;
    }
    // console.log('performing DNS lookup');
    dnsStage = DNS_started;
    browser.dns.resolve(hostname, []).then(
      response => {
        //console.log(`host: ${hostname}, addresses: ${response.addresses}, isTRR: ${response.isTRR}`);
        dnsIPs = response.addresses.map(a => newIPAddress(a, false, response.isTRR));

        trr = response.isTRR;
        status = getStatus(proxyInfo, retrievedFrom, dnsIPs);
        dnsStage = DNS_done;

        wantsUpdate = true;
        success && success();
      },
      error => {
        console.log(`SixOrNot DNS error: ${error} for lookup of hostname: ${hostname}`);
        dnsStage = DNS_pending;
      }
    );
  };

  const updateFrom = (newDetails) => {
    const newHostname = new URL(newDetails.url).hostname;
    if (hostname !== undefined && newHostname !== hostname) { return; }
    hostname = newHostname;
    connectionCount += 1;
    proxyInfo = newProxyInfo(newDetails.proxyInfo);

    const newAddress = newIPAddress(newDetails.ip, newDetails.fromCache);
    if (!retrievedFrom.some(({ address }) => address === newAddress.address)) {
      retrievedFrom.push(newAddress);
    }

    status = getStatus(proxyInfo, retrievedFrom, dnsIPs);

    dnsLookup();
  };

  const updateSecurityFrom = (updatedSecurityInfo) =>
    (securityInfo) = newSecurityInfo(updatedSecurityInfo);

  updateFrom(details);

  return {
    updateFrom,
    updateSecurityFrom,
    toObject,
    getStatus: () => status,
  };
};

const newPage = (details) => {
  const tabId = details.tabId;
  const requestIds = new Map();
  const hosts = new Map();

  let mainHostname = new URL(details.url).hostname;
  hosts.set(mainHostname, newHost({ url: details.url }));

  const addRequestToPage = (requestId, url) => {
    const hostname = new URL(url).hostname;
    requestIds.set(requestId, hostname);

    if (!hosts.has(hostname)) {
      hosts.set(hostname, newHost({ url }));
    }
  };

  const updateSecurityInfo = (requestId, newSecurityInfo) => {
    if (!requestIds.has(requestId)) { return; }

    if (hosts.has(requestIds.get(requestId))) {
      hosts.get(requestIds.get(requestId)).updateSecurityFrom(newSecurityInfo);
      wantsUpdate = true;
    }
  };

  const updateOnComplete = (requestId, newDetails) => {
    if (!requestIds.has(requestId)) { return; }

    const hostname = new URL(newDetails.url).hostname;
    if (hosts.has(hostname)) {
      // Update host
      hosts.get(hostname).updateFrom(newDetails);

      // Update button display when mainhost info changes
      if (hostname === mainHostname) {
        updateButtons(tabId, hosts.get(mainHostname).getStatus());
      }

      wantsUpdate = true;
    }
  };

  const updateOnRedirect = (requestId, newDetails) => {
    if (!requestIds.has(requestId)) { return; }

    const fromHostname = new URL(newDetails.url).hostname;
    const toHostname = new URL(newDetails.redirectUrl).hostname;

    if (hosts.has(fromHostname)) {
      // Update host
      hosts.get(fromHostname).updateFrom(newDetails);
    }

    if (!hosts.has(toHostname)) {
      hosts.set(toHostname, newHost({ ...newDetails, url: newDetails.redirectUrl }));
    }

    // If hostname matches main, change main hostname
    if (fromHostname === mainHostname) {
      mainHostname = toHostname;

      updateButtons(tabId, hosts.get(mainHostname).getStatus());
    }

    wantsUpdate = true;
  };

  const toObject = () => ({ mainHostname: mainHostname, hosts: Array.from(hosts, ([key, value]) => value.toObject()) });

  return {
    addRequestToPage,
    updateSecurityInfo,
    updateOnComplete,
    updateOnRedirect,
    updateButtons: () => updateButtons(tabId, hosts.get(mainHostname).getStatus()),
    toObject,
  };
}

const pageTracker = (() => {
  const tabIdToPageMap = new Map();

  const nonTabRequest = (tabId) => tabId === -1;

  const fakeRequest = (requestId) => requestId.startsWith('fakeRequest');

  const subFrame = (frameId) => frameId !== 0;

  /*
   * Serialise Page to send to popup
   */
  const toObject = (tabId) => tabIdToPageMap.has(tabId) ? tabIdToPageMap.get(tabId).toObject() : {}; 

  // Monitor settings
  subscribeToSetting('option_greyscale', newValue => {
    greyscale = newValue;
    tabIdToPageMap.forEach((page) => {
      page.updateButtons();
    });
  });
  subscribeToSetting('option_addressicon', newValue => {
    addressicon = newValue;
    tabIdToPageMap.forEach((page) => {
      page.updateButtons();
    });
  });

  /*
   * Clean up Page for removed tabs
   */
  browser.tabs.onRemoved.addListener(tabId => {
    tabIdToPageMap.delete(tabId);
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
  browser.webNavigation.onBeforeNavigate.addListener(
    (details) => {
      // console.log('onBeforeNavigate');
      // console.log(details);
      if (subFrame(details.frameId)) { return; }

      // console.log(`pageTracker: onBeforeNavigate, tabId: ${details.tabId}, windowId: ${details.windowId}`);
      tabIdToPageMap.set(details.tabId, newPage(details));
      wantsNew = true;
  });

  /*
   * Associate each request when it starts with current Page for the tab
   */
  browser.webRequest.onBeforeRequest.addListener(
    ({ tabId, requestId, url }) => {
      if (nonTabRequest(tabId) || fakeRequest(requestId)) { return; }
      // console.log(`onBeforeRequest for tabId: ${details.tabId}, requestId: ${details.requestId}`);
      // console.log(details);
      if (tabIdToPageMap.has(tabId)) {
        // tabIdToPageMap.get(details.tabId).requestIds.set(details.requestId, true);
        tabIdToPageMap.get(tabId).addRequestToPage(requestId, url);
      }
    },
    { urls: ['<all_urls>'] }
  );

  /*
   * Get security info for connections
   */
  browser.webRequest.onHeadersReceived.addListener(
    ({ tabId, requestId }) => {
      if (nonTabRequest(tabId) || fakeRequest(requestId)) { return; }

      browser.webRequest.getSecurityInfo(requestId, {}).then((securityInfo) => {
        // console.log(securityInfo);
        if (tabIdToPageMap.has(tabId)) {
          tabIdToPageMap.get(tabId).updateSecurityInfo(requestId, securityInfo);
        }
      }).catch((e) => console.error(e));
    },
    { urls: ['<all_urls>'] },
    ['blocking']
  );

  /*
   * Requests can be redirected, if so the main hostname can change
   * For now, just update mainHost name
   * TODO - handle and show in UI details of redirections
   * e.g. google.com -> www.google.co.uk
   */
  browser.webRequest.onBeforeRedirect.addListener(
    (details) => {
      //console.log(`onBeforeRedirect for tabId: ${details.tabId}, requestId: ${details.requestId}, url: ${details.url}, redirectUrl: ${details.redirectUrl}`);
      if (nonTabRequest(details.tabId) || fakeRequest(details.requestId)) { return; }

      if (tabIdToPageMap.has(details.tabId)) {
        tabIdToPageMap.get(details.tabId).updateOnRedirect(details.requestId, details);
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
    (details) => {
      if (nonTabRequest(details.tabId) || fakeRequest(details.requestId)) { return; }
      // console.log(`onCompleted for tabId: ${details.tabId}, requestId: ${details.requestId}, url: ${details.url}`);

      if (tabIdToPageMap.has(details.tabId)) {
        tabIdToPageMap.get(details.tabId).updateOnComplete(details.requestId, details);
      }
    },
    { urls: ['<all_urls>'] }
  );

  /*
   * For requests that end in an error, clean up requestId
   */
  browser.webRequest.onErrorOccurred.addListener(
    details => {
      if (nonTabRequest(details.tabId) || fakeRequest(details.requestId)) { return; }

      if (tabIdToPageMap.has(details.tabId)) {
        tabIdToPageMap.get(details.tabId).updateOnComplete(details.requestId, details);
      }
    },
    { urls: ['<all_urls>'] }
  );

  return {
    toObject,
  };
})();

browser.runtime.onConnect.addListener((port) => {
  //console.log(`incoming connection from: ${port.name}`);
  let timeoutId, lastTabId;

  const sendForTab = (tabId) =>
    port.postMessage({
      action: 'update',
      data: pageTracker.toObject(tabId)
    });

  const newForTab = (tabId) =>
    port.postMessage({
      action: 'new',
      data: pageTracker.toObject(tabId)
    });

  const updateIfNeeded = () => {
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
  };

  updateIfNeeded();

  port.onDisconnect.addListener((disconnectingPort) => window.clearTimeout(timeoutId));

  port.onMessage.addListener((message) => {
    //console.log(`Background received message, action: ${message.action}`);
    if (message.action === 'requestUpdate') {
      lastTabId = message.data.tabId;
      newForTab(lastTabId);
    }
  });
});

