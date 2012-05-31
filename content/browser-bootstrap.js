/* Setup the extension for a new window
 * Also serves as an entry point for the extension
 *
 * This file is part of the Omnivalidator extension for Firefox.
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
            "log4moz",
            "omnivalidator/consoledockedwin",
            "omnivalidator/globaldefs",
            "omnivalidator/preferences",
            "omnivalidator/validationstatusbutton",
            "omnivalidator/validatorregistry",
            "omnivalidator/windowvalidationmanager",
            "omnivalidator/xulutils",
            "underscore"
        ],
        function (log4moz, ConsoleDockedWin, globaldefs, Preferences,
                ValidationStatusButton, vregistry, WindowValidationManager,
                xulutils, underscore) {
            var consoleWin,
                logger = log4moz.repository.getLogger("omnivalidator.browserinit"),
                vManager;

            function setupAboutCommand(command) {
                command.addEventListener("command", function () {
                    /* Open the same as cmd_showItemAbout in
                     * toolkit/mozapps/extensions/content/extensions.js for
                     * UI consistency.
                     */
                    window.openDialog(
                        "chrome://omnivalidator/content/aboutdialog.xul",
                        "",
                        "chrome,centerscreen,modal"
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

            function reloadMainMenuValidators() {
                var i,
                    menuitems,
                    menuVal,
                    menuVals,
                    validatorNames;

                validatorNames = vregistry.getNames();
                menuitems = xulutils.listToXul(
                    validatorNames,
                    "menuitem",
                    document.createDocumentFragment(),
                    function (a, b) {
                        return validatorNames[a].localeCompare(validatorNames[b]);
                    }
                );

                menuVals =
                    document.getElementsByClassName(
                        "omnivalidator-menupopup-main-validators"
                    );
                for (i = 0; i < menuVals.length; ++i) {
                    menuVal = menuVals[i];

                    // Remove any existing validator menuitems
                    while (menuVal.lastChild &&
                            !(menuVal.lastChild.localName === "menuseparator" &&
                                menuVal.namespaceURI === globaldefs.XUL_NS)) {
                        menuVal.removeChild(menuVal.lastChild);
                    }

                    // Add the current validator list
                    menuVals[i].appendChild(menuitems.cloneNode(true));
                }
            }

            function setupMainMenu(mainMenu) {
                var i,
                    menu,
                    menus,
                    menuVals;

                // Remove from Tools menu when in "Web Developer" submenu
                if (document.getElementById("omnivalidator-menu-toolswebdev")) {
                    menu = document.getElementById("omnivalidator-menu-tools");
                    menu.parentNode.removeChild(menu);
                }

                // Copy main menupopup to everywhere it is needed
                menus =
                    document.getElementsByClassName("omnivalidator-copy-menupopup-main");
                for (i = 0; i < menus.length; ++i) {
                    logger.trace("Copying main menu to " +
                        menus[i].getAttribute("id"));

                    menu = mainMenu.cloneNode(true);
                    menu.removeAttribute("id");
                    menus[i].appendChild(menu);
                }

                // Setup command listeners for the menu validator list
                menuVals = document.getElementsByClassName(
                    "omnivalidator-menupopup-main-validators"
                );
                function onValidateCommand(evt) {
                    var vid = evt.originalTarget.value;
                    logger.debug("Menu command to validate using " + vid);
                    if (vid === "(All)") {
                        vManager.validate();
                    } else {
                        vManager.validate(vid);
                    }
                }
                for (i = 0; i < menuVals.length; ++i) {
                    menu.addEventListener("command", onValidateCommand, false);
                }

                // Load the list of validators for the main menu
                reloadMainMenuValidators();
                // and reload on any changes
                vregistry.addNameListener(reloadMainMenuValidators);
            }

            function setupPrefsCommand(command) {
                command.addEventListener("command", function () {
                    /* Open the same as cmd_showItemAbout in
                     * toolkit/mozapps/extensions/content/extensions.js for
                     * UI consistency.
                     */
                    var features = "chrome,titlebar,toolbar,centerscreen",
                        instantApply;

                    instantApply = Preferences.getValue(
                        "browser.preferences.instantApply"
                    );
                    features += instantApply ? ",dialog=no" : ",modal";

                    window.openDialog(
                        "chrome://omnivalidator/content/prefwindow.xul",
                        "",
                        features
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
                            if (results.hasOwnProperty(vid) &&
                                    results[vid].summary) {
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
