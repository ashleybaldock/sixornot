/*
 *
 */

function SettingsViewModel () {
  var self = this;

  self.addressicon = ko.observable(false)
                           .extend({ persist: "option_addressicon" });
  self.addressiconLabel = ko.observable(
    browser.i18n.getMessage("optionsAddressIcon"));
  self.addressiconDesc = ko.observable(
    browser.i18n.getMessage("optionsAddressIconDesc"));

  self.greyscale = ko.observable(false)
                          .extend({ persist: "option_greyscale" });
  self.greyscaleLabel = ko.observable(
    browser.i18n.getMessage("optionsGreyscale"));
  self.greyscaleDesc = ko.observable(
    browser.i18n.getMessage("optionsGreyscaleDesc"));
}

ko.applyBindings(new SettingsViewModel());





















