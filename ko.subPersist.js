(function(ko) {
  if (typeof (browser.storage) === "undefined") { return; }

  ko.extenders.persist = function (target, key) {
    if (key) {
      browser.storage.local.get(key).then(
        item => {
          if (item[key]) {
            target(JSON.parse(item[key]));
          } else {
            target(target());
          }
        },
        error => {
          console.log(`ko.extenders.persist: unable to get key: '${key}' from storage`);
        }
      );
    }

    browser.storage.onChanged.addListener(changes => {
      var changedItems = Object.keys(changes);

      for (var item of changes) {
        if (item === key) {
          target(JSON.parse(changes[item].newValue));
        }
      }
    });

    return target;
  };
})(ko);
