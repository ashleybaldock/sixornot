
function IPViewModel (data, parent, isMainIP = false) {
  var self = this;
  self.parent = parent;

  self.type = ko.observable();

  ko.mapping.fromJS(data, {}, self);

  self.visible = ko.computed(() => {
    return isMainIP || self.parent.showingIPs();
  });

  self.formattedAddress = ko.computed(() => {
    if (self.type() === 2) {
      return browser.i18n.getMessage("addrCached");
    }
    if (self.type() === 4 || self.type() === 6) {
      return parent.proxyInfo.type() === "http" ? `(${self.address()})` : self.address();
    }
    if (self.type() === 0) {
      return browser.i18n.getMessage("addrUnavailable");
    }
    return browser.i18n.getMessage("addrNA");
  });

  self.ttCopyAddress = ko.observable(
    browser.i18n.getMessage("ttCopyAddress"));
  self.copy = () => {
    console.log('ip copy click');
    // TODO copy to clipboard
  };
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
    'mainIP': {
      create: options => {
        return new IPViewModel(options.data, self, isMainIP = true);
      }
    },
    'proxyInfo': {
      create: options => {
        return new ProxyInfoViewModel(options.data, self);
      }
    }
  };

  ko.mapping.fromJS(data, mapping, self);

  self.ttStatus = ko.observable(
    browser.i18n.getMessage("ttStatus"));
  self.ttConnectionCount = ko.observable(
    browser.i18n.getMessage("ttConnectionCount"));
  self.ttTLSInfo = ko.observable("TLS Info");
  self.ttCopyAll = ko.observable(
    browser.i18n.getMessage("ttCopyAll"));
  self.ttToggleIPs = ko.computed(() => {
    var length = self.dnsIPs().length;
    return length === 0 ? '' : self.showingIPs()
      ? browser.i18n.getMessage("ttHideDetail")
      : browser.i18n.getMessage("ttShowDetail");
  });

  self.greyscale = ko.observable(false)
                     .extend({ subPersist: "option_greyscale" });

  self.statusPath = ko.computed(() => {
    var iconset = self.greyscale() ? 'grey' : 'colour';
    return `images/16/${iconset}/${self.status()}.png`;
  });

  self.ttProxyInfo = ko.computed(() => {
    if (self.proxyInfo.type() === 'http') {
      return browser.i18n.getMessage("proxyBase", [
        browser.i18n.getMessage("proxyHTTP"),
        self.proxyInfo.host(),
        self.proxyInfo.port(),
        browser.i18n.getMessage("proxyLookupsDisabled")
      ]);
    } else if (self.proxyInfo.type() === 'https') {
      return browser.i18n.getMessage("proxyBase", [
        browser.i18n.getMessage("proxyHTTPS"),
        self.proxyInfo.host(),
        self.proxyInfo.port(),
        browser.i18n.getMessage("proxyLookupsDisabled")
      ]);
    } else if (self.proxyInfo.type() === 'socks4') {
      return browser.i18n.getMessage("proxyBase", [
        browser.i18n.getMessage("proxySOCKS4"),
        self.proxyInfo.host(),
        self.proxyInfo.port(),
        self.proxyInfo.proxyDNS() ? browser.i18n.getMessage("proxyLookupsDisabled") : ''
      ]);
    } else if (self.proxyInfo.type() === 'socks5') {
      return browser.i18n.getMessage("proxyBase", [
        browser.i18n.getMessage("proxySOCKS5"),
        self.proxyInfo.host(),
        self.proxyInfo.port(),
        self.proxyInfo.proxyDNS() ? browser.i18n.getMessage("proxyLookupsDisabled") : ''
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

  self.mainClass = ko.pureComputed(() => {
    return isMainHost ? 'main' : '';
  });

  self.showingIPs = ko.observable(isMainHost);

  self.togglerText = ko.computed(() => {
    var length = self.dnsIPs().length;
    return length === 0 ? '' : self.showingIPs() ? '[ - ]' : `[+${length}]`;
  });

  self.formattedConnectionCount = ko.computed(() => {
    return `(${self.connectionCount()})`;
  });

  self.toggleIPs = () => {
    self.showingIPs(!self.showingIPs());
  };

  self.copyAll = () => {
    // TODO copy to clipboard
    var copyText = self.hostname();
    if (self.mainIP.address() !== '') {
      copyText += `,${self.mainIP.address()}`;
    }
    self.dnsIPs().forEach(ip => {
      copyText += `,${ip.address()}`;
    });
  };
}

function PopUpViewModel () {
  var self = this;

  self.hosts = ko.observableArray([]);

  self.mainHost = ko.observable();

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
        console.log('CREATE');
        return new HostViewModel(options.data, self, isMainHost = true);
      }
    }
  };

  self.header = ko.observable(
    browser.i18n.getMessage("extensionname"));

  self.ttDocumentationLink = ko.observable(
    browser.i18n.getMessage("ttDocumentationLink"));
  self.documentationLinkText = ko.observable(
    browser.i18n.getMessage("documentationLinkText"));
  self.documentationLink = ko.observable(
    browser.i18n.getMessage("documentationLink"));

  self.ttSettingsLink = ko.observable(
    browser.i18n.getMessage("ttSettingsLink"));
  self.settingsLinkText = ko.observable(
    browser.i18n.getMessage("settingsLinkText"));
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
        console.log(`requestUpdate for tab: ${tabId}`);
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
          console.log(`browser.tabs.query tabs: ${JSON.stringify(tabs)}`);
          requestUpdate(tabs[0].id);
        },
        error => {
          console.log(`browser.tabs.query error: ${error}`);
        }
      );

      port.onMessage.addListener(message => {
        console.log(`Popup received message, action: ${message.action}`);
        if (message.action === 'update') {
          // Update viewModel
          console.log(JSON.stringify(message));
          ko.mapping.fromJS(message.data, mapping, self);
        } else if (message.action === 'new') {
          // Regenerate viewModel
          console.log(JSON.stringify(message));
          self.hosts([]);
          self.mainHost(false);
          ko.mapping.fromJS(message.data, mapping, self);
        }
      });
    },
    error => {
      console.log('unable to get current window');
    }
  );
}

ko.applyBindings(new PopUpViewModel());

