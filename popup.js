/*
 *
 */

const copyToClipboard = text => {
  const el = document.getElementById('copy-from');
  el.value = text;
  el.select();
  document.execCommand('copy');
};

function IPViewModel (data, parent) {
  var self = this;
  self.parent = parent;

  self.type = ko.observable();

  ko.mapping.fromJS(data, {}, self);

  self.formattedAddress = ko.computed(() => {
    // Note: space character here needs to be a unicode nbsp!
    //return this.trr() ? `${this.address()} ⓣ` : `${this.address()}`;
    return self.address();
  });

  self.visible = ko.computed(() => {
    return self.parent.showingIPs() && !self.parent.retrievedFrom().some(e => {
      return e.address() === self.address();
    });
  });

  self.ttCopyAddress = ko.observable(browser.i18n.getMessage('ttCopyAddress'));
  self.copy = () => copyToClipboard(self.address());
}

function ProxyInfoViewModel (data, parent) {
  var self = this;
  self.parent = parent;

  self.type = ko.observable('none');
  self.port = ko.observable(0);
  self.host = ko.observable('');
  self.proxyDNS = ko.observable(false);

  ko.mapping.fromJS(data, {}, self);
}

function HostViewModel (data, parent, isMainHost = false) {
  var self = this;
  self.parent = parent;

  self.dnsIPs = ko.observableArray();

  var mapping = {
    'dnsIPs': {
      key: data => {
        ko.utils.unwrapObservable(data.address);
      },
      create: options => {
        return new IPViewModel(options.data, self);
      }
    },
    'retrievedFrom': {
      key: data => {
        ko.utils.unwrapObservable(data.address);
      },
      create: options => {
        return new IPViewModel(options.data, self);
      }
    },
    'proxyInfo': {
      create: options => {
        return new ProxyInfoViewModel(options.data, self);
      }
    }
  };

  ko.mapping.fromJS(data, mapping, self);

  self.from = ko.computed(() => {
    var filtered = self.retrievedFrom().filter(x => x.type() > 1);
    if (filtered.length > 0) {
      return filtered.sort((left, right) => {
        return left.type() === right.type() ? 0 : (left.type() < right.type() ? 1 : -1);
      }).map(x => {
        if (x.type() === 2) {
          return `${browser.i18n.getMessage('addrCached')}`;
        } else if (x.type() === 4 || x.type() === 6) {
          /*var fromDNS = this.dnsIPs().find(e => {
            return e.address() === x.address();
          });
          if (fromDNS) {
            return this.proxyInfo.type() === 'http' ? `(${fromDNS.formattedAddress()})` : fromDNS.formattedAddress();
          } else {
            return this.proxyInfo.type() === 'http' ? `(${x.address()})` : x.address();
          }*/
          return self.proxyInfo.type() === 'http' ? `(${x.address()})` : x.address();
        }
        return '';
      }).join(' / ');
    } else {
      return browser.i18n.getMessage('addrUnknown');
    }
  });

  self.ttStatus = ko.observable(
    browser.i18n.getMessage('ttStatus'));
  self.ttConnectionCount = ko.observable(
    browser.i18n.getMessage('ttConnectionCount'));
  self.ttTLSInfo = ko.observable('TLS Info');
  self.ttToggleIPs = ko.computed(() => {
    var length = self.dnsIPs().length;
    return length === 0 ? '' : self.showingIPs()
      ? browser.i18n.getMessage('ttHideDetail')
      : browser.i18n.getMessage('ttShowDetail');
  });

  self.statusPath = ko.computed(() => {
    var iconset = parent.greyscale() ? 'grey' : 'colour';
    return `images/16/${iconset}/${self.status()}.png`;
  });

  self.ttProxyInfo = ko.computed(() => {
    if (self.proxyInfo.type() === 'http') {
      return browser.i18n.getMessage('proxyBase', [
        browser.i18n.getMessage('proxyHTTP'),
        self.proxyInfo.host(),
        self.proxyInfo.port(),
        browser.i18n.getMessage('proxyLookupsDisabled')
      ]);
    } else if (self.proxyInfo.type() === 'https') {
      return browser.i18n.getMessage('proxyBase', [
        browser.i18n.getMessage('proxyHTTPS'),
        self.proxyInfo.host(),
        self.proxyInfo.port(),
        browser.i18n.getMessage('proxyLookupsDisabled')
      ]);
    } else if (self.proxyInfo.type() === 'socks4') {
      return browser.i18n.getMessage('proxyBase', [
        browser.i18n.getMessage('proxySOCKS4'),
        self.proxyInfo.host(),
        self.proxyInfo.port(),
        self.proxyInfo.proxyDNS() ? browser.i18n.getMessage('proxyLookupsDisabled') : ''
      ]);
    } else if (self.proxyInfo.type() === 'socks5') {
      return browser.i18n.getMessage('proxyBase', [
        browser.i18n.getMessage('proxySOCKS5'),
        self.proxyInfo.host(),
        self.proxyInfo.port(),
        self.proxyInfo.proxyDNS() ? browser.i18n.getMessage('proxyLookupsDisabled') : ''
      ]);
    } else {
      return '';
    }
  });
  self.proxyPath = ko.computed(() => {
    return self.proxyInfo.type() !== 'none'
      ? `images/16/proxy_on.png`
      : `images/16/proxy_off.png`;
  });

  self.ttTRRInfo = ko.computed(() => {
    return browser.i18n.getMessage('ttTRRInfo');
  });

  self.mainClass = ko.pureComputed(() => {
    return isMainHost ? 'main' : '';
  });

  self.showingIPs = ko.observable(isMainHost);

  self.togglerText = ko.computed(() => {
    var length = self.dnsIPs().filter(x => {
      return !self.retrievedFrom().some(y => y.address() === x.address());
    }).length;
    return length === 0 ? '' : self.showingIPs() ? '[ - ]' : `[+${length}]`;
  });

  self.formattedConnectionCount = ko.computed(() => {
    return `(${self.connectionCount()})`;
  });

  self.toggleIPs = () => {
    self.showingIPs(!self.showingIPs());
  };

  self.ttCopyAddress = ko.observable(browser.i18n.getMessage('ttCopyAddress'));
  self.copy = () => copyToClipboard(self.from());
  self.ttCopyAll = ko.observable(
    browser.i18n.getMessage('ttCopyAll'));
  self.copyAll = () => {
    var copyText = self.hostname();
    /*if (self.mainIP.address() !== '') {
      copyText += `,${self.mainIP.address()}`;
    }*/
    self.dnsIPs().forEach(ip => {
      copyText += `,${ip.address()}`;
    });
    copyToClipboard(copyText);
  };
}

