// Testing scratchpad for experiments with ctypes.jsm

// http://msdn.microsoft.com/en-us/library/ms740496(VS.85).aspx     sockaddr
// http://msdn.microsoft.com/en-us/library/ms738520(VS.85).aspx     getaddrinfo
// https://developer.mozilla.org/en/js-ctypes/Using_js-ctypes/Working_with_data
// http://blog.mozilla.com/dwitte/2010/03/12/extension-authors-browser-hackers-meet-js-ctypes/

// Better explanation of sockaddr
// http://www.retran.com/beej/sockaddr_inman.html

// http://en.wikipedia.org/wiki/Getaddrinfo

//let hostent = ctypes.StructType("hostent",[{ h_name : ctypes.char.ptr},{ h_aliases : ctypes.char.ptr.ptr},{ h_addrtype : ctypes.int},{ h_length : ctypes.int},{ h_addr_list : ctypes.uint8_t.array(4).ptr.ptr }]);

// OSX
// /usr/include/sys/socket.h
// AF_INET = 2
// AF_INET6 = 30


Components.utils.import("resource://gre/modules/ctypes.jsm");

// Try each of these until one works, this will also determine our platform
var library = ctypes.open("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation");
var library = ctypes.open("libc.so.6");
var library = ctypes.open("Ws2_32.dll");

//let hostent = ctypes.StructType("hostent",[{ h_name      : ctypes.char.ptr},{ h_aliases   : ctypes.char.ptr.ptr},{ h_addrtype  : ctypes.int},{ h_length    : ctypes.int},{ h_addr_list : ctypes.uint8_t.array(4).ptr.ptr }]);

//let gethostbyname2 = library.declare("gethostbyname2",ctypes.default_abi,hostent.ptr,ctypes.char.ptr,ctypes.int);

//let google = gethostbyname2("mail.google.com", 1)

//int
//getaddrinfo(const char *hostname, const char *servname, const struct addrinfo *hints,struct addrinfo **res);


// Structs

// IPv4 AF_INET sockets:

/* struct in_addr {
    unsigned long s_addr;          // load with inet_pton()
}; */
var in_addr = ctypes.StructType("in_addr", [{s_addr : ctypes.unsigned_long}]);
var in_addr = ctypes.StructType("in_addr", [{s_addr : ctypes.unsigned_char.array(4)}]);

/* struct sockaddr_in {
    short            sin_family;   // e.g. AF_INET, AF_INET6
    unsigned short   sin_port;     // e.g. htons(3490)
    struct in_addr   sin_addr;     // see struct in_addr, below
    char             sin_zero[8];  // zero this if you want to
}; */
var sockaddr_in = ctypes.StructType("sockaddr_in", [{sin_family : ctypes.short}, {sin_port : ctypes.unsigned_short}, {sin_addr : in_addr}, {sin_zero : ctypes.char.array(8)}]);

// IPv6 AF_INET6 sockets:

/* struct in6_addr {
    unsigned char   s6_addr[16];   // load with inet_pton()
}; */
var in6_addr = ctypes.StructType("in6_addr", [{s6_addr : ctypes.unsigned_char.array(16)}]);

/* struct sockaddr_in6 {
    u_int16_t       sin6_family;   // address family, AF_INET6
    u_int16_t       sin6_port;     // port number, Network Byte Order
    u_int32_t       sin6_flowinfo; // IPv6 flow information
    struct in6_addr sin6_addr;     // IPv6 address
    u_int32_t       sin6_scope_id; // Scope ID
}; */
var sockaddr_in6 = ctypes.StructType("sockaddr_in6", [{sin6_family : ctypes.uint16_t}, {sin6_port : ctypes.uint16_t}, {sin6_flowinfo : ctypes.uint32_t}, {sin6_addr : in6_addr}, {sin6_scope_id : ctypes.uint32_t}]);

// General socket address holding structure, big enough to hold either
// struct sockaddr_in or struct sockaddr_in6 data:

/* struct sockaddr_storage {
    sa_family_t  ss_family;     // address family

    // all this is padding, implementation specific, ignore it:
    char      __ss_pad1[_SS_PAD1SIZE];
    int64_t   __ss_align;
    char      __ss_pad2[_SS_PAD2SIZE];
}; */
// let sockaddr_storage = ctypes.StructType("sockaddr_storage", [{sa_family_t : }]);

