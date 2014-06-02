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

    library1: "iphlpapi.dll",
    library2: "Ws2_32.dll",

    init : function () {
        "use strict";
        var e;
        // On Windows do both local and remote lookups via ctypes
        this.remote_ctypes = true;
        this.local_ctypes  = true;
        try {
            // Library 1 needed only for local lookup
            this.library1 = ctypes.open(this.library1);
            log("Sixornot(dns_worker) - dns:load_win - Running on Windows XP+, opened library: '" + this.library1 + "'", 1);
        } catch (e) {
            log("Sixornot(dns_worker) - dns:load_win - cannot open '" + this.library1 + "' - ctypes local lookup will be disabled", 0);
            log("Sixornot(dns_worker) EXCEPTION: " + parse_exception(e), 1);
            this.local_ctypes  = false;
        }
        try {
            // Library 2 needed for local and remote lookup
            this.library2 = ctypes.open(this.library2);
            log("Sixornot(dns_worker) - dns:load_win - Running on Windows XP+, opened library: '" + this.library2 + "'", 1);
        } catch (e) {
            log("Sixornot(dns_worker) - dns:load_win - cannot open '" + this.library2 + "' - ctypes local and remote lookup will be disabled", 0);
            log("Sixornot(dns_worker) EXCEPTION: " + parse_exception(e), 1);
            this.remote_ctypes = false;
            this.local_ctypes  = false;
        }

        // Flags
        this.AI_PASSIVE                  = 0x01;
        this.AI_CANONNAME                = 0x02;
        this.AI_NUMERICHOST              = 0x04;
        this.AI_ALL                      = 0x0100;
        this.AI_ADDRCONFIG               = 0x0400;
        this.AI_NON_AUTHORITATIVE        = 0x04000;
        this.AI_SECURE                   = 0x08000;
        this.AI_RETURN_PREFERRED_NAMES   = 0x10000;
        // Address family
        this.AF_UNSPEC                   = 0;
        this.AF_INET                     = 2;
        this.AF_INET6                    = 23;
        // Socket type
        this.SOCK_STREAM                 = 1;
        this.SOCK_DGRAM                  = 2;
        this.SOCK_RAW                    = 3;
        this.SOCK_RDM                    = 4;
        this.SOCK_SEQPACKET              = 5;
        // Protocol
        this.IPPROTO_UNSPEC              = 0;
        this.IPPROTO_TCP                 = 6;
        this.IPPROTO_UDP                 = 19;
        this.IPPROTO_RM                  = 113;
        // Adaptor flags
        this.GAA_FLAG_SKIP_UNICAST       = 0x0001;
        this.GAA_FLAG_SKIP_ANYCAST       = 0x0002;
        this.GAA_FLAG_SKIP_MULTICAST     = 0x0004;
        this.GAA_FLAG_SKIP_DNS_SERVER    = 0x0008;
        this.GAA_FLAG_INCLUDE_PREFIX     = 0x0010;
        this.GAA_FLAG_SKIP_FRIENDLY_NAME = 0x0020;

        this.IF_TYPE_SOFTWARE_LOOPBACK   =  24;
        this.IF_TYPE_TUNNEL              = 131;

        // Define ctypes structures
        this.sockaddr                = ctypes.StructType("sockaddr");
        this.sockaddr_in             = ctypes.StructType("sockaddr_in");
        this.sockaddr_in6            = ctypes.StructType("sockaddr_in6");
        this.addrinfo                = ctypes.StructType("addrinfo");
        this.ipAdapterAddresses      = ctypes.StructType("_IP_ADAPTER_ADDRESSES");
        this.ipAdapterUnicastAddress = ctypes.StructType("_IP_ADAPTER_UNICAST_ADDRESS");
        this.socketAddress           = ctypes.StructType("_SOCKET_ADDRESS");

        // Set up the structs we need on Windows XP+

        /* From: http://msdn.microsoft.com/en-us/library/ms740496(v=vs.85).aspx
        struct sockaddr {
            ushort  sa_family;
            char    sa_data[14];
        }; */
        this.sockaddr.define([
            { sa_family : ctypes.unsigned_short          },      // Address family (2)
            { sa_data   : ctypes.unsigned_char.array(14) }       // Address value (14)
            ]);                                                  // (16)

        /* From: http://msdn.microsoft.com/en-us/library/ms740496(v=vs.85).aspx
        struct sockaddr_in {
            short   sin_family;
            u_short sin_port;
            struct  in_addr sin_addr;
            char    sin_zero[8];
        }; */
        this.sockaddr_in.define([
            { sin_family : ctypes.short          },              // Address family (2)
            { sin_port   : ctypes.unsigned_short },              // Socket port (2)
            { sin_addr   : ctypes.unsigned_long  },              // Address value (or could be struct in_addr) (4)
            { sin_zero   : ctypes.char.array(8)  }               // Padding (8)
            ]);                                                  // (16)

        /* From: http://msdn.microsoft.com/en-us/library/ms738560(v=VS.85).aspx
        typedef struct in6_addr {
          union {
            u_char  Byte[16];
            u_short Word[8];
          } u;
        };
           From: http://msdn.microsoft.com/en-us/library/ms740496(v=vs.85).aspx
        struct sockaddr_in6 {
            short   sin6_family;
            u_short sin6_port;
            u_long  sin6_flowinfo;
            struct  in6_addr sin6_addr;
            u_long  sin6_scope_id;
        }; */
        this.sockaddr_in6.define([
            { sin6_family   : ctypes.short                   },  // Address family (2)
            { sin6_port     : ctypes.unsigned_short          },  // Socket port (2)
            { sin6_flowinfo : ctypes.unsigned_long           },  // IP6 flow information (4)
            { sin6_addr     : ctypes.unsigned_char.array(16) },  // IP6 address value (or could be struct in6_addr) (16)
            { sin6_scope_id : ctypes.unsigned_long           }   // Scope zone index (4)
            ]);                                                  // (28)

        /* From: http://msdn.microsoft.com/en-us/library/ms737530(v=vs.85).aspx
        struct addrinfo {
            int              ai_flags;
            int              ai_family;
            int              ai_socktype;
            int              ai_protocol;
            size_t           ai_addrlen;
            char             *ai_canonname;
            struct sockaddr  *ai_addr;
            struct addrinfo  *ai_next;
        }; */
        this.addrinfo.define([
            { ai_flags     : ctypes.int        },                // Flags for getaddrinfo options
            { ai_family    : ctypes.int        },                // Address family (UNSPEC, INET, INET6)
            { ai_socktype  : ctypes.int        },                // Socket type (STREAM, DGRAM, RAW, RDM, SEQPACKET)
            { ai_protocol  : ctypes.int        },                // Protocol type (TCP, UDP, RM)
            { ai_addrlen   : ctypes.int        },                // Length in bytes of buffer pointed to by ai_addr member
            { ai_canonname : ctypes.char.ptr   },                // Canonical name for host (if requested)
            { ai_addr      : this.sockaddr.ptr },                // Pointer to sockaddr structure
            { ai_next      : this.addrinfo.ptr }                 // Pointer to next addrinfo structure in linked list
            ]);

        // Used for local address lookup
        /* From: http://msdn.microsoft.com/en-us/library/aa366058(v=vs.85).aspx
        struct _IP_ADAPTER_ADDRESSES {
            union {
                ULONGLONG Alignment;
                struct {
                    ULONG   Length;
                    DWORD   IfIndex;
                };
            };
            struct _IP_ADAPTER_ADDRESSES    *Next;
            PCHAR                            AdapterName;
            PIP_ADAPTER_UNICAST_ADDRESS      FirstUnicastAddress;
            PIP_ADAPTER_ANYCAST_ADDRES       FirstAnycastAddress;   // Padding 1
            PIP_ADAPTER_MULTICAST_ADDRESS    FirstMulticastAddress; // Padding 1
            PIP_ADAPTER_DNS_SERVER_ADDRESS   FirstDnsServerAddress; // Padding 1
            PWCHAR                           DnsSuffix;             // Padding 1
            PWCHAR                           Description;           // Padding 1
            PWCHAR                           FriendlyName;          // Padding 1
            BYTE                             PhysicalAddress[8];    // Padding 2
            DWORD                            PhysicalAddressLength; // Padding 3
            DWORD                            Flags;                 // Padding 3
            DWORD                            Mtu;                   // Padding 3
            DWORD                            IfType;
            // Remaining members not implemented (not needed)
        }; */
        this.ipAdapterAddresses.define([
            { Length              : ctypes.uint32_t                  },
            { IfIndex             : ctypes.uint32_t                  },
            { Next                : this.ipAdapterAddresses.ptr      },
            { AdapterName         : ctypes.char.ptr                  },
            { FirstUnicastAddress : this.ipAdapterUnicastAddress.ptr },
            { padding_1           : ctypes.voidptr_t.array(6)        },
            { padding_2           : ctypes.uint8_t.array(8)          },
            { padding_3           : ctypes.uint32_t.array(3)         },
            { IfType              : ctypes.uint32_t                  }
            ]);

        /* From: http://msdn.microsoft.com/en-us/library/ms740507(v=vs.85).aspx
        struct _SOCKET_ADDRESS {
            LPSOCKADDR  lpSockaddr;
            INT         iSockaddrLength;
        }; */
        // Note: must be defined before _IP_ADAPTER_UNICAST_ADDRESS
        this.socketAddress.define([
            { lpSockaddr      : this.sockaddr.ptr },
            { iSockaddrLength : ctypes.int        }
            ]);

        /* From: http://msdn.microsoft.com/en-us/library/aa366066(v=vs.85).aspx
            typedef struct _IP_ADAPTER_UNICAST_ADDRESS {
              union {
                struct {
                  ULONG Length;
                  DWORD Flags;
                };
              };
              struct _IP_ADAPTER_UNICAST_ADDRESS  *Next;
              SOCKET_ADDRESS                     Address;
              IP_PREFIX_ORIGIN                   PrefixOrigin;
              IP_SUFFIX_ORIGIN                   SuffixOrigin;
              IP_DAD_STATE                       DadState;
              ULONG                              ValidLifetime;
              ULONG                              PreferredLifetime;
              ULONG                              LeaseLifetime;
              UINT8                              OnLinkPrefixLength;  (Vista+ only)
            } IP_ADAPTER_UNICAST_ADDRESS, *PIP_ADAPTER_UNICAST_ADDRESS;
        }; */
        this.ipAdapterUnicastAddress.define([
            { Length  : ctypes.uint32_t                  },
            { Flags   : ctypes.uint32_t                  },
            { Next    : this.ipAdapterUnicastAddress.ptr },
            { Address : this.socketAddress               }
        ]);

        // Set up the ctypes functions we need
        if (this.remote_ctypes) {
            try {
                this.getaddrinfo = this.library2.declare("getaddrinfo", ctypes.default_abi,
                    ctypes.int, ctypes.char.ptr, ctypes.char.ptr, this.addrinfo.ptr, this.addrinfo.ptr.ptr);
            } catch (e) {
                log("Sixornot(dns_worker) - dns:load_win - Unable to setup 'getaddrinfo' function, remote_ctypes disabled!", 0);
                log("Sixornot(dns_worker) EXCEPTION: " + parse_exception(e), 0);
                this.remote_ctypes = false;
            }
        }

        if (this.remote_ctypes) {
            try {
                this.freeaddrinfo = this.library2.declare("freeaddrinfo", ctypes.default_abi,
                    ctypes.int, this.addrinfo.ptr);
            } catch (e) {
                log("Sixornot(dns_worker) - dns:load_win - Unable to setup 'freeaddrinfo' function, remote_ctypes disabled!", 0);
                log("Sixornot(dns_worker) EXCEPTION: " + parse_exception(e), 0);
                this.remote_ctypes = false;
            }
        }

        if (this.local_ctypes) {
            // Try to initialise WSAAddressToString (Windows method for producing string representation of IP address)
            try {
                this.WSAAddressToString = this.library2.declare("WSAAddressToStringA",
                    ctypes.winapi_abi, ctypes.int, this.sockaddr.ptr, ctypes.uint32_t,
                    ctypes.voidptr_t, ctypes.char.ptr, ctypes.uint32_t.ptr );
            } catch (e) {
                log("Sixornot(dns_worker) - dns:load_win - Unable to setup 'WSAAddressToString' function, local_ctypes disabled!", 0);
                log("Sixornot(dns_worker) EXCEPTION: " + parse_exception(e), 0);
                this.library1.close();
                this.local_ctypes = false;
            }
        }
        if (this.local_ctypes) {
            // Try to initialise GetAdaptorAddresses (Windows method for obtaining interface IP addresses)
            try {
                this.GetAdaptersAddresses = this.library1.declare("GetAdaptersAddresses",
                    ctypes.winapi_abi, ctypes.unsigned_long, ctypes.unsigned_long,
                    ctypes.unsigned_long, ctypes.voidptr_t, ctypes.uint8_t.ptr,
                    ctypes.unsigned_long.ptr);
            } catch (e) {
                log("Sixornot(dns_worker) - dns:load_win - Unable to setup 'GetAdaptorAddresses' function, local_ctypes disabled!", 0);
                log("Sixornot(dns_worker) EXCEPTION: " + parse_exception(e), 1);
                this.local_ctypes = false;
            }
        }

        // If initialisation failed then close appropriate libraries
        if (!this.local_ctypes && this.library1) {
            this.library1.close();
            this.library1 = null;
        }
        if (!this.local_ctypes && !this.remote_ctypes && this.library2) {
            this.library2.close();
            this.library2 = null;
        }

        log("Sixornot(dns_worker) - init(winnt) - Ctypes init completed - remote_ctypes: " + this.remote_ctypes + ", local_ctypes: " + this.local_ctypes, 1);
    },

    resolve_local : function () {
        "use strict";
        var ret, addresses, sa, address, ifaddr, ifaddr_ptr,
            adapbuf, adapsize, adapflags, adapter, addrbuf, addrsize,
            netmask, netmaskbuf;
        log("Sixornot(dns_worker) - dns:resolve_local(winnt)", 2);

        adapbuf   = (ctypes.uint8_t.array(15000))();
        adapsize  = ctypes.unsigned_long(15000);
        /*jslint bitwise: true */
        adapflags = this.GAA_FLAG_SKIP_ANYCAST | this.GAA_FLAG_SKIP_MULTICAST  | this.GAA_FLAG_SKIP_DNS_SERVER | this.GAA_FLAG_SKIP_FRIENDLY_NAME;
        /*jslint bitwise: false */

        ret = this.GetAdaptersAddresses(this.AF_UNSPEC, adapflags, null, adapbuf, adapsize.address());

        if (ret > 0) {
            log("Sixornot(dns_worker) - dns:resolve_local(winnt) - GetAdaptersAddresses failed with exit code: " + ret, 1);
            return ["FAIL"];
        }

        adapter  = ctypes.cast(adapbuf, this.ipAdapterAddresses).address();
        addrbuf  = (ctypes.char.array(128))();
        addrsize = ctypes.uint32_t();
        addresses = [];

        // Loop through returned addresses and add them to array
        for (; !adapter.isNull(); adapter = adapter.contents.Next) {
            log("Sixornot(dns_worker) - dns:resolve_local(winnt) - Getting IPs for interface: '" + adapter.contents.AdapterName.readString() + "'", 1);

            if (adapter.contents.FirstUnicastAddress.isNull()) {
                log("Sixornot(dns_worker) - dns:resolve_local(winnt) - FirstUnicastAddress for interface: '" + adapter.contents.AdapterName.readString() + "' is null, skipping", 1);
                continue;
            }

            for (address = adapter.contents.FirstUnicastAddress;
                 !address.isNull(); address = address.contents.Next) {
                log("Sixornot(dns_worker) - dns:resolve_local(winnt) - address.contents.Length: " + address.contents.Length, 1);
                log("Sixornot(dns_worker) - dns:resolve_local(winnt) - address.contents.Address.lpSockaddrLength: " + address.contents.Address.iSockaddrLength, 1);
                if (address.contents.Address.lpSockaddr.contents.sa_family === this.AF_INET
                 || address.contents.Address.lpSockaddr.contents.sa_family === this.AF_INET6) {
                    addrsize.value = 128;
                    this.WSAAddressToString(address.contents.Address.lpSockaddr, address.contents.Address.iSockaddrLength, null, addrbuf, addrsize.address());
                    log("Sixornot(dns_worker) - dns:resolve_local(winnt) - Address for interface: '" + adapter.contents.AdapterName.readString() + "' is: '" + addrbuf.readString() + "'", 1);
                    if (addresses.indexOf(addrbuf.readString()) === -1) {
                        addresses.push(addrbuf.readString());
                    }
                } else {
                    log("Sixornot(dns_worker) - dns:resolve_local(winnt) - Address for interface: '" + adapter.contents.AdapterName.readString() + "' unknown type, skipping", 1);
                }
            }
        }

        log("Sixornot(dns_worker) - dns:resolve_local(winnt) - Found the following addresses: " + addresses, 2);
        return addresses.slice();
    },

    resolve_remote : function (host) {
        "use strict";
        var hints, ret, addresses, addrinfo, addrbuf, addrinfo_ptr, sa, addrsize;
        log("Sixornot(dns_worker) - dns:resolve_remote(winnt)", 2);

        // DO NOT USE AI_ADDRCONFIG ON WINDOWS.
        //
        // The following comment in <winsock2.h> is the best documentation I found
        // on AI_ADDRCONFIG for Windows:
        //   Flags used in "hints" argument to getaddrinfo()
        //       - AI_ADDRCONFIG is supported starting with Vista
        //       - default is AI_ADDRCONFIG ON whether the flag is set or not
        //         because the performance penalty in not having ADDRCONFIG in
        //         the multi-protocol stack environment is severe;
        //         this defaulting may be disabled by specifying the AI_ALL flag,
        //         in that case AI_ADDRCONFIG must be EXPLICITLY specified to
        //         enable ADDRCONFIG behavior
        //
        // Not only is AI_ADDRCONFIG unnecessary, but it can be harmful.  If the
        // computer is not connected to a network, AI_ADDRCONFIG causes getaddrinfo
        // to fail with WSANO_DATA (11004) for "localhost", probably because of the
        // following note on AI_ADDRCONFIG in the MSDN getaddrinfo page:
        //   The IPv4 or IPv6 loopback address is not considered a valid global
        //   address.
        // See http://crbug.com/5234.
        hints = this.addrinfo();
        hints.ai_flags = this.AI_ALL;
        hints.ai_family = this.AF_UNSPEC;
        hints.ai_socktype = 0;
        hints.ai_protocol = 0;
        hints.ai_addrlen = 0;

        addrinfo_ptr = this.addrinfo.ptr();
        ret = this.getaddrinfo(host, null, hints.address(), addrinfo_ptr.address());

        if (ret > 0 || addrinfo_ptr.isNull()) {
            log("Sixornot(dns_worker) - dns:resolve_remote(winnt) - Got no results from getaddrinfo", 1);
            return ["FAIL"];
        }

        addrinfo  = addrinfo_ptr.contents;
        addrbuf   = (ctypes.char.array(128))();
        addrsize  = ctypes.uint32_t();
        addresses = [];

        for (; !addrinfo.ai_next.isNull(); addrinfo = addrinfo.ai_next.contents) {
            if (addrinfo.ai_addr.contents.sa_family === this.AF_INET) {
                addrsize.value = 128;
                this.WSAAddressToString(addrinfo.ai_addr, 16, null, addrbuf, addrsize.address());
                if (addresses.indexOf(addrbuf.readString()) === -1)
                {
                    addresses.push(addrbuf.readString());
                }
            }

            if (addrinfo.ai_addr.contents.sa_family === this.AF_INET6) {
                addrsize.value = 128;
                this.WSAAddressToString(addrinfo.ai_addr, 28, null, addrbuf, addrsize.address());
                if (addresses.indexOf(addrbuf.readString()) === -1)
                {
                    addresses.push(addrbuf.readString());
                }
            }
        }

        this.freeaddrinfo(addrinfo_ptr);

        log("Sixornot(dns_worker) - dns:resolve_remote(winnt) - Found the following addresses: " + addresses, 1);
        return addresses.slice();
    },

    shutdown : function () {
        "use strict";
        if (this.remote_ctypes || this.local_ctypes) {
            this.library1.close();
            this.library2.close();
        }
    }
};

resolver.init();
