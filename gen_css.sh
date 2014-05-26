#!/bin/sh

# Generate the imagesrc.jsm file containing image data for use by addon

outfile_base="css/base.css" # For all browsers
outfile_large="css/large.css" # For linux and SeaMonkey
outfile_cust="css/customize.css" # Customize panel on SeaMonkey + Firefox Australis
outfile_cust_ffp29="css/customize_pre29.css" # Customize panel on pre-29 Firefox
outfile_cust_ffp29_linux="css/customize_pre29_linux.css" # Customize panel pre-29 Firefox (Linux)

icon_file32_colour="./images/sixornot_icon_32.png"
icon_file32_grey="./images/sixornot_icon_32_grey.png"
icon_file16_colour="./images/colour/16/6only.png"
icon_file16_grey="./images/grey/16/6only.png"
icon_file24_colour="./images/colour/24/6only.png"
icon_file24_grey="./images/grey/24/6only.png"
imagedir16_colour="./images/colour/16/*.png"
imagedir16_grey="./images/grey/16/*.png"
imagedir24_colour="./images/colour/24/*.png"
imagedir24_grey="./images/grey/24/*.png"


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

# Large icons for FF pre-29 Linux & SeaMonkey

echo "gen_css.sh - Generating $outfile_large"
cat > $outfile_large <<END_OF_FILE
/* This file is generated automatically by gen_css.sh */

@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");

@-moz-document url("chrome://browser/content/browser.xul"),
               url("chrome://navigator/content/navigator.xul") {

/* Large icons used for Linux (pre-FF 29) and SeaMonkey */

END_OF_FILE

for file in $imagedir24_colour
do
    if test -f "$file" 
    then
        b64=`base64 $file`
        filename=`basename $file`
        echo "    toolbox[iconsize=\"large\"] #sixornot-button.sixornot_${filename%\.*} { list-style-image: url(\"data:image/png;base64,$b64\") !important; }" >> $outfile_large
    fi
done

for file in $imagedir24_grey
do
    if test -f "$file" 
    then
        b64=`base64 $file`
        filename=`basename $file`
        echo "    toolbox[iconsize=\"large\"] #sixornot-button.sixornot_grey.sixornot_${filename%\.*} { list-style-image: url(\"data:image/png;base64,$b64\") !important; }" >> $outfile_large
    fi
done

cat >> $outfile_large <<END_OF_FILE
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

# Customize panel for pre-Australis Firefox

echo "gen_css.sh - Generating $outfile_cust_ffp29"
cat > $outfile_cust_ffp29 <<END_OF_FILE
/* This file is generated automatically by gen_css.sh */

@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");

@-moz-document url("chrome://global/content/customizeToolbar.xul") {

/* Customize panel icons for pre-Australis Firefox */

END_OF_FILE

if test -f "$icon_file16_colour"
then
    b64=`base64 $icon_file16_colour`
    echo "    #CustomizeToolbarWindow #sixornot-button { list-style-image: url(\"data:image/png;base64,$b64\") !important; }" >> $outfile_cust_ffp29
fi
if test -f "$icon_file16_grey"
then
    b64=`base64 $icon_file16_grey`
    echo "    #CustomizeToolbarWindow #sixornot-button.sixornot_grey { list-style-image: url(\"data:image/png;base64,$b64\") !important; }" >> $outfile_cust_ffp29
fi

cat >> $outfile_cust_ffp29 <<END_OF_FILE
}
END_OF_FILE

# Customize panel for pre-Australis Firefox (Linux)

echo "gen_css.sh - Generating $outfile_cust_ffp29_linux"
cat > $outfile_cust_ffp29_linux <<END_OF_FILE
/* This file is generated automatically by gen_css.sh */

@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");

@-moz-document url("chrome://global/content/customizeToolbar.xul") {

/* Customize panel icons for pre-Australis Firefox (Linux) */

END_OF_FILE

if test -f "$icon_file24_colour"
then
    b64=`base64 $icon_file24_colour`
    echo "    #CustomizeToolbarWindow #sixornot-button { list-style-image: url(\"data:image/png;base64,$b64\") !important; }" >> $outfile_cust_ffp29_linux
fi
if test -f "$icon_file24_grey"
then
    b64=`base64 $icon_file24_grey`
    echo "    #CustomizeToolbarWindow #sixornot-button.sixornot_grey { list-style-image: url(\"data:image/png;base64,$b64\") !important; }" >> $outfile_cust_ffp29_linux
fi

cat >> $outfile_cust_ffp29_linux <<END_OF_FILE
}
END_OF_FILE
echo "gen_css.sh - done"

#cat >> $outfile <<END_OF_FILE
#}
#@-moz-document url("chrome://global/content/customizeToolbar.xul") {
#END_OF_FILE
#
#if test -f "$icon_file24"
#then
#    b64=`base64 $icon_file24`
#    echo "    #sixornot-button.sixornot_grey, #sixornot-button { list-style-image: url(\"data:image/png;base64,$b64\"); }" >> $outfile
#fi

#cat >> $outfile <<END_OF_FILE
#
#  /* Necessary to mimic the behavior of all other buttons, which are darker when
#pressed.
##aus-view-button:hover:active:not([disabled="true"]):not([cui-areatype="menu-panel"]) {
#list-style-image: url("chrome://aus-view/css/icon32-dark.png");
#}*/
#
#  /*#sixornot-panel {
#    width: 20em;
#  }*/
#}
#END_OF_FILE