// All pointers to socket address structures are often cast to pointers
// to this type before use in various functions and system calls:

/* struct sockaddr {
    unsigned short    sa_family;    // address family, AF_xxx
    char              sa_data[14];  // 14 bytes of protocol address
}; */
var sockaddr = ctypes.StructType("sockaddr", [{sa_family : ctypes.unsigned_short}, {sa_data : ctypes.char.array(28)}]);

var addrinfo = ctypes.StructType("addrinfo")
addrinfo.define([{ai_flags : ctypes.int}, {ai_family : ctypes.int}, {ai_socktype : ctypes.int}, {ai_protocol : ctypes.int}, {ai_addrlen : ctypes.int}, {ai_cannonname : ctypes.char.ptr}, {ai_addr : sockaddr.ptr}, {ai_next : addrinfo.ptr}]);

// Returns void, takes pointer to first addrinfo in a chain to free
var freeaddrinfo = library.declare("freeaddrinfo", ctypes.default_abi, ctypes.void_t, addrinfo.ptr);

// Returns int status code, takes char, char, addrinfo.ptr, addrinfo.ptr.ptr
var getaddrinfo = library.declare("getaddrinfo", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.char.ptr, addrinfo.ptr, addrinfo.ptr.ptr);

// Returns a char pointer or NULL, takes int(address family), pointer to sin/sin6_addr, char pointer to store output in, max size of destination string
// Max size of destination string would be INET_ADDRSTRLEN/INET6_ADDRSTRLEN, or 16/46 respectively
// Note that 4th parameter should be a socklen_t not an int, but these are the same?
var inet_ntop = library.declare("inet_ntop", ctypes.default_abi, ctypes.char.ptr, ctypes.int, ctypes.voidptr_t, ctypes.char.ptr, ctypes.int);

// Returns int success code, takes int(address family), pointer to string containing human-readable IP/IPv6 address, pointer to in_addr/in6_addr struct to store output
var inet_pton = library.declare("inet_pton", ctypes.default_abi, ctypes.int, ctypes.int, ctypes.char.ptr, ctypes.voidptr_t);

var hintsVal = addrinfo();
//AI_PASSIVE = 0x01
//AI_CANONNAME = 0x02
//AI_NUMERICHOST = 0x04
//AI_ADDRCONFIG = 0x0400 - only resolves if we have a global address
//AI_NON_AUTHORITATIVE = 0x04000
//AI_SECURE = 0x08000
//AI_RETURN_PREFERRED_NAMES = 0x010000
hintsVal.ai_flags = 0;
//AF_UNSPEC = 0
//AF_INET = 2
//AF_INET6 = 23
hintsVal.ai_family = 2;
//SOCK_STREAM = 1
//SOCK_DGRAM = 2
//SOCK_RAW = 3
//SOCK_RDM = 4
//SOCK_SEQPACKET = 5
hintsVal.ai_socktype = 1;
//IPPROTO_TCP = 6
//IPPROTO_UDP = 17
//IPPROTO_RM = 113
hintsVal.ai_protocol = 6;


// Pointer to an addrinfo
var retVal = addrinfo().address()

//var ret = getaddrinfo("entropy.me.uk", "http", hintsVal.address(), retVal.address());
var ret = getaddrinfo("entropy.me.uk", null, null, retVal.address());

// Return values
// http://msdn.microsoft.com/en-us/library/ms740668(VS.85).aspx
//EAI_AGAIN     WSATRY_AGAIN            11002   A temporary failure in name resolution occurred.
//EAI_BADFLAGS  WSAEINVAL               10022   An invalid value was provided for the ai_flags member of the pHints parameter.
//EAI_FAIL      WSANO_RECOVERY          11003   A non-recoverable failure in name resolution occurred.
//EAI_FAMILY    WSAEAFNOSUPPORT         10047   The ai_family member of the pHints parameter is not supported.
//EAI_MEMORY    WSA_NOT_ENOUGH_MEMORY   8       A memory allocation failure occurred.
//EAI_NONAME    WSAHOST_NOT_FOUND       11001   The name does not resolve for the supplied parameters or the pNodeName and pServiceName parameters were not provided.
//EAI_SERVICE   WSATYPE_NOT_FOUND       10109   The pServiceName parameter is not supported for the specified ai_socktype member of the pHints parameter.
//EAI_SOCKTYPE  WSAESOCKTNOSUPPORT      10044   The ai_socktype member of the pHints parameter is not supported.
//              WSANO_DATA              11004   Valid name, no data record of requested type.