function PopUpViewModel () {
  var self = this;

  self.hosts = ko.observableArray([]);

  self.mainHost = ko.observable();

  self.greyscale = ko.observable(false)
                     .extend({ subPersist: 'option_greyscale' });

  var mapping = {
    'hosts': {
      key: data => {
        return ko.utils.unwrapObservable(data.hostname);
      },
      create: options => {
        return new HostViewModel(options.data, self);
      }
    },
    'mainHost': {
      create: options => {
        return new HostViewModel(options.data, self, isMainHost = true);
      }
    }
  };

  self.header = ko.observable(
    browser.i18n.getMessage('extensionname'));

  self.ttDocumentationLink = ko.observable(
    browser.i18n.getMessage('ttDocumentationLink'));
  self.documentationLinkText = ko.observable(
    browser.i18n.getMessage('documentationLinkText'));
  self.documentationLink = ko.observable(
    browser.i18n.getMessage('documentationLink'));

  self.ttSettingsLink = ko.observable(
    browser.i18n.getMessage('ttSettingsLink'));
  self.settingsLinkText = ko.observable(
    browser.i18n.getMessage('settingsLinkText'));
  self.openSettings = () => {
    browser.runtime.openOptionsPage()
  }

  /*
   * message format:
   * {
   *   action: < 'update' >,
   *   data: {}
   * }
   */
  browser.windows.getCurrent().then(
    windowInfo => {
      var port = browser.runtime.connect({ name: `popup-${windowInfo.id}` });

      function requestUpdate (tabId) {
        //console.log(`requestUpdate for tab: ${tabId}`);
        port.postMessage({
          action: 'requestUpdate',
          data: { tabId: tabId }
        });
      }

      browser.tabs.onActivated.addListener(activeInfo => {
        if (activeInfo.windowId === windowInfo.id) {
          requestUpdate(activeInfo.tabId);
        }
      });

      browser.tabs.query({ active: true, currentWindow: true}).then(
        tabs => {
          //console.log(`browser.tabs.query tabs: ${JSON.stringify(tabs)}`);
          requestUpdate(tabs[0].id);
        },
        error => {
          console.log(`SixOrNot:popup.js - browser.tabs.query error: ${error}`);
        }
      );

      port.onMessage.addListener(message => {
        //console.log(`Popup received message, action: ${message.action}`);
        if (message.action === 'update') {
          // Update viewModel
          //console.log(JSON.stringify(message));
          ko.mapping.fromJS(message.data, mapping, self);
        } else if (message.action === 'new') {
          // Regenerate viewModel
          //console.log(JSON.stringify(message));
          self.hosts([]);
          self.mainHost(false);
          ko.mapping.fromJS(message.data, mapping, self);
        }
      });
    },
    error => {
      console.log(`SixOrNot:popup.js - unable to get current window, error: ${error}`);
    }
  );
}

ko.applyBindings(new PopUpViewModel());

