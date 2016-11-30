#!/bin/sh

# Generate the imagesrc.jsm file containing image data for use by addon

outfile_base="chrome/css/base.css" # For all browsers
outfile_cust="chrome/css/customize.css" # Customize panel on SeaMonkey + Firefox Australis

icon_file32_colour="./images/sixornot_icon_32.png"
icon_file32_grey="./images/sixornot_icon_32_grey.png"
icon_file16_colour="./images/colour/16/6only.png"
icon_file16_grey="./images/grey/16/6only.png"
imagedir16_colour="./images/colour/16/*.png"
imagedir16_grey="./images/grey/16/*.png"


# Base icons and rules for all browsers

echo "gen_css.sh - Generating $outfile_base"
cat > $outfile_base <<END_OF_FILE
/* This file is generated automatically by gen_css.sh */

@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");

@-moz-document url("chrome://browser/content/browser.xul"),
               url("chrome://navigator/content/navigator.xul") {

/* Panel styles */

    .sixornot-panel .sixornot-bold { font-weight: bold; }
    .sixornot-panel .sixornot-link { cursor: pointer !important; }
    .sixornot-panel .sixornot-link:hover { text-decoration: underline; }
    .sixornot-panel .sixornot-title { text-align: center; font-size: smaller; }
    .sixornot-panel .sixornot-hidden { visibility: hidden; }
    .sixornot-panel .sixornot-invisible { display: none; }

/* Icon styles */

END_OF_FILE

# "important!" declarations for the images only needed for FF 24.5 support

for file in $imagedir16_colour
do
    if test -f "$file" 
    then
        b64=`base64 $file`
        filename=`basename $file`
        echo "    .sixornot-panel image.sixornot_${filename%\.*}, #sixornot-addressbaricon.sixornot_${filename%\.*}, #sixornot-button.sixornot_${filename%\.*} { list-style-image: url(\"data:image/png;base64,$b64\") !important; }" >> $outfile_base
    fi
done

for file in $imagedir16_grey
do
    if test -f "$file" 
    then
        b64=`base64 $file`
        filename=`basename $file`
        echo "    .sixornot_grey .sixornot-panel image.sixornot_${filename%\.*}, #sixornot-addressbaricon.sixornot_grey.sixornot_${filename%\.*}, #sixornot-button.sixornot_grey.sixornot_${filename%\.*} { list-style-image: url(\"data:image/png;base64,$b64\") !important; }" >> $outfile_base
    fi
done

cat >> $outfile_base <<END_OF_FILE
}
END_OF_FILE

# Customize panel for SeaMonkey and Australis

echo "gen_css.sh - Generating $outfile_cust"
cat > $outfile_cust <<END_OF_FILE
/* This file is generated automatically by gen_css.sh */

@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");

@-moz-document url("chrome://browser/content/browser.xul"),
               url("chrome://global/content/customizeToolbar.xul") {

/* Customize panel icons for SeaMonkey and FF Australis */

END_OF_FILE

if test -f "$icon_file32_colour"
then
    b64=`base64 $icon_file32_colour`
    echo "    #CustomizeToolbarWindow #sixornot-button, #sixornot-button[cui-areatype=\"menu-panel\"], toolbarpaletteitem[place=\"palette\"] > #sixornot-button { list-style-image: url(\"data:image/png;base64,$b64\") !important; }" >> $outfile_cust
fi
if test -f "$icon_file32_grey"
then
    b64=`base64 $icon_file32_grey`
    echo "    #CustomizeToolbarWindow #sixornot-button.sixornot_grey, #sixornot-button[cui-areatype=\"menu-panel\"].sixornot_grey, toolbarpaletteitem[place=\"palette\"] > #sixornot-button.sixornot_grey { list-style-image: url(\"data:image/png;base64,$b64\") !important; }" >> $outfile_cust
fi

cat >> $outfile_cust <<END_OF_FILE
}
END_OF_FILE

