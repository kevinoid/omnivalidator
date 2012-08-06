/* Programmatic stuff for the about dialog.
 *
 * This file is part of the Omnivalidator extension.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true, unparam: true */
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
            "gecko/components/classes",
            "gecko/components/interfaces",
            "omnivalidator/addonutils",
            "omnivalidator/globaldefs"
        ],
        function (Cc, Ci, addonutils, globaldefs) {
            function setFrameContentFile(frameid, filename) {
                var file,
                    fileURI,
                    frame;

                file = Cc["@mozilla.org/file/directory_service;1"]
                    .getService(Ci.nsIProperties)
                    .get("ProfD", Ci.nsIFile);
                file.append(globaldefs.EXT_PROF_DIR);
                file.append(filename);

                fileURI = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService)
                    .newFileURI(file);

                frame = document.getElementById(frameid);
                frame.setAttribute("src", fileURI.spec);
            }

            function setFrameContentResource(frameid, filename, addon) {
                var frame,
                    fileURI;

                frame = document.getElementById(frameid);
                fileURI = addonutils.getResourceURI(addon, filename);
                frame.setAttribute("src", fileURI.spec);
            }

            function setTabsContent() {
                addonutils.getAddonByID(globaldefs.EXT_ID, function (addon) {
                    setFrameContentResource(
                        "omnivalidator-frame-authors",
                        "AUTHORS.txt",
                        addon
                    );
                    setFrameContentResource(
                        "omnivalidator-frame-changelog",
                        "ChangeLog.txt",
                        addon
                    );
                    setFrameContentFile(
                        "omnivalidator-frame-eventlog",
                        globaldefs.LOG_FILE_NAME
                    );
                    setFrameContentResource(
                        "omnivalidator-frame-license",
                        "COPYING.txt",
                        addon
                    );
                });
            }

            function setValueVersion(label) {
                label.value = globaldefs.EXT_VERSION;
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
