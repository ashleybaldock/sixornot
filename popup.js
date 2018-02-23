
var testData = {
  mainHost: {
    hostname: 'sixornot.com',
    mainIP: {
      address: '1.1.1.1'
    },
    additionalIPs: [
      { address: 'ff::01' },
      { address: 'ff::02' }
    ],
    connectionCount: 2,
    proxyInfo: {},
    tlsInfo: {}
  },
  remoteHosts: [
    {
      hostname: 'google.com',
      mainIP: {
        address: '8.8.8.8'
      },
      connectionCount: 20,
      proxyInfo: {
        host: '',
        port: 0,
        type: 'socks',
        username: '',
        proxyDNS: true,
        failoverTimeout: 0
      },
      tlsInfo: {}
    },
    {
      hostname: 'mozilla.org',
      mainIP: {
        address: '4.3.2.1'
      },
      additionalIPs: [
        { address: '192.168.2.1' }
      ],
      connectionCount: 5,
      proxyInfo: {},
      tlsInfo: {}
    }
  ]
};


function IPViewModel (data, parent, isMainIP = false) {
  var self = this;
  self.parent = parent;

  ko.mapping.fromJS(data, {}, self);

  self.visible = ko.computed(() => {
    return isMainIP || self.parent.showingIPs();
  });

  self.copy = () => {
    console.log('ip copy click');
    // TODO copy to clipboard
  };
}

function ProxyInfoViewModel (data, parent) {
  var self = this;
  self.parent = parent;

  ko.mapping.fromJS(data, {}, self);
}

function HostViewModel (data, parent, isMainHost = false) {
  var self = this;
  self.parent = parent;

  self.additionalIPs = ko.observableArray();

  var mapping = {
    'additionalIPs': {
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

  self.statusClass = ko.computed(() => {
    return 'ipv4only';//TODO
  });

  self.proxyClass = ko.computed(() => {
    return 'noProxy';//TODO
  });

  self.tlsClass = ko.computed(() => {
    return 'noTLS';//TODO
  });

  self.showingIPs = ko.observable(isMainHost);

  self.togglerText = ko.computed(() => {
    var length = self.additionalIPs().length;
    return length === 0 ? '' : self.showingIPs() ? '[-]' : `[+${length}]`;
  });

  self.formattedConnectionCount = ko.computed(() => {
    return `(${self.connectionCount()})`;
  });

  self.toggleIPs = () => {
    self.showingIPs(!self.showingIPs());
  };

  self.copyAll = () => {
    // TODO copy to clipboard
  };

  self.copyIPs = () => {
    // TODO copy to clipboard
  };

  self.copyTLS = () => {
    // TODO copy to clipboard
  };
}

function PopUpViewModel () {
  var self = this;

  self.remoteHosts = ko.observableArray();

  self.mainHost = ko.observable();

  var mapping = {
    'remoteHosts': {
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

  ko.mapping.fromJS(testData, mapping, self);

  self.openSettings = () => {
    browser.runtime.openOptionsPage()
  }
}

ko.applyBindings(new PopUpViewModel());
