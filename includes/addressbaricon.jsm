
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://sixornot/includes/logger.jsm");
Components.utils.import("resource://sixornot/includes/utility.jsm");
Components.utils.import("resource://sixornot/includes/locale.jsm");
Components.utils.import("resource://sixornot/includes/prefs.jsm");
Components.utils.import("resource://sixornot/includes/windowwatcher.jsm");
Components.utils.import("resource://sixornot/includes/widget.jsm");

var EXPORTED_SYMBOLS = ["createAddressBarIcon"];

var createAddressBarIcon = function (win, id) {
    var icon, urlbaricons, starbutton, doc;

    var updateVisibility = function () {
        if (prefs.get_bool("showaddressicon")) {
            icon.setAttribute("hidden", false);
        } else {
            icon.setAttribute("hidden", true);
        }
    };

    /* Create address bar icon */
    doc = win.document;
    icon = doc.createElement("box");
    icon.setAttribute("id", id);
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    icon.setAttribute("align", "center");
    icon.setAttribute("pack", "center");
    icon.setAttribute("tooltiptext", gt("tt_button"));
    /* Box must contain at least one child or it doesn't display */
    icon.appendChild(doc.createElement("image"));

    updateVisibility();

    /* Position the icon */
    urlbaricons = gbi(doc, "urlbar-icons");
    starbutton = gbi(doc, "star-button");
    /* If star icon visible, insert before it, otherwise just append to urlbaricons */
    if (!starbutton) {
        urlbaricons.appendChild(icon);
    } else {
        urlbaricons.insertBefore(icon, starbutton);
    }

    // Create Sixornot widget for this node
    createWidget(icon, win);

    var visibilityObserver = prefs.createObserver("extensions.sixornot.showaddressicon",
                                                  updateVisibility).register();

    /* Add unload callback to remove the icon */
    unload(function () {
        log("address bar icon unload", 2);
        visibilityObserver.unregister();

        /* Remove UI */
        icon.parentNode.removeChild(icon);
    }, win);
};
