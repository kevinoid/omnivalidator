/* Setup the extension for a new window
 * Also serves as an entry point for the extension
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
            "log4moz",
            "omnivalidator/consoledockedwin",
            "omnivalidator/globaldefs",
            "omnivalidator/validationstatusbutton",
            "omnivalidator/validatorregistry",
            "omnivalidator/windowvalidationmanager",
            "underscore"
        ],
        function (log4moz, ConsoleDockedWin, globaldefs,
                ValidationStatusButton, vregistry, WindowValidationManager,
                underscore) {
            var consoleWin,
                logger = log4moz.repository.getLogger("omnivalidator.browserinit"),
                vManager;

            function setupAboutCommand(command) {
                command.addEventListener("command", function () {
                    window.open(
                        "chrome://omnivalidator/content/aboutdialog.xul",
                        "omnivalidator-about",
                        "chrome"
                    );
                }, false);
            }

            function setupConsoleBox(consoleBox, dockedElems) {
                consoleWin = new ConsoleDockedWin(
                    vManager,
                    gBrowser,
                    consoleBox,
                    dockedElems
                );

                consoleWin.addListener(function (cdw, collapsed) {
                    document
                        .getElementById("omnivalidator-menuitem-viewtoggle")
                        .setAttribute("checked", !collapsed);
                });
            }

            function setupHideCommand(command) {
                command.addEventListener("command", function () {
                    consoleWin.setCollapsed(true);
                }, false);
            }

            function setupMainMenuValidators(menu, validatorIDs,
                    validatorNames) {
                var i,
                    menuitem;

                for (i = 0; i < validatorIDs.length; ++i) {
                    menuitem = document.createElementNS(
                        globaldefs.XUL_NS,
                        "menuitem"
                    );
                    menuitem.setAttribute(
                        "label",
                        validatorNames[validatorIDs[i]]
                    );
                    menuitem.setAttribute("value", validatorIDs[i]);
                    menu.appendChild(menuitem);
                }

                menu.addEventListener("command", function (evt) {
                    logger.debug("Menu command to validate using " +
                        evt.originalTarget.value);
                    if (evt.originalTarget.value === "(All)") {
                        vManager.validate();
                    } else {
                        vManager.validate(evt.originalTarget.value);
                    }
                }, false);
            }

            function setupMainMenu(mainMenu) {
                var i,
                    menu,
                    menus,
                    menuVals,
                    validatorIDs,
                    validatorNames;

                // Remove from Tools menu when in "Web Developer" submenu
                if (document.getElementById("omnivalidator-menu-toolswebdev")) {
                    menu = document.getElementById("omnivalidator-menu-tools");
                    menu.parentNode.removeChild(menu);
                }

                menus =
                    document.getElementsByClassName("omnivalidator-copy-menupopup-main");
                for (i = 0; i < menus.length; ++i) {
                    menu = mainMenu.cloneNode(true);
                    menu.removeAttribute("id");
                    menus[i].appendChild(menu);
                }

                menuVals =
                    document.getElementsByClassName(
                        "omnivalidator-menupopup-main-validators"
                    );
                validatorNames = vregistry.getNames();
                validatorIDs = underscore.keys(validatorNames);
                validatorIDs.sort(function (a, b) {
                    return validatorNames[a].localeCompare(validatorNames[b]);
                });
                for (i = 0; i < menuVals.length; ++i) {
                    setupMainMenuValidators(
                        menuVals[i],
                        validatorIDs,
                        validatorNames
                    );
                }
            }

            function setupPrefsCommand(command) {
                command.addEventListener("command", function () {
                    window.open(
                        "chrome://omnivalidator/content/prefwindow.xul",
                        "omnivalidator-prefs",
                        "chrome,titlebar,toolbar,centerscreen"
                    );
                }, false);
            }

            function setupToggleCommand(command) {
                command.addEventListener("command", function () {
                    var collapsed,
                        results;

                    collapsed = consoleWin.toggleCollapsed();

                    if (!collapsed) {
                        // If the page has not been validated yet, validate it
                        results = vManager.getValidationResults();
                        if (underscore.isEmpty(results)) {
                            vManager.validate();
                        }
                    }
                }, false);
            }

            function setupToolbarButton(toolbarButton) {
                var statusButton;

                statusButton = new ValidationStatusButton(toolbarButton);

                vManager.addListener(function (wvm, vStatus) {
                    var vid, results, validatorNames;

                    if (vStatus.clear) {
                        statusButton.reset();
                    }

                    if (vStatus.summary) {
                        statusButton.addValidationSummary(
                            vStatus.validator.name,
                            vStatus.summary
                        );
                    }

                    if (vStatus.reload) {
                        statusButton.reset();

                        results = vManager.getValidationResults();
                        validatorNames = vregistry.getNames();
                        for (vid in results) {
                            if (results.hasOwnProperty(vid)) {
                                statusButton.addValidationSummary(
                                    validatorNames[vid],
                                    results[vid].summary
                                );
                            }
                        }
                    }
                });
            }

            function setupValidateCommand(command) {
                command.addEventListener("command", function () {
                    var results;

                    consoleWin.setCollapsed(false);

                    // If the page has not been validated yet, validate it
                    results = vManager.getValidationResults();
                    if (underscore.isEmpty(results)) {
                        vManager.validate();
                    }
                }, false);
            }

            window.addEventListener("load", function onLoad() {
                var i,
                    toolbarButtons;

                // Note:  Must be done after load to avoid browser.xml docShell
                // is null errors
                logger.trace("Creating validation manager for new window");
                vManager = new WindowValidationManager(gBrowser);

                setupAboutCommand(
                    document.getElementById("omnivalidator-command-about")
                );

                setupHideCommand(
                    document.getElementById("omnivalidator-command-hide")
                );

                setupPrefsCommand(
                    document.getElementById("omnivalidator-command-prefs")
                );

                setupToggleCommand(
                    document.getElementById("omnivalidator-command-toggle")
                );

                setupValidateCommand(
                    document.getElementById("omnivalidator-command-validate")
                );

                setupConsoleBox(
                    document.getElementById("omnivalidator-console-box"),
                    [
                        document.getElementById("omnivalidator-appcontent-splitter"),
                        document.getElementById("omnivalidator-dockedwin")
                    ]
                );

                toolbarButtons =
                    document.getElementsByClassName("omnivalidator-statusbutton");
                for (i = 0; i < toolbarButtons.length; ++i) {
                    setupToolbarButton(toolbarButtons[i]);
                }

                setupMainMenu(
                    document.getElementById("omnivalidator-menupopup-main")
                );
            }, false);
        }
    );
}());

// vi: set sts=4 sw=4 et :
