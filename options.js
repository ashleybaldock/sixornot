
function SettingsViewModel () {
  var self = this;

  self.showaddressicon = ko.observable(false)
                           .extend({ persist: "setting_showaddressicon" });

  self.greyscaleicons = ko.observable(false)
                          .extend({ persist: "setting_greyscaleicons" });

  self.showallips = ko.observable(false)
                      .extend({ persist: "setting_showallips" });
}

ko.applyBindings(new SettingsViewModel());





















