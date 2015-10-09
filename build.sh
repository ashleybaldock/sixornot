#!/bin/sh

# This script builds the SixOrNot addon ready for distribution
version="2.0.0"

# Create build directory by version
mkdir ../dist/$version

# Copy distribution files into build directory
mkdir ../dist/$version/src
cp licence.txt ../dist/$version/src/
cp options.xul ../dist/$version/src/
cp chrome.manifest ../dist/$version/src/
cp bootstrap.js ../dist/$version/src/
cp install.rdf ../dist/$version/src/
cp icon.png ../dist/$version/src/
cp icon64.png ../dist/$version/src/

mkdir ../dist/$version/src/chrome
cp chrome/addressbaricon.jsm ../dist/$version/src/chrome/
cp chrome/content.js ../dist/$version/src/chrome/
cp chrome/dns.jsm ../dist/$version/src/chrome/
cp chrome/gui.jsm ../dist/$version/src/chrome/
cp chrome/ipaddress.jsm ../dist/$version/src/chrome/
cp chrome/locale.jsm ../dist/$version/src/chrome/
cp chrome/logger.jsm ../dist/$version/src/chrome/
cp chrome/messanger.jsm ../dist/$version/src/chrome/
cp chrome/panel.jsm ../dist/$version/src/chrome/
cp chrome/prefs.jsm ../dist/$version/src/chrome/
cp chrome/requestcache.jsm ../dist/$version/src/chrome/
cp chrome/requestobserver.jsm ../dist/$version/src/chrome/
cp chrome/stylesheet.jsm ../dist/$version/src/chrome/
cp chrome/utility.jsm ../dist/$version/src/chrome/
cp chrome/widget.jsm ../dist/$version/src/chrome/
cp chrome/windowwatcher.jsm ../dist/$version/src/chrome/

mkdir ../dist/$version/src/chrome/ctypes
cp chrome/ctypes/worker_base.js ../dist/$version/src/chrome/ctypes/
cp chrome/ctypes/darwin.js ../dist/$version/src/chrome/ctypes/
cp chrome/ctypes/linux.js ../dist/$version/src/chrome/ctypes/
cp chrome/ctypes/winnt.js ../dist/$version/src/chrome/ctypes/

mkdir ../dist/$version/src/chrome/css
./gen_css.sh
cp chrome/css/base.css ../dist/$version/src/chrome/css/
cp chrome/css/large.css ../dist/$version/src/chrome/css/ # legacy
cp chrome/css/customize.css ../dist/$version/src/chrome/css/

# Copy locale(s)
mkdir ../dist/$version/src/locale
mkdir ../dist/$version/src/locale/en
cp locale/en/sixornot.properties ../dist/$version/src/locale/en/
cp locale/en/options.dtd ../dist/$version/src/locale/en/
mkdir ../dist/$version/src/locale/ru
cp locale/ru/sixornot.properties ../dist/$version/src/locale/ru/
cp locale/ru/options.dtd ../dist/$version/src/locale/ru/
mkdir ../dist/$version/src/locale/de
cp locale/de/sixornot.properties ../dist/$version/src/locale/de/
cp locale/de/options.dtd ../dist/$version/src/locale/de/

# Copy documentation
mkdir ../dist/$version/src/chrome/doc
cp chrome/doc/* ../dist/$version/src/chrome/doc/
mkdir ../dist/$version/src/chrome/doc/en
cp chrome/doc/en/* ../dist/$version/src/chrome/doc/en/

# Create .zip file from build directory (with .xpi file extension)
cd ../dist/$version/src/
zip -r ../sixornot.xpi *
