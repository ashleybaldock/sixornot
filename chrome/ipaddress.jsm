/*
 * Copyright 2008-2015 Timothy Baldock. All Rights Reserved.
 */

/* exported createIPAddress */
var EXPORTED_SYMBOLS = ["createIPAddress"];

var createIPAddress = function (address) {
    
    var isIPv4 = function () {
        return address && (address.indexOf(".") !== -1 && address.indexOf(":") === -1);
    };

    var isIPv6 = function () {
        return address && (address.indexOf(":") !== -1);
    };

    return {
        address: address,
        family: isIPv6() ? 6 : (isIPv4() ? 4 : 0)
    };
};





