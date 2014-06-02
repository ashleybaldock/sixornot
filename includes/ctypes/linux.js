/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2014 Timothy Baldock. All Rights Reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * 
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * 
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * 
 * 3. The name of the author may not be used to endorse or promote products derived from this software without specific prior written permission from the author.
 * 
 * 4. Products derived from this software may not be called "SixOrNot" nor may "SixOrNot" appear in their names without specific prior written permission from the author.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. 
 * 
 * ***** END LICENSE BLOCK ***** */

/*jslint white: true, maxerr: 100, indent: 4 */

importScripts("resource://sixornot/includes/ctypes/base.js");

var resolver = {
    remote_ctypes: false,
    local_ctypes: false,

    library: "libc.so.6",

    init : function () {
        "use strict";
        var e;
        // On Linux do both local and remote lookups via ctypes
        this.remote_ctypes = true;
        this.local_ctypes  = true;
        try {
            this.library = ctypes.open(this.library);
            log("Sixornot(dns_worker) - dns:load_linux - opened library: '" + this.library + "'", 1);
        } catch (e) {
            log("Sixornot(dns_worker) - dns:load_linux - cannot open '" + this.library + "' - ctypes lookup will be disabled", 0);
            log("Sixornot(dns_worker) EXCEPTION: " + parse_exception(e), 1);
            this.local_ctypes  = false;
            this.remote_ctypes = false;
        }

        // Flags
        // Address family
        this.AF_UNSPEC      =  0;
        this.AF_INET        =  2;
        this.AF_INET6       = 10;
        // Protocol
        this.IPPROTO_UNSPEC = 0;

        // Define ctypes structures
        this.sockaddr     = ctypes.StructType("sockaddr");
        this.sockaddr_in  = ctypes.StructType("sockaddr_in");
        this.sockaddr_in6 = ctypes.StructType("sockaddr_in6");
        this.addrinfo     = ctypes.StructType("addrinfo");
        this.ifaddrs      = ctypes.StructType("ifaddrs");

        // Set up the structs we need on Linux

        /*
        */
        this.sockaddr.define([
            { sa_family : ctypes.uint16_t                }, // Address family (1)
            { sa_data   : ctypes.unsigned_char.array(28) }  // Address value (max possible size) (28)
            ]);                                             // (30) - must be larger than sockaddr_in and sockaddr_in6 for type casting to work

        /*
        */
        this.sockaddr_in.define([
            { sin_family : ctypes.uint16_t      },          // Address family (1)
            { sin_port   : ctypes.uint16_t      },          // Socket port (2)
            { sin_addr   : ctypes.uint32_t      },          // Address value (or could be struct in_addr) (4)
            { sin_zero   : ctypes.char.array(8) }           // Padding (8)
            ]);                                             // (16)

        /*
        */
        this.sockaddr_in6.define([
            { sin6_family   : ctypes.uint16_t          },   // Address family (1)
            { sin6_port     : ctypes.uint16_t          },   // Socket port (2)
            { sin6_flowinfo : ctypes.uint32_t          },   // IP6 flow information (4)
            { sin6_addr     : ctypes.uint8_t.array(16) },   // IP6 address value (or could be struct in6_addr) (16)
            { sin6_scope_id : ctypes.uint32_t          }    // Scope zone index (4)
            ]);                                             // (28)

        /* From: http://www.kernel.org/doc/man-pages/online/pages/man3/getaddrinfo.3.html
        struct addrinfo {
            int              ai_flags;
            int              ai_family;
            int              ai_socktype;
            int              ai_protocol;
            size_t           ai_addrlen;
            struct sockaddr *ai_addr;
            char            *ai_canonname;
            struct addrinfo *ai_next;
        }; */
        this.addrinfo.define([
            { ai_flags     : ctypes.int        }, 
            { ai_family    : ctypes.int        }, 
            { ai_socktype  : ctypes.int        }, 
            { ai_protocol  : ctypes.int        }, 
            { ai_addrlen   : ctypes.int        }, 
            { ai_addr      : this.sockaddr.ptr }, 
            { ai_canonname : ctypes.char.ptr   }, 
            { ai_next      : this.addrinfo.ptr }
            ]);

        /* From: http://www.kernel.org/doc/man-pages/online/pages/man3/getifaddrs.3.html
           struct ifaddrs {
               struct ifaddrs  *ifa_next;    // Next item in list
               char            *ifa_name;    // Name of interface
               unsigned int     ifa_flags;   // Flags from SIOCGIFFLAGS
               struct sockaddr *ifa_addr;    // Address of interface
               struct sockaddr *ifa_netmask; // Netmask of interface
               union {
                   struct sockaddr *ifu_broadaddr;
                                    // Broadcast address of interface
                   struct sockaddr *ifu_dstaddr;
                                    // Point-to-point destination address
               } ifa_ifu;
           #define              ifa_broadaddr ifa_ifu.ifu_broadaddr
           #define              ifa_dstaddr   ifa_ifu.ifu_dstaddr
               void            *ifa_data;    // Address-specific data
           }; */
        this.ifaddrs.define([
             { ifa_next    : this.ifaddrs.ptr    },
             { ifa_name    : ctypes.char.ptr     },
             { ifa_flags   : ctypes.unsigned_int },
             { ifa_addr    : this.sockaddr.ptr   },
             { ifa_netmask : this.sockaddr.ptr   },
             { ifa_dstaddr : this.sockaddr.ptr   },
             { ifa_data    : ctypes.voidptr_t    }
             ]);

        // Set up the ctypes functions we need
        if (this.local_ctypes || this.remote_ctypes) {
            try {
                this.inet_ntop = this.library.declare("inet_ntop", ctypes.default_abi,
                    ctypes.char.ptr, ctypes.int, ctypes.voidptr_t, ctypes.char.ptr, ctypes.uint32_t);
            } catch (e) {
                log("Sixornot(dns_worker) - dns:load_linux - Unable to setup 'inet_ntop' function, local_ctypes and remote_ctypes disabled!", 0);
                log("Sixornot(dns_worker) EXCEPTION: " + parse_exception(e), 0);
                this.local_ctypes = false;
                this.remote_ctypes = false;
            }
        }

        if (this.remote_ctypes) {
            try {
                this.getaddrinfo = this.library.declare("getaddrinfo", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.char.ptr, this.addrinfo.ptr, this.addrinfo.ptr.ptr);
            } catch (e) {
                log("Sixornot(dns_worker) - dns:load_linux - Unable to setup 'getaddrinfo' function, remote_ctypes disabled!", 0);
                log("Sixornot(dns_worker) EXCEPTION: " + parse_exception(e), 0);
                this.remote_ctypes = false;
            }
        }
        if (this.remote_ctypes) {
            try {
                this.freeaddrinfo = this.library.declare("freeaddrinfo", ctypes.default_abi,
                    ctypes.int, this.addrinfo.ptr);
            } catch (e) {
                log("Sixornot(dns_worker) - dns:load_linux - Unable to setup 'freeaddrinfo' function, remote_ctypes disabled!", 0);
                log("Sixornot(dns_worker) EXCEPTION: " + parse_exception(e), 0);
                this.remote_ctypes = false;
            }
        }

        if (this.local_ctypes) {
            try {
                this.getifaddrs = this.library.declare("getifaddrs", ctypes.default_abi, ctypes.int, this.ifaddrs.ptr.ptr);
            } catch (e) {
                log("Sixornot(dns_worker) - dns:load_linux - Unable to setup 'getifaddrs' function, local_ctypes disabled!", 0);
                log("Sixornot(dns_worker) EXCEPTION: " + parse_exception(e), 0);
                this.local_ctypes = false;
            }
        }
        if (this.local_ctypes) {
            try {
                this.freeifaddrs = this.library.declare("freeifaddrs", ctypes.default_abi,
                    ctypes.void_t, this.ifaddrs.ptr);
            } catch (e) {
                log("Sixornot(dns_worker) - dns:load_linux - Unable to setup 'freeifaddrs' function, local_ctypes disabled!", 0);
                log("Sixornot(dns_worker) EXCEPTION: " + parse_exception(e), 0);
                this.local_ctypes = false;
            }
        }

        // If initialisation failed then close library
        if (!this.local_ctypes && !this.remote_ctypes && this.library) {
            this.library.close();
            this.library = null;
        }

        log("Sixornot(dns_worker) - init(linux) - Ctypes init completed - remote_ctypes: " + this.remote_ctypes + ", local_ctypes: " + this.local_ctypes, 1);
    },

    resolve_local : function () {
        "use strict";
        var ret, addresses, sa, address, ifaddr, ifaddr_ptr,
            adapbuf, adapsize, adapflags, adapter, addrbuf, addrsize,
            netmask, netmaskbuf;
        log("Sixornot(dns_worker) - dns:resolve_local_linux", 2);

        ifaddr_ptr = this.ifaddrs.ptr();
        ret = this.getifaddrs(ifaddr_ptr.address());

        if (ret > 0 || ifaddr_ptr.isNull()) {
            log("Sixornot(dns_worker) - dns:resolve_local(linux) - Got no results from getifaddrs", 1);
            return ["FAIL"];
        }

        // TODO
        // Change addresses to be an array of interface info dicts:
        // { interface: <interface name>,
        //   ipv4s: [ <array of IPv4 addresses> ],
        //   ipv6s: [ <array of IPv6 addresses> ],
        //   <other interface info>
        // }
        // IP Address:
        // { address: <ip address>,
        //   family: <4 or 6>, (or maybe others too)
        //   netmask: <network mask>,
        //   prefix: <prefix length>
        // }

        addrbuf   = (ctypes.char.array(128))();
        netmaskbuf   = (ctypes.char.array(128))();
        addresses = [];

        for (ifaddr = ifaddr_ptr; !ifaddr.isNull(); ifaddr = ifaddr.contents.ifa_next) {
            log("Sixornot(dns_worker) - dns:resolve_local(linux) - Addresses for interface: '" + ifaddr.contents.ifa_name.readString() + "'", 1);
            if (ifaddr.contents.ifa_addr.isNull()) {
                log("Sixornot(dns_worker) - dns:resolve_local(linux) - Address for interface: '" + ifaddr.contents.ifa_name.readString() + "' is null, skipping", 1);
                continue;
            }

            if (ifaddr.contents.ifa_addr.contents.sa_family === this.AF_INET) {
                sa = ctypes.cast(ifaddr.contents.ifa_addr.contents, this.sockaddr_in);
                this.inet_ntop(sa.sin_family, sa.addressOfField("sin_addr"), addrbuf, 128);
                if (!ifaddr.contents.ifa_netmask.isNull()) {
                    netmask = ctypes.cast(ifaddr.contents.ifa_netmask.contents, this.sockaddr_in);
                    this.inet_ntop(netmask.sin_family, netmask.addressOfField("sin_addr"), netmaskbuf, 128);
                    log("Sixornot(dns_worker) - dns:resolve_local(linux) - Address for interface: '" + ifaddr.contents.ifa_name.readString() + "', address: '" + addrbuf.readString() + "', netmask: '" + netmaskbuf.readString() + "', prefix: '" + get_ipv4_prefix(netmask.sin_addr) + "'", 1);
                } else {
                    log("Sixornot(dns_worker) - dns:resolve_local(linux) - Address for interface: '" + ifaddr.contents.ifa_name.readString() + "', address: '" + addrbuf.readString() + "', netmask: '" + "null" + "', prefix: '" + "N/A"  + "'", 1);
                }
                if (addresses.indexOf(addrbuf.readString()) === -1)
                {
                    addresses.push(addrbuf.readString());
                }
            }

            if (ifaddr.contents.ifa_addr.contents.sa_family === this.AF_INET6) {
                sa = ctypes.cast(ifaddr.contents.ifa_addr.contents, this.sockaddr_in6);
                this.inet_ntop(sa.sin6_family, sa.addressOfField("sin6_addr"), addrbuf, 128);

                if (!ifaddr.contents.ifa_netmask.isNull()) {
                    netmask = ctypes.cast(ifaddr.contents.ifa_netmask.contents, this.sockaddr_in6);
                    this.inet_ntop(netmask.sin6_family, netmask.addressOfField("sin6_addr"), netmaskbuf, 128);
                    log("Sixornot(dns_worker) - dns:resolve_local(linux) - Address for interface: '" + ifaddr.contents.ifa_name.readString() + "', address: '" + addrbuf.readString() + "', netmask: '" + netmaskbuf.readString() + "', prefix: '" + get_ipv6_prefix(netmask.sin6_addr) + "'", 1);
                } else {
                    log("Sixornot(dns_worker) - dns:resolve_local(linux) - Address for interface: '" + ifaddr.contents.ifa_name.readString() + "', address: '" + addrbuf.readString() + "', netmask: '" + "null" + "', prefix: '" + "N/A"  + "'", 1);
                }
                if (addresses.indexOf(addrbuf.readString()) === -1)
                {
                    addresses.push(addrbuf.readString());
                }
            }
        }

        this.freeifaddrs(ifaddr_ptr);

        log("Sixornot(dns_worker) - dns:resolve_local(linux) - Found the following addresses: " + addresses, 2);
        return addresses.slice();
    },

    resolve_remote : function (host) {
        "use strict";
        var hints, ret, addresses, addrinfo, addrbuf, addrinfo_ptr, sa, addrsize;
        log("Sixornot(dns_worker) - dns:resolve_remote_linux", 2);

        hints = this.addrinfo();
        hints.ai_flags = 0x0;
        hints.ai_family = this.AF_UNSPEC;
        hints.ai_socktype = 0;
        hints.ai_protocol = 0;
        hints.ai_addrlen = 0;

        addrinfo_ptr = this.addrinfo.ptr();
        log("Sixornot(dns_worker) - about to call getaddrinfo, host: " + JSON.stringify(host) + ", hints.address(): " + hints.address() + ", addrinfo_ptr.address(): " + addrinfo_ptr.address(), 2);
        ret = this.getaddrinfo(host, null, hints.address(), addrinfo_ptr.address());

        if (ret > 0 || addrinfo_ptr.isNull()) {
            log("Sixornot(dns_worker) - dns:resolve_remote(linux) - Got no results from getaddrinfo", 1);
            return ["FAIL"];
        }

        addrbuf   = (ctypes.char.array(128))();
        addresses = [];

        for (addrinfo = addrinfo_ptr; !addrinfo.isNull(); addrinfo = addrinfo.contents.ai_next) {
            if (addrinfo.contents.ai_addr.contents.sa_family === this.AF_INET) {
                sa = ctypes.cast(addrinfo.contents.ai_addr.contents, this.sockaddr_in);
                this.inet_ntop(sa.sin_family, sa.addressOfField("sin_addr"), addrbuf, 128);
                if (addresses.indexOf(addrbuf.readString()) === -1)
                {
                    addresses.push(addrbuf.readString());
                }
            }
            if (addrinfo.contents.ai_addr.contents.sa_family === this.AF_INET6) {
                sa = ctypes.cast(addrinfo.contents.ai_addr.contents, this.sockaddr_in6);
                this.inet_ntop(sa.sin6_family, sa.addressOfField("sin6_addr"), addrbuf, 128);
                if (addresses.indexOf(addrbuf.readString()) === -1)
                {
                    addresses.push(addrbuf.readString());
                }
            }
        }

        this.freeaddrinfo(addrinfo_ptr);

        log("Sixornot(dns_worker) - dns:resolve_remote(linux) - Found the following addresses: " + addresses, 2);
        return addresses.slice();
    },

    shutdown : function () {
        "use strict";
        if (this.remote_ctypes || this.local_ctypes) {
            this.library.close();
        }
    }
};

resolver.init();
