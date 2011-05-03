/* ***** BEGIN LICENSE BLOCK *****
 * Version: BSD License
 * 
 * Copyright (c) 2008-2011 Timothy Baldock. All Rights Reserved.
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


// Utility functions

let consoleService = XPCOM.getService("@mozilla.org/consoleservice;1");


consoleService.logStringMessage("Sixornot(dns_worker)");

// Data is an array
// [callback_id, request_id, data]
// callback_id is a number which will be passed back to the main thread
//      to indicate which callback function (if any) should be executed
//      when this request completes
// request_id references the type of request, see reqids table
// data is arbitrary information passed to the request_id function

var reqids =
{
    shutdown: 0,        // Shut down DNS resolver, must be last request!
    remotelookup: 1,
    locallookup: 2,
    checkremote: 3,     // Check whether ctypes resolver is in use for remote lookups
    checklocal: 4,      // Check whether ctypes resolver is in use for local lookups
}

onmessage = function (evt)
{
    consoleService.logStringMessage("Sixornot(dns_worker) - onmessage: " + evt.data.toSource());
    if (evt.data && evt.data[1])
    {
        let dispatch = [];
        dispatch[reqids.shutdown] = dns.shutdown;
        dispatch[reqids.remotelookup] = dns.resolve_remote;
        dispatch[reqids.locallookup] = dns.resolve_local;
        dispatch[reqids.checkremote] = dns.check_remote;
        dispatch[reqids.checklocal] = dns.check_local;

        // Use request_id (data[1]) to select function
        let f = dispatch[evt.data[1]];
        if (f)
        {
            // Need to use function.call so that the value of "this" in the called function is set correctly
            let ret = f.call(dns, evt.data[2]);
            // Return data to main thread
            postMessage([evt.data[0], evt.data[1], ret]);
        }
    }
};

// ChromeWorker specific dns functions
var dns =
{
    AF_UNSPEC: null,
    AF_INET: null,
    AF_INET6: null,
    AF_LINK: null,
    library: null,
    sockaddr: null,
    addrinfo: null,
    getaddrinfo: null,
    ifaddrs: null,
    getifaddrs: null,
    remote_ctypes: false,
    local_ctypes: false,

    osx_library: "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation",
    win_library: "Ws2_32.dll",

    check_remote : function ()
    {
        consoleService.logStringMessage("Sixornot(dns_worker) - dns:check_remote, value: " + this.remote_ctypes);
        return this.remote_ctypes;
    },
    check_local : function ()
    {
        consoleService.logStringMessage("Sixornot(dns_worker) - dns:check_local, value: " + this.local_ctypes);
        return this.local_ctypes;
    },

    init : function ()
    {
        consoleService.logStringMessage("Sixornot(dns_worker) - dns:init");
        // Import ctypes module (not needed within a ChromeWorker)
        // Cu.import("resource://gre/modules/ctypes.jsm");

        // Try each of these until one works, this will also determine our platform
        try
        {
            this.library = ctypes.open(this.osx_library);
            try
            {
                consoleService.logStringMessage("Sixornot(dns_worker) - Running on OSX, opened library: '" + this.osx_library + "'");
                // On OSX use ctypes functionality to resolve both remote and local addresses
                // On this platform getaddrinfo w/ local hostname doesn't always return all local addresses
                // So we need to use getifaddr to do this
                this.remote_ctypes = true;
                this.local_ctypes = true;
                // Address family
                this.AF_UNSPEC = 0;
                this.AF_INET = 2;
                this.AF_LINK = 18;  // MAC Addresses
                this.AF_INET6 = 30;
                // Socket type
                this.SOCK_STREAM = 1;
                // Protocol
                this.IPPROTO_UNSPEC = 0;
                // Set up the structs we need on OSX

                /*
                From /usr/include/sys/socket.h
                struct sockaddr {
                    __uint8_t   sa_len;         total length
                    sa_family_t sa_family;      [XSI] address family
                    char        sa_data[14];    [XSI] addr value (actually larger)
                };
                typedef __uint8_t       sa_family_t;

                From /usr/include/netinet/in.h
                struct sockaddr_in {
                    __uint8_t   sin_len;        total length
                    sa_family_t sin_family;     address family
                    in_port_t   sin_port;       socket port
                    struct  in_addr sin_addr;   address value
                    char        sin_zero[8];    padding (may need to be bigger to cope with sockaddrs holding IPv6 addresses?)
                };
                typedef __uint16_t  in_port_t;
                typedef __uint32_t  in_addr_t;
                struct in_addr {
                    in_addr_t s_addr;
                };

                From /usr/include/netinet6/in6.h
                struct sockaddr_in6 {
                    __uint8_t   sin6_len;       length of this struct(sa_family_t)
                    sa_family_t sin6_family;    AF_INET6 (sa_family_t)
                    in_port_t   sin6_port;      Transport layer port # (in_port_t)
                    __uint32_t  sin6_flowinfo;  IP6 flow information
                    struct in6_addr sin6_addr;  IP6 address
                    __uint32_t  sin6_scope_id;  scope zone index
                };
                struct in6_addr {
                    union {
                        __uint8_t   __u6_addr8[16];
                        __uint16_t  __u6_addr16[8];
                        __uint32_t  __u6_addr32[4];
                    } __u6_addr;            // 128-bit IP6 address
                };
                */

                this.sockaddr = ctypes.StructType("sockaddr", [
                                    {sa_len : ctypes.uint8_t},                      // Total length (1)
                                    {sa_family : ctypes.uint8_t},                   // Address family (1)
                                    {sa_data : ctypes.unsigned_char.array(28)}      // Address value (max possible size) (28)
                                    ]);                                             // (30) - must be larger than sockaddr_in and sockaddr_in6 for type casting to work
                this.sockaddr_in = ctypes.StructType("sockaddr_in", [
                                    {sin_len : ctypes.uint8_t},                     // Total length (1)
                                    {sin_family : ctypes.uint8_t},                  // Address family (1)
                                    {sin_port : ctypes.uint16_t},                   // Socket port (2)
                                    {sin_addr : ctypes.uint32_t},                   // Address value (or could be struct in_addr) (4)
                                    {sin_zero : ctypes.unsigned_char.array(8)}      // Padding (8)
                                    ]);                                             // (16)
                this.sockaddr_in6 = ctypes.StructType("sockaddr_in6", [
                                    {sin6_len : ctypes.uint8_t},                    // Total length (1)
                                    {sin6_family : ctypes.uint8_t},                 // Address family (1)
                                    {sin6_port : ctypes.uint16_t},                  // Socket port (2)
                                    {sin6_flowinfo : ctypes.uint32_t},              // IP6 flow information (4)
                                    {sin6_addr : ctypes.uint8_t.array(16)},         // IP6 address value (or could be struct in6_addr) (16)
                                    {sin6_scope_id : ctypes.uint32_t}               // Scope zone index (4)
                                    ]);                                             // (28)
                this.addrinfo = ctypes.StructType("addrinfo");
                this.addrinfo.define([
                                    {ai_flags : ctypes.int}, 
                                    {ai_family : ctypes.int}, 
                                    {ai_socktype : ctypes.int}, 
                                    {ai_protocol : ctypes.int}, 
                                    {ai_addrlen : ctypes.int}, 
                                    {ai_cannonname : ctypes.char.ptr}, 
                                    {ai_addr : this.sockaddr.ptr}, 
                                    {ai_next : this.addrinfo.ptr}
                                     ]);
                // Set up the ctypes functions we need
                this.getaddrinfo = this.library.declare("getaddrinfo", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.char.ptr, this.addrinfo.ptr, this.addrinfo.ptr.ptr);
                try
                {
                    // Used for local address lookup
                    /*
                    From /usr/include/ifaddrs.h
                    struct ifaddrs {
                        struct ifaddrs  *ifa_next;
                        char        *ifa_name;
                        unsigned int         ifa_flags;
                        struct sockaddr *ifa_addr;
                        struct sockaddr *ifa_netmask;
                        struct sockaddr *ifa_dstaddr;
                        void        *ifa_data;
                    };
                    */
                    this.ifaddrs = ctypes.StructType("ifaddrs");
                    this.ifaddrs.define([
                                         {ifa_next : this.ifaddrs.ptr}, 
                                         {ifa_name : ctypes.char.ptr}, 
                                         {ifa_flags : ctypes.unsigned_int}, 
                                         {ifa_addr : this.sockaddr.ptr}, 
                                         {ifa_netmask : this.sockaddr.ptr}, 
                                         {ifa_dstaddr : this.sockaddr.ptr}, 
                                         {ifa_data : ctypes.voidptr_t}, 
                                        ]);
                    // Set up the ctypes functions we need
                    this.getifaddrs = this.library.declare("getifaddrs", ctypes.default_abi, ctypes.int, this.ifaddrs.ptr.ptr);
                }
                catch (e)
                {
                    consoleService.logStringMessage("Sixornot(dns_worker) - Unable to init ctypes local resolver, falling back to Firefox method for local addresses (WARNING: May not work if DNS isn't configured for local host)");
                    Components.utils.reportError("Sixornot(dns_worker) EXCEPTION: " + parseException(e));
                    // If we've got this far then remote resolution should still work, so only disable local ctypes resolution
                    this.local_ctypes = false;
                }
            }
            catch (e)
            {
                consoleService.logStringMessage("Sixornot(dns_worker) - Unable to init ctypes resolvers, falling back to Firefox method for local and remote addresses");
                Components.utils.reportError("Sixornot(dns_worker) EXCEPTION: " + parseException(e));
                this.library.close();
                this.remote_ctypes = false;
                this.local_ctypes = false;
            }
        }
        catch(e)
        {
            consoleService.logStringMessage("Sixornot(dns_worker) - Not running on OSX");
            try
            {
                this.library = ctypes.open(this.win_library);
                try
                {
                    consoleService.logStringMessage("Sixornot(dns_worker) - Running on Windows XP+, opened library: '" + this.win_library + "'");
                    // On Windows resolve remote IPs via ctypes method, but use Firefox method to find local addresses since this always works on Windows
                    this.remote_ctypes = true;
                    this.local_ctypes = false;
                    // Flags
                    this.AI_PASSIVE = 0x01;
                    this.AI_CANONNAME = 0x02;
                    this.AI_NUMERICHOST = 0x04;
                    this.AI_ALL = 0x0100;
                    this.AI_ADDRCONFIG = 0x0400;
                    this.AI_NON_AUTHORITATIVE = 0x04000;
                    this.AI_SECURE = 0x08000;
                    this.AI_RETURN_PREFERRED_NAMES = 0x10000;
                    // Address family
                    this.AF_UNSPEC = 0;
                    this.AF_INET = 2;
                    this.AF_INET6 = 23;
                    // Socket type
                    this.SOCK_STREAM = 1;
                    /* this.SOCK_DGRAM = 2;
                    this.SOCK_RAW = 3;
                    this.SOCK_RDM = 4;
                    this.SOCK_SEQPACKET = 5; */
                    // Protocol
                    this.IPPROTO_UNSPEC = 0;
                    this.IPPROTO_TCP = 6;
                    this.IPPROTO_UDP = 17;
                    //this.IPPROTO_RM = 113;
                    // Set up the structs we need on Windows XP+
                    /*
                    From: http://msdn.microsoft.com/en-us/library/ms740496(v=vs.85).aspx
                    struct sockaddr {
                            ushort  sa_family;
                            char    sa_data[14];
                    };

                    struct sockaddr_in {
                            short   sin_family;
                            u_short sin_port;
                            struct  in_addr sin_addr;
                            char    sin_zero[8];
                    };
                    struct sockaddr_in6 {
                            short   sin6_family;
                            u_short sin6_port;
                            u_long  sin6_flowinfo;
                            struct  in6_addr sin6_addr;
                            u_long  sin6_scope_id;
                    };
                    // From: http://msdn.microsoft.com/en-us/library/ms738571(v=VS.85).aspx
                    typedef struct in_addr {
                      union {
                        struct {
                          u_char s_b1,s_b2,s_b3,s_b4;
                        } S_un_b;
                        struct {
                          u_short s_w1,s_w2;
                        } S_un_w;
                        u_long S_addr;
                      } S_un;
                    } IN_ADDR, *PIN_ADDR, FAR *LPIN_ADDR;
                    From: http://msdn.microsoft.com/en-us/library/ms738560(v=VS.85).aspx
                    typedef struct in6_addr {
                      union {
                        u_char  Byte[16];
                        u_short Word[8];
                      } u;
                    } IN6_ADDR, *PIN6_ADDR, FAR *LPIN6_ADDR;
                    */
                    this.sockaddr = ctypes.StructType("sockaddr", [
                                        {sa_family : ctypes.unsigned_short},            // Address family (2)
                                        {sa_data : ctypes.unsigned_char.array(28)}      // Address value (max possible size) (28)
                                        ]);                                             // (30)
                    this.sockaddr_in = ctypes.StructType("sockaddr_in", [
                                        {sin_family : ctypes.short},                    // Address family (2)
                                        {sin_port : ctypes.unsigned_short},             // Socket port (2)
                                        {sin_addr : ctypes.unsigned_long},              // Address value (or could be struct in_addr) (4)
                                        {sin_zero : ctypes.char.array(8)}               // Padding (8)
                                        ]);                                             // (16)
                    this.sockaddr_in6 = ctypes.StructType("sockaddr_in6", [
                                        {sin6_family : ctypes.short},                   // Address family (2)
                                        {sin6_port : ctypes.unsigned_short},            // Socket port (2)
                                        {sin6_flowinfo : ctypes.unsigned_long},         // IP6 flow information (4)
                                        {sin6_addr : ctypes.unsigned_char.array(16)},   // IP6 address value (or could be struct in6_addr) (16)
                                        {sin6_scope_id : ctypes.unsigned_long}          // Scope zone index (4)
                                        ]);                                             // (28)
                    this.addrinfo = ctypes.StructType("addrinfo");
                    this.addrinfo.define([
                                        {ai_flags : ctypes.int}, 
                                        {ai_family : ctypes.int}, 
                                        {ai_socktype : ctypes.int}, 
                                        {ai_protocol : ctypes.int}, 
                                        {ai_addrlen : ctypes.int}, 
                                        {ai_cannonname : ctypes.char.ptr}, 
                                        {ai_addr : this.sockaddr.ptr}, 
                                        {ai_next : this.addrinfo.ptr}]);
                    // Set up the ctypes functions we need
                    this.getaddrinfo = this.library.declare("getaddrinfo", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.char.ptr, this.addrinfo.ptr, this.addrinfo.ptr.ptr);
                }
                catch (e)
                {
                    consoleService.logStringMessage("Sixornot(dns_worker) - Unable to init ctypes resolver, falling back to firefox");
                    Components.utils.reportError("Sixornot(dns_worker) EXCEPTION: " + parseException(e));
                    this.library.close();
                    this.remote_ctypes = false;
                    this.local_ctypes = false;
                }
            }
            catch (e)
            {
                consoleService.logStringMessage("Sixornot(dns_worker) - Not running on Windows XP+");
                // Here we should degrade down to using Firefox's builtin methods
                consoleService.logStringMessage("Sixornot(dns_worker) - Native resolver not supported on this platform, falling back to builtin");
                this.remote_ctypes = false;
                this.local_ctypes = false;
            }
        }
        consoleService.logStringMessage("Sixornot(dns_worker) - dns:init completed");
    },

    shutdown : function ()
    {
        consoleService.logStringMessage("Sixornot(dns_worker) - shutdown");
        if (this.remote_ctypes || this.local_ctypes)
        {
            // Shutdown ctypes library
            this.library.close();
            // Close worker thread
            close();
        }
    },

    // Converts a sockaddr structure to a string representation of its address
    sockaddr_to_str : function (sockaddr)
    {
        consoleService.logStringMessage("Sixornot(dns_worker) - sockaddr_to_str");
        let dispatch = [];
        dispatch[this.AF_INET] = this._af_inet_to_str;
        dispatch[this.AF_INET6] = this._af_inet6_to_str;
        dispatch[this.AF_LINK] = this._af_link_to_str;

        let f = dispatch[sockaddr.sa_family];
        if (f)
        {
            // Need to use function.call so that the value of "this" in the called function is set correctly
            return f.call(this, sockaddr);
        }
        // Unknown address family, return false
        return false;
    },

    _af_inet_to_str : function (sockaddr)
    {
        consoleService.logStringMessage("Sixornot(dns_worker) - _af_inet_to_str");
        // Cast to sockaddr_in
        let sockaddr_in = ctypes.cast(sockaddr, this.sockaddr_in);
        // Read IP address value as 32bit number
        let ip4 = sockaddr_in.sin_addr;
        // Convert to dotted decimal notation + return string
        // return [ip4 >>> 24, (ip4 << 8) >>> 24, (ip4 << 16) >>> 24, (ip4 << 24) >>> 24].join(".");
        return [(ip4 << 24) >>> 24, (ip4 << 16) >>> 24, (ip4 << 8) >>> 24, ip4 >>> 24].join(".");
    },
    _af_inet6_to_str : function (sockaddr)
    {
        consoleService.logStringMessage("Sixornot(dns_worker) - _af_inet6_to_str");
        // Cast to sockaddr_in6
        let sockaddr_in6 = ctypes.cast(sockaddr, this.sockaddr_in6);
        // Convert to hex quad notation + return string
        // This code adapted from this example: http://phpjs.org/functions/inet_ntop:882
        // TODO - replace this horrible code
        let i = 0, m = "", c = [];
        for (i = 0; i < sockaddr_in6.sin6_addr.length; i++) {
            c.push(((Number(sockaddr_in6.sin6_addr[i++]) << 8) + Number(sockaddr_in6.sin6_addr[i])).toString(16));
        }
        return c.join(':').replace(/((^|:)0(?=:|$))+:?/g, function (t) {
            m = (t.length > m.length) ? t : m;
            return t;
        }).replace(m || ' ', '::');
    },
    _af_link_to_str : function (sockaddr)
    {
        consoleService.logStringMessage("Sixornot(dns_worker) - _af_link_to_str");
        // Cast to ???
        // Read MAC address value
        // Convert to MAC format with '-' separators + return string
        return false;
    },

    resolve_local : function ()
    {
        consoleService.logStringMessage("Sixornot(dns_worker) - resolve_local - resolving local host");

        let first_addr = this.ifaddrs();
        let first_addr_ptr = first_addr.address();
        let ret = this.getifaddrs(first_addr_ptr.address());

        if (first_addr_ptr.isNull())
        {
            consoleService.logStringMessage("Sixornot(dns_worker) - resolve_local - Got no results from getifaddrs");
            return ["FAIL"];
        }

        let i = first_addr_ptr.contents;
        let addresses = [];

        // Loop over the addresses retrieved by ctypes calls and transfer all of them into a javascript array
        for (;;)
        {
            let new_addr = this.sockaddr_to_str(i.ifa_addr.contents);

            // Add to addresses array, check for blank return from get_ip_str, strip duplicates as we go
            if (new_addr && addresses.indexOf(new_addr) === -1)
            {
                addresses.push(new_addr);
            }
            if (i.ifa_next.isNull())
            {
                break;
            }
            i = i.ifa_next.contents;
        }

        consoleService.logStringMessage("Sixornot(dns_worker) - Found the following addresses: " + addresses);
        return addresses.slice();
    },

    // Proxy to ctypes getaddrinfo functionality
    resolve_remote : function (host)
    {
        consoleService.logStringMessage("Sixornot(dns_worker) - resolve_remote - resolving host: " + host);

        // Debugging - TODO if needed split this into function that creates addrinfo with flags etc.
        let hints = this.addrinfo();
        hints.ai_flags = 0x00;
        hints.ai_family = this.AF_UNSPEC;
        hints.ai_socktype = 0;
        hints.ai_protocol = this.IPPROTO_UNSPEC;
        hints.ai_addrlen = 0;

        let first_addr = this.addrinfo();
        let first_addr_ptr = first_addr.address();
        let ret = this.getaddrinfo(host, null, hints.address(), first_addr_ptr.address());
        // TODO - Check ret for errors
//        let ret = this.getaddrinfo(host, null, null, retVal.address());
        if (first_addr_ptr.isNull())
        {
            consoleService.logStringMessage("Sixornot(dns_worker) - resolve_remote - Unable to resolve host, got no results from getaddrinfo");
            return ["FAIL"];
        }

        let i = first_addr_ptr.contents;
        let addresses = [];

        // Loop over the addresses retrieved by ctypes calls and transfer all of them into a javascript array
        for (;;)
        {
            let new_addr = this.sockaddr_to_str(i.ai_addr.contents);

            // Add to addresses array, strip duplicates as we go
            if (addresses.indexOf(new_addr) === -1)
            {
                addresses.push(new_addr);
            }
            if (i.ai_next.isNull())
            {
                break;
            }
            i = i.ai_next.contents;
        }

        consoleService.logStringMessage("Sixornot(dns_worker) - Found the following addresses: " + addresses);
        return addresses.slice();

    }
};


// Set up DNS (load ctypes modules etc.)
consoleService.logStringMessage("Sixornot(dns_worker) - calling dns.init");
dns.init();

