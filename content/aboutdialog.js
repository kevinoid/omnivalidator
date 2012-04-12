/* Programmatic stuff for the about dialog.
 *
 * This file is part of the Omnivalidator extension for Firefox.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true */
/*global Components, document, gBrowser, setToolbarVisibility, window */

(function () {
    "use strict";

    // Map exports from the extension global namespace into this variable
    var omnivalidator = {};

    Components.utils["import"](
        "resource://omnivalidator/omnivalidator/global.jsm",
        omnivalidator
    );

    // Per-window initialization
    omnivalidator.require(
        [
            "omnivalidator/addonutils",
            "omnivalidator/globaldefs"
        ],
        function (addonutils, globaldefs) {
            function setFrameContent(frameid, filename, addon) {
                var frame,
                    fileURI;

                frame = document.getElementById(frameid);
                fileURI = addonutils.getResourceURI(addon, filename);
                frame.setAttribute("src", fileURI.spec);
            }

            function setTabsContent() {
                addonutils.getAddonByID(globaldefs.EXT_ID, function (addon) {
                    setFrameContent("omnivalidator-frame-authors", "AUTHORS.txt", addon);
                    setFrameContent("omnivalidator-frame-changelog", "ChangeLog.txt", addon);
                    setFrameContent("omnivalidator-frame-license", "COPYING.txt", addon);
                });
            }

            function setValueVersion(label) {
                label.value = globaldefs.VERSION;
            }

            window.addEventListener("load", function onLoad() {
                setValueVersion(
                    document.getElementById("omnivalidator-about-version")
                );

                setTabsContent();
            }, false);
        }
    );
}());

// vi: set sts=4 sw=4 et :
