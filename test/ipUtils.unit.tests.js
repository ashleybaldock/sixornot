var expect = require("expect.js");
var sinon = require("sinon");
var fs = require("fs");
var vm = require("vm");

Components = {
    utils: {import: function () {}},
    interfaces: {
        nsIDNSService: function () {}
    },
    classes: {
        "@mozilla.org/network/dns-service;1": {
            getService: function () {}
        }
    }
};
Services = {
    appinfo: {
        OS: {
            toLowerCase: function () {}
        }
    }
};
log = function () {}

function include(path) {
    var code = fs.readFileSync(path, "utf-8");
    vm.runInThisContext(code, path);
}

include("chrome/ipaddress.jsm");

suite("ipUtils", function () {
    suite("typeof_ip6", function () {
        var tests = [
            {args: ["::"], expected: "unspecified"},
            {args: ["::1"], expected: "localhost"},
            {args: ["fe80::fa22:22ff:fee8:2222"], expected: "linklocal"},
            {args: ["fec0::ffff:fa22:22ff:fee8:2222"], expected: "sitelocal"},
            {args: ["fc00::1"], expected: "uniquelocal"},
            {args: ["ff00::1"], expected: "multicast"},
            {args: ["2002::1"], expected: "6to4"},
            {args: ["2001:0000::1"], expected: "teredo"},
            {args: ["2001:8b1:1fe4:1::2222"], expected: "global"},
            {args: ["blah"], expected: undefined},
            {args: [":"], expected: undefined},
            {args: ["..."], expected: undefined}
        ];

        tests.forEach(function(testcase) {
            test("input: " + testcase.args[0] + ", expected: " + testcase.expected, function () {
                var a = createIPAddress(testcase.args[0]);
                expect(a.type).to.be(testcase.expected);
            });
        });
    });

    suite("normalise_ip6", function () {
        var tests = [
            {args: ["::"], expected: "0000:0000:0000:0000:0000:0000:0000:0000"},
            {args: ["::1"], expected: "0000:0000:0000:0000:0000:0000:0000:0001"},
            {args: ["fe80::fa22:22ff:fee8:2222"], expected: "fe80:0000:0000:0000:fa22:22ff:fee8:2222"},
            {args: ["fc00::"], expected: "fc00:0000:0000:0000:0000:0000:0000:0000"},
            {args: ["ff00:1234:5678:9abc:def0:d:ee:fff"], expected: "ff00:1234:5678:9abc:def0:000d:00ee:0fff"},
            {args: ["2:0::1:2"], expected: "0002:0000:0000:0000:0000:0000:0001:0002"},
            {args: ["2001:8b1:1fe4:1::2222"], expected: "2001:08b1:1fe4:0001:0000:0000:0000:2222"},
            {args: ["2001:08b1:1fe4:0001:0000:0000:0000:2222"], expected: "2001:08b1:1fe4:0001:0000:0000:0000:2222"},
            {args: ["ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"], expected: "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"},
            {args: ["fe80::fa1e:dfff:fee8:db18%en1"], expected: "fe80:0000:0000:0000:fa1e:dfff:fee8:db18"}
        ];

        tests.forEach(function(testcase) {
            test("input: " + testcase.args[0] + ", expected: " + testcase.expected, function () {
                var a = createIPAddress(testcase.args[0]);
                expect(a.normalised).to.be(testcase.expected);
            });
        });
    });

    suite("is_ip6", function () {
        var tests = [
            {args: ["::"], expected: 6},
            {args: ["::1"], expected: 6},
            {args: ["fc00::"], expected: 6},
            {args: ["ff00:1234:5678:9abc:def0:d:ee:fff"], expected: 6},
            {args: ["2:0::1:2"], expected: 6},
            {args: ["2001:08b1:1fe4:0001:0000:0000:0000:2222"], expected: 6},
            {args: ["192.168.2.1"], expected: 4},
            {args: ["blah"], expected: 0},
            {args: [":::"], expected: 0},
            {args: [":"], expected: 0},
            {args: ["1::2::3"], expected: 0}
        ];

        tests.forEach(function(testcase) {
            test("input: " + testcase.args[0] + ", expected: " + testcase.expected, function () {
                var a = createIPAddress(testcase.args[0]);
                expect(a.family).to.be(testcase.expected);
            });
        });
    });
});
