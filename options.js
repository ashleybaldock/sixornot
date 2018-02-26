
function SettingsViewModel () {
  var self = this;

  self.showaddressicon = ko.observable(false)
                           .extend({ persist: "option_showaddressicon" });
  self.showaddressiconLabel = ko.observable(
    browser.i18n.getMessage("optionsShowAddressIcon"));
  self.showaddressiconDesc = ko.observable(
    browser.i18n.getMessage("optionsShowAddressIconDesc"));

  self.greyscaleicons = ko.observable(false)
                          .extend({ persist: "option_greyscaleicons" });
  self.greyscaleiconsLabel = ko.observable(
    browser.i18n.getMessage("optionsGreyscaleIcons"));
  self.greyscaleiconsDesc = ko.observable(
    browser.i18n.getMessage("optionsGreyscaleIconsDesc"));
}

ko.applyBindings(new SettingsViewModel());





















