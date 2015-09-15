/*
 * Copyright 2008-2015 Timothy Baldock. All Rights Reserved.
 */

/* exported createIPAddress */
var EXPORTED_SYMBOLS = ["createIPAddress"];

var normaliseIPv4 = function (ip) {
    var pad = function (n) {
        return ("00" + n).substr(-3);
    };
    return ip.address.split(".").map(pad).join(".");
};

var normaliseIPv6 = function (ip) {
    var sides, left_parts, right_parts, middle, outarray, pad_left;
    // Split by instances of ::
    sides = ip.address.split("::");
    // Split remaining sections by instances of :
    left_parts = sides[0].split(":");
    right_parts = (sides[1] && sides[1].split(":")) || [];

    middle = ["0", "0", "0", "0", "0", "0", "0", "0"].slice(0, 8 - left_parts.length - right_parts.length);
    outarray = Array.prototype.concat(left_parts, middle, right_parts);

    // Pad each component to 4 char length with zeros to left (and convert to lowercase)
    pad_left = function (str) {
        return ("0000" + str).slice(-4);
    };

    return outarray.map(pad_left).join(":").toLowerCase();
};

/*
 *  route           0.0.0.0/8                                   Starts with 0
 *  local           127.0.0.0/24                                Starts with 127
 *  rfc1918         10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16   Starts with 10, 172.16-31, 192.168
 *  linklocal       169.254.0.0/16                              Starts with 169.254
 *  reserved        240.0.0.0/4                                 Starts with 240-255
 *  6to4relay       192.88.99.0/24                              Starts with 192.88.99
 *  benchmark       198.18.0.0/15                               Starts with 198.18, 198.19
 *  multicast       224.0.0.0/4                                 Starts with 224-239
 */
var typeofIPv4 = function (ip) {
    var split = ip.address.split(".").map(Number);
    if (split[0] === 0) {
        return "route";
    }
    if (split[0] === 127) {
        return "localhost";
    }
    if (split[0] === 10
         || (split[0] === 172 && split[1] >= 16 && split[1] <= 31)
         || (split[0] === 192 && split[1] === 168)) {
        return "rfc1918";
    }
    if (split[0] === 169 && split[1] === 254) {
        return "linklocal";
    }
    if (split[0] >= 240) {
        return "reserved";
    }
    if (split[0] === 192 && split[1] === 88 && split[2] === 99) {
        return "6to4relay";
    }
    if (split[0] === 198 && [18,19].indexOf(split[1]) !== -1) {
        return "benchmark";
    }
    if (split[0] >= 224 && split[0] <= 239) {
        return "multicast";
    }
    return "global";
};

/*
 *  -- For IPv6 addresses types are: --
 *  unspecified     ::/128                                          All zeros
 *  local           ::1/128         0000:0000:0000:0000:0000:0000:0000:0001
 *  linklocal       fe80::/10                                       Starts with fe8, fe9, fea, feb
 *  sitelocal       fec0::/10   (deprecated)                        Starts with fec, fed, fee, fef
 *  uniquelocal     fc00::/7    (similar to RFC1918 addresses)      Starts with: fc or fd
 *  pdmulticast     ff00::/8                                        Starts with ff
 *  v4transition    ::ffff:0:0/96 (IPv4-mapped)                     Starts with 0000:0000:0000:0000:0000:ffff
 *                  ::ffff:0:0:0/96 (Stateless IP/ICMP Translation) Starts with 0000:0000:0000:0000:ffff:0000
 *                  0064:ff9b::/96 ("Well-Known" prefix)            Starts with 0064:ff9b:0000:0000:0000:0000
 *  6to4            2002::/16                                       Starts with 2002
 *  teredo          2001::/32                                       Starts with 2001:0000
 *  benchmark       2001:2::/48                                     Starts with 2001:0002:0000
 *  documentation   2001:db8::/32                                   Starts with 2001:0db8
 */
var typeofIPv6 = function (ip) {
    if (ip.normalised === "0000:0000:0000:0000:0000:0000:0000:0000") {
        return "unspecified";
    }
    if (ip.normalised === "0000:0000:0000:0000:0000:0000:0000:0001"
     || ip.normalised === "fe80:0000:0000:0000:0000:0000:0000:0001") {
        return "localhost";
    }
    if (["fe8", "fe9", "fea", "feb"].indexOf(ip.normalised.substr(0, 3)) !== -1) {
        return "linklocal";
    }
    if (["fec", "fed", "fee", "fef"].indexOf(ip.normalised.substr(0, 3)) !== -1) {
        return "sitelocal";
    }
    if (["fc", "fd"].indexOf(ip.normalised.substr(0, 2)) !== -1) {
        return "uniquelocal";
    }
    if (["ff"].indexOf(ip.normalised.substr(0, 2)) !== -1) {
        return "multicast";
    }
    if (["2002"].indexOf(ip.normalised.substr(0, 4)) !== -1) {
        return "6to4";
    }
    if (["2001:0000"].indexOf(ip.normalised.substr(0, 9)) !== -1) {
        return "teredo";
    }
    return "global";
};

var createIPAddress = function (address) {
    
    var isIPv4 = function () {
        return address && (address.indexOf(".") !== -1 && address.indexOf(":") === -1);
    };

    var isIPv6 = function () {
        return address && (address.indexOf(":") !== -1);
    };
    var family = isIPv6() ? 6 : (isIPv4() ? 4 : 0);

    var normalised;
    var normalise = function (ip) {
        if (family === 6) {
            normalised = normaliseIPv6(ip);
        } else if (family === 4) {
            normalised = normaliseIPv4(ip);
        } else {
            normalised = undefined;
        }
    };

    var type;
    var findType = function (ip) {
        if (family === 6) {
            type = typeofIPv6(ip);
        } else if (family === 4) {
            type = typeofIPv4(ip);
        } else {
            type = undefined;
        }
    };

    return {
        get address() { return address; },
        get family() { return family; },
        get normalised() {
            if (!normalised) {
                normalise(this);
            }
            return normalised;
        },
        get type() {
            if (!type) {
                findType(this);
            }
            return type;
        }
    };
};

