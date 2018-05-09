(function(ko) {
  if (typeof (browser.storage) === "undefined") { return; }

  ko.extenders.persist = function (target, key) {
    if (key) {
      browser.storage.local.get(key).then(
        item => {
          if (item[key]) {
            //console.log(`ko.extenders.persist: setting target to: '${item[key]}'`);
            target(JSON.parse(item[key]));
          } else {
            //console.log('ko.extenders.persist: setting target to default');
            target(target());
          }
        },
        error => {
          console.log(`ko.extenders.persist: unable to get key: '${key}' from storage`);
        }
      );
    }

    target.subscribe(newValue => {
      var toStore = {};
      toStore[key] = ko.toJSON(newValue);
      //console.log(`ko.extenders.persist: persisting: '${JSON.stringify(toStore)}'`);
      browser.storage.local.set(toStore).then(
        null,
        error => {
          console.log(`ko.extenders.persist: unable to persist key: '${key}' to storage`);
        });
    });

    return target;
  };
})(ko);
