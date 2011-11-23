#!/bin/sh

# Generate the imagesrc.jsm file containing image data for use by addon

outfile="includes/imagesrc.jsm"
imagedir="./images/*.png"


# Write out header of file
cat > $outfile <<END_OF_FILE
var EXPORTED_SYMBOLS = ["imagesrc"];

Components.utils.import("resource://gre/modules/Services.jsm");
PREF_BRANCH_SIXORNOT = Services.prefs.getBranch("extensions.sixornot.");

imagesrc = {
    // Lookup by tag, size and colourscheme
    // These are generated automatically from the .png files by a script
END_OF_FILE

# For each .png file in ./images/ base64 encode and insert into containing Javascript
for file in $imagedir
do
    if test -f "$file" 
    then
        b64=`base64 $file`
        filename=`basename $file`
        echo "    img_${filename%\.*}: \"data:image/png;base64,$b64\"," >> $outfile
    fi
done

# Write footer
cat >> $outfile <<END_OF_FILE
    get: function (tag) {
        var greyscale, e;
        // Return requested image
        // Size should be set automatically per platform
        // Greyscale/colour depends on user preference

        try {
            greyscale = PREF_BRANCH_SIXORNOT.getBoolPref("greyscaleicons")
        } catch (e) {
            greyscale = false;
        }
        if (greyscale) {
            return this["img_" + tag + "_" + "g" + "_" + "16"];
        } else {
            return this["img_" + tag + "_" + "c" + "_" + "16"];
        }
    }
}
END_OF_FILE
