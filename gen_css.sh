#!/bin/sh

# Generate the imagesrc.jsm file containing image data for use by addon

outfile="skin/toolbar.css"
icon_file="./images/sixornot_icon_32.png"
imagedir_colour="./images/colour/*.png"
imagedir_grey="./images/grey/*.png"


cat > $outfile <<END_OF_FILE
/* This file is generated automatically by gen_css.sh */

@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");

@-moz-document url("chrome://browser/content/browser.xul"),
               url("chrome://navigator/content/navigator.xul") {
END_OF_FILE


for file in $imagedir_colour
do
    if test -f "$file" 
    then
        b64=`base64 $file`
        filename=`basename $file`
        echo "    #sixornot-addressbaricon.sixornot_${filename%\.*}, #sixornot-button.sixornot_${filename%\.*} { list-style-image: url(\"data:image/png;base64,$b64\"); }" >> $outfile
    fi
done

for file in $imagedir_grey
do
    if test -f "$file" 
    then
        b64=`base64 $file`
        filename=`basename $file`
        echo "    #sixornot-addressbaricon.sixornot_grey.sixornot_${filename%\.*}, #sixornot-button.sixornot_grey.sixornot_${filename%\.*} { list-style-image: url(\"data:image/png;base64,$b64\"); }" >> $outfile
    fi
done


if test -f "$icon_file"
then
    b64=`base64 $icon_file`
    echo "    #sixornot-button[cui-areatype=\"menu-panel\"], toolbarpaletteitem[place=\"palette\"] > #sixornot-button { list-style-image: url(\"data:image/png;base64,$b64\"); }" >> $outfile
fi

cat >> $outfile <<END_OF_FILE

  /* Necessary to mimic the behavior of all other buttons, which are darker when
pressed.
#aus-view-button:hover:active:not([disabled="true"]):not([cui-areatype="menu-panel"]) {
list-style-image: url("chrome://aus-view/skin/icon32-dark.png");
}*/

  /*#sixornot-panel {
    width: 20em;
  }*/
}
END_OF_FILE