// IPv6 addresses, work well
let r6 = ctypes.cast(retVal.contents.ai_addr.contents, sockaddr_in6);
let s6 = ctypes.char(46);
let w6 = inet_ntop(30, r6.sin6_addr.address(), str.address(), 64);
alert(w6.readString());

// IPv4, doesn't cast properly??
let r4 = ctypes.cast(retVal.contents.ai_next.contents.ai_next.contents.ai_addr.contents, sockaddr_in);
let s4 = ctypes.char(46);
let w4 = inet_ntop(2, r4.sin_addr.address(), str.address(), 64);
alert(w4.readString());

function get_addresses_for_name(name)
{
    let retVal = addrinfo().address()
    let ret = getaddrinfo(name, null, null, retVal.address());
    // Loop over the addresses retrieved by ctypes calls and transfer all of them into a javascript array
    // Check for duplicates as we do this
    let addresses = [];
    let new_addr = "";

    for (let i=retVal.contents, !(i.isNull()), i=i.ai_next.contents)
    {
        new_addr = get_ip_str(i, i.ai_family);
        if (addresses.indexOf(new_addr) == -1)
        {
            addresses.push(new_addr);
        }
    }
    return addresses;
}

// Convert a struct sockaddr to a Javascript string
function get_ip_str(address, address_family)
{
    switch (address_family)
    {
        case AF_INET:
            // Case to sockaddr_in
            let cast_addr = ctypes.cast(address, sockaddr_in);
//            let s4 = ctypes.char(46);
            let string_pointer = inet_ntop(AF_INET, cast_addr.sin_addr.address(), ctypes.char(46).address(), 46);
        case AF_INET6:
            let cast_addr = ctypes.cast(address, sockaddr_in6);
            let string_pointer = inet_ntop(AF_INET6, cast_addr.sin6_addr.address(), ctypes.char(46).address(), 46);
    }
    return string_pointer.readString();
}


// Clean up memory we used
freeaddrinfo(retVal);
retVal = null

// Bytes 0,1 are blank, 2-5 are IPv4 address, 6-21 are IPv6 address

ctypes.char.array(28)([0, 0, 82, 113, -104, 84,  0, 0, 0,   0,  0, 0, 0,    0, 13, 89, 46, 126, 0, 0, 0, -120, 2, 0, 0, 0, 91, -58])
ctypes.char.array(28)([0, 0,  0,   0,    0,  0, 32, 1, 4, 112, 31, 9, 3, -104,  0,  0,  0,   0, 0, 0, 0,    2, 0, 0, 0, 0, 48,  11])

32,  1,  4, 112, 31,  9,  3, -104,  0,  0,  0,  0,  0,  0,  0,  2

20, 01, 04,  70, 1F, 09, 03,   89, 00, 00, 00, 00, 00, 00, 00, 02

2001:0470:1F09:0389:0000:0000:0000:0002

addrlen 16
ctypes.uint8_t.array(28)([0, 0, 82, 113, 152, 84, 0, 0, 0, 0, 0, 0, 0, 0, 228, 92, 46, 126, 0, 0, 0, 128, 65, 0, 0, 0, 136, 52])

addrlen 28
ctypes.uint8_t.array(28)([0, 0, 0, 0, 0, 0, 32, 1, 4, 112, 31, 9, 3, 152, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 56, 52])
// Select bytes 6-21
32,  1,  4, 112, 31,  9,  3, 152,  0,  0,  0,  0,  0,  0,  0,  2
// Convert to hex + pad with zeros
20, 01, 04,  70, 1F, 09, 03,  89, 00, 00, 00, 00, 00, 00, 00, 02
// Contatenate with colons
2001:0470:1F09:0389:0000:0000:0000:0002
// Strip leading zeros, compress zeros etc.
2001:470:1f09:389::2

let ainfo = addrinfo()

     struct addrinfo {
             int ai_flags;           /* input flags */
             int ai_family;          /* protocol family for socket */
             int ai_socktype;        /* socket type */
             int ai_protocol;        /* protocol for socket */
             socklen_t ai_addrlen;   /* length of socket-address */
             struct sockaddr *ai_addr; /* socket-address for socket */
             char *ai_canonname;     /* canonical name for service location */
             struct addrinfo *ai_next; /* pointer to next in list */
     };

