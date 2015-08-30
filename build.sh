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

mkdir ../dist/$version/src/includes
cp includes/content.js ../dist/$version/src/includes/
cp includes/dns.jsm ../dist/$version/src/includes/
cp includes/env.jsm ../dist/$version/src/includes/
cp includes/gui.jsm ../dist/$version/src/includes/
cp includes/locale.jsm ../dist/$version/src/includes/
cp includes/logger.jsm ../dist/$version/src/includes/
cp includes/panel.jsm ../dist/$version/src/includes/
cp includes/prefs.jsm ../dist/$version/src/includes/
cp includes/requestcache.jsm ../dist/$version/src/includes/
cp includes/requestobserver.jsm ../dist/$version/src/includes/
cp includes/stylesheet.jsm ../dist/$version/src/includes/
cp includes/utility.jsm ../dist/$version/src/includes/
cp includes/windowwatcher.jsm ../dist/$version/src/includes/

mkdir ../dist/$version/src/includes/ctypes
cp includes/ctypes/worker_base.js ../dist/$version/src/includes/ctypes/
cp includes/ctypes/darwin.js ../dist/$version/src/includes/ctypes/
cp includes/ctypes/linux.js ../dist/$version/src/includes/ctypes/
cp includes/ctypes/winnt.js ../dist/$version/src/includes/ctypes/

mkdir ../dist/$version/src/css
./gen_css.sh
cp css/base.css ../dist/$version/src/css/
cp css/large.css ../dist/$version/src/css/
cp css/customize.css ../dist/$version/src/css/
cp css/customize_pre29.css ../dist/$version/src/css/
cp css/customize_pre29_linux.css ../dist/$version/src/css/

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

# Create .zip file from build directory (with .xpi file extension)
cd ../dist/$version/src/
zip -r ../sixornot.xpi *
