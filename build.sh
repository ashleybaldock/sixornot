#!/bin/sh

# This script builds the SixOrNot addon ready for distribution
version="0.6.5"

# Create build directory by version
mkdir ../dist/$version

# Copy distribution files into build directory
mkdir ../dist/$version/src
cp licence.txt ../dist/$version/src/
cp bootstrap.js ../dist/$version/src/
cp install.rdf ../dist/$version/src/
cp icon.png ../dist/$version/src/
cp icon64.png ../dist/$version/src/
mkdir ../dist/$version/src/images
cp images/*.png ../dist/$version/src/images/
mkdir ../dist/$version/src/includes
cp includes/locale.js ../dist/$version/src/includes/
cp includes/utils.js ../dist/$version/src/includes/
cp includes/dns_worker.js ../dist/$version/src/includes/

# Copy locale(s)
mkdir ../dist/$version/src/locale
mkdir ../dist/$version/src/locale/en
cp locale/en/sixornot.properties ../dist/$version/src/locale/en/

# Create .zip file from build directory (with .xpi file extension)
cd ../dist/$version/src/
zip -r ../sixornot.xpi *
