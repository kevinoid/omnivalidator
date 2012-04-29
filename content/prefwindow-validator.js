/* Attach JavaScript functionality for the validator preferences window
 *
 * This file is part of the Omnivalidator extension for Firefox.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true */
/*global Components, document, gBrowser, window */

(function () {
    "use strict";

    // Map exports from the extension global namespace into this variable
    var omnivalidator = {};

    Components.utils["import"](
        "resource://omnivalidator/omnivalidator/global.jsm",
        omnivalidator
    );

    omnivalidator.require(
        [
            "log4moz",
            "omnivalidator/globaldefs",
            "omnivalidator/validatorregistry",
            "omnivalidator/xulutils"
        ],
        function (log4moz, globaldefs, vregistry, xulutils) {
            var logger = log4moz.repository.getLogger("omnivalidator.prefwindow");

            function setValidatorTypes(menulist) {
                var menupopup,
                    typeNames;

                menupopup = menulist.getElementsByTagNameNS(
                    globaldefs.XUL_NS,
                    "menupopup"
                )[0];

                typeNames = vregistry.getTypeNames();
                menupopup.appendChild(
                    xulutils.listToXul(
                        typeNames,
                        "menuitem",
                        document.createDocumentFragment(),
                        function (a, b) {
                            return typeNames[a].localeCompare(typeNames[b]);
                        }
                    )
                );
            }

            function setValidatorID(vid) {
                var docFrag,
                    i,
                    newPrefElem,
                    prefElem,
                    prefElems,
                    prefsElem,
                    prefix = "extensions.omnivalidator.validators.";

                // Note:  We must re-create the preference elements in order
                // to re-run their constructor and properly initialize their
                // values.  Otherwise, after changing the name they will still
                // have null values and setting value to valueFromPreferences
                // would ignore values saved in opener for non-instantApply
                // preferences.
                docFrag = document.createDocumentFragment();
                prefElems = document.getElementsByTagNameNS(
                    globaldefs.XUL_NS,
                    "preference"
                );
                for (i = 0; i < prefElems.length; ++i) {
                    prefElem = prefElems[i];

                    newPrefElem = document.createElementNS(
                        globaldefs.XUL_NS,
                        "preference"
                    );
                    newPrefElem.setAttribute("id", prefElem.id);
                    newPrefElem.setAttribute("name",
                        prefElem.name.replace(
                            prefix + ".",
                            prefix + vid + "."
                        ));
                    newPrefElem.setAttribute("type", prefElem.type);
                    docFrag.appendChild(newPrefElem);
                }

                prefsElem = document.getElementsByTagNameNS(
                    globaldefs.XUL_NS,
                    "preferences"
                )[0];
                while (prefsElem.lastChild) {
                    prefsElem.removeChild(prefsElem.lastChild);
                }
                prefsElem.appendChild(docFrag);
            }

            document.addEventListener("DOMContentLoaded", function () {
                var typeMenulist,
                    vid;

                vid = window["arguments"][0];
                logger.trace("Validator prefwindow loaded for validator ID " +
                    vid);

                typeMenulist = document.getElementById("validator-type");
                setValidatorTypes(typeMenulist);

                // Must be called after types are filled to set type from pref
                setValidatorID(vid);

                if (typeMenulist.selectedIndex === -1 &&
                        typeMenulist.itemCount !== 0) {
                    typeMenulist.selectedIndex = 0;

                    document.getElementById(
                        typeMenulist.getAttribute("preference")
                    ).value = typeMenulist.selectedItem.value;
                }
            }, false);
        }
    );
}());

// vi: set sts=4 sw=4 et :
