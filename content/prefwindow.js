/* Attach JavaScript functionality for the preferences window
 *
 * This file is part of the Omnivalidator extension for Firefox.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true */
/*global Components, document, gBrowser */

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
            "omnivalidator/prefavlistbox",
            "omnivalidator/validatorregistry",
            "omnivalidator/xulutils",
            "underscore"
        ],
        function (log4moz, globaldefs, PrefAVListbox, vregistry,
                xulutils, underscore) {
            var logger = log4moz.repository.getLogger("omnivalidator.prefwindow"),
                autoValListbox;

            function setupAutoAddButton(button) {
                button.addEventListener("click", function () {
                    var url,
                        valItem;

                    url = document.getElementById("auto-validate-url").value;
                    valItem =
                        document.getElementById("auto-validate-validator")
                            .selectedItem;

                    autoValListbox.add(url, valItem.value, valItem.label);
                    if (document.documentElement.instantApply) {
                        autoValListbox.save();
                    }
                }, false);
            }

            function setupAutoClearButton(button) {
                button.addEventListener(
                    "click",
                    function () {
                        autoValListbox.clear();
                        if (document.documentElement.instantApply) {
                            autoValListbox.save();
                        }
                    },
                    false
                );
            }

            function setupAutoRemoveButton(button) {
                var listbox;

                listbox = document.getElementById("auto-validate-listbox");

                // Disable/enable the button based on listbox selection
                listbox.addEventListener("select", function (evt) {
                    button.disabled = evt.target.selectedIndex === -1;
                }, false);
                button.disabled = listbox.selectedIndex === -1;

                button.addEventListener("click", function () {
                    autoValListbox.removeSelected();
                    if (document.documentElement.instantApply) {
                        autoValListbox.save();
                    }
                }, false);
            }

            function setupAutoValList(listbox) {
                var prefwindow = document.documentElement;

                autoValListbox = new PrefAVListbox(listbox);

                if (!prefwindow.instantApply) {
                    prefwindow.addListener(
                        "dialogaccept",
                        function () {
                            autoValListbox.save();
                        },
                        false
                    );
                }
            }

            function fillValidatorList(listNode, validatorNames, tagName) {
                var oldValue;

                // Preserve the value, when possible
                oldValue = listNode.value;

                while (listNode.lastChild) {
                    listNode.removeChild(listNode.lastChild);
                }

                listNode.appendChild(
                    xulutils.listToXul(
                        validatorNames,
                        tagName,
                        document.createDocumentFragment(),
                        function (a, b) {
                            return validatorNames[a].localeCompare(validatorNames[b]);
                        }
                    )
                );

                listNode.value = oldValue;
            }

            function fillValidatorLists() {
                var autoValList,
                    validatorNames;

                validatorNames = vregistry.getNames();

                // List on validators pane
                fillValidatorList(
                    document.getElementById("validators-list-listbox"),
                    validatorNames,
                    "listitem"
                );

                // List on automatic validation pane
                autoValList =
                    document.getElementById("auto-validate-validator");
                fillValidatorList(
                    autoValList.getElementsByTagNameNS(
                        globaldefs.XUL_NS,
                        "menupopup"
                    )[0],
                    validatorNames,
                    "menuitem"
                );
                if (autoValList.itemCount > 0) {
                    autoValList.selectedIndex = 0;
                }

                document.getElementById("validators-list-clear").disabled =
                    underscore.isEmpty(validatorNames);
            }

            function setupValAddButton(button) {
                button.addEventListener("click", function () {
                    document.documentElement.openSubDialog(
                        "chrome://omnivalidator/content/prefwindow-validator.xul",
                        "",
                        vregistry.getNewValidatorID()
                    );

                    fillValidatorLists();
                }, false);
            }

            function setupValClearButton(button) {
                button.addEventListener("click", function () {
                    vregistry.removeAll();

                    fillValidatorLists();
                }, false);
            }

            function setupValEditButton(button) {
                var listbox;

                listbox = document.getElementById("validators-list-listbox");

                // Disable/enable the button based on listbox selection
                listbox.addEventListener("select", function (evt) {
                    button.disabled = evt.target.selectedIndex === -1;
                }, false);
                button.disabled = listbox.selectedIndex === -1;

                button.addEventListener("click", function () {
                    if (!listbox.selectedItem) {
                        logger.warn("Edit clicked without a validator selected");
                        return;
                    }

                    document.documentElement.openSubDialog(
                        "chrome://omnivalidator/content/prefwindow-validator.xul",
                        "",
                        listbox.selectedItem.value
                    );

                    fillValidatorLists();
                }, false);
            }

            function setupValRemoveButton(button) {
                var listbox;

                listbox = document.getElementById("validators-list-listbox");

                // Disable/enable the button based on listbox selection
                listbox.addEventListener("select", function (evt) {
                    button.disabled = evt.target.selectedIndex === -1;
                }, false);
                button.disabled = listbox.selectedIndex === -1;

                button.addEventListener("click", function () {
                    if (!listbox.selectedItem) {
                        logger.warn("Remove clicked without a validator selected");
                        return;
                    }

                    vregistry.remove(listbox.selectedItem.value);

                    fillValidatorLists();
                }, false);
            }

            document.addEventListener("DOMContentLoaded", function () {
                logger.trace("Prefwindow loaded");

                setupAutoAddButton(
                    document.getElementById("auto-validate-add")
                );

                setupAutoClearButton(
                    document.getElementById("auto-validate-clear")
                );

                setupAutoRemoveButton(
                    document.getElementById("auto-validate-remove")
                );

                setupAutoValList(
                    document.getElementById("auto-validate-listbox")
                );

                setupValAddButton(
                    document.getElementById("validators-list-add")
                );

                setupValClearButton(
                    document.getElementById("validators-list-clear")
                );

                setupValEditButton(
                    document.getElementById("validators-list-edit")
                );

                setupValRemoveButton(
                    document.getElementById("validators-list-remove")
                );

                fillValidatorLists();
            }, false);
        }
    );
}());

// vi: set sts=4 sw=4 et :
