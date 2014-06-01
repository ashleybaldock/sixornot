
    // Input is 32bit number, right-shift until right-most bit is 1 then output
var get_ipv4_prefix = function (mask) {
    var lookup = {
        0x00000001: 1,
        0x00000003: 2,
        0x00000007: 3,
        0x0000000f: 4,
        0x0000001f: 5,
        0x0000003f: 6,
        0x0000007f: 7,
        0x000000ff: 8,
        0x000001ff: 9,
        0x000003ff: 10,
        0x000007ff: 11,
        0x00000fff: 12,
        0x00001fff: 13,
        0x00003fff: 14,
        0x00007fff: 15,
        0x0000ffff: 16,
        0x0001ffff: 17,
        0x0003ffff: 18,
        0x0007ffff: 19,
        0x000fffff: 20,
        0x001fffff: 21,
        0x003fffff: 22,
        0x007fffff: 23,
        0x00ffffff: 24,
        0x01ffffff: 25,
        0x03ffffff: 26,
        0x07ffffff: 27,
        0x0fffffff: 28,
        0x1fffffff: 29,
        0x3fffffff: 30,
        0x7fffffff: 31,
        0xffffffff: 32
    };
    log("Sixornot - get_ipv4_prefix - input: " + mask, 1);
    return lookup[mask];
};
// Input is array of chars, for each one use lookup table and add to total
var get_ipv6_prefix = function (mask) {
    var sum = 0;
    var lookup = {
        0x00: 0,
        0x80: 1,
        0xc0: 2,
        0xe0: 3,
        0xf0: 4,
        0xf8: 5,
        0xfc: 6,
        0xfe: 7,
        0xff: 8,
    };

    for (var i = 0; i < mask.length; i++) {
        if (mask[i] === 0) {
            return sum;
        }
        sum += lookup[mask[i]];
    }
    return sum
};
