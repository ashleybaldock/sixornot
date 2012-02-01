#!/bin/sh

# This script builds the SixOrNot addon ready for distribution
version="0.7.1"

# Create build directory by version
mkdir ../dist/$version

# Copy distribution files into build directory
mkdir ../dist/$version/src
cp licence.txt ../dist/$version/src/
cp options.xul ../dist/$version/src/
cp bootstrap.js ../dist/$version/src/
cp install.rdf ../dist/$version/src/
cp icon.png ../dist/$version/src/
cp icon64.png ../dist/$version/src/

mkdir ../dist/$version/src/includes
cp includes/dns.jsm ../dist/$version/src/includes/
cp includes/dns_worker.js ../dist/$version/src/includes/
cp includes/gui.jsm ../dist/$version/src/includes/
cp includes/locale.jsm ../dist/$version/src/includes/
cp includes/logger.jsm ../dist/$version/src/includes/
cp includes/prefs.jsm ../dist/$version/src/includes/
cp includes/requestcache.jsm ../dist/$version/src/includes/
cp includes/windowwatcher.jsm ../dist/$version/src/includes/

./gen_imagesrc.sh
cp includes/imagesrc.jsm ../dist/$version/src/includes/

# Copy locale(s)
mkdir ../dist/$version/src/locale
mkdir ../dist/$version/src/locale/en
cp locale/en/sixornot.properties ../dist/$version/src/locale/en/
mkdir ../dist/$version/src/locale/ru
cp locale/ru/sixornot.properties ../dist/$version/src/locale/ru/

# Create .zip file from build directory (with .xpi file extension)
cd ../dist/$version/src/
zip -r ../sixornot.xpi *
