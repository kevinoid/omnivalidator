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

    Components.utils.import(
        "resource://omnivalidator/omnivalidator/global.jsm",
        omnivalidator
    );

    // Per-window initialization
    omnivalidator.require(
        [
            "gecko/components/classes",
            "gecko/components/interfaces",
            "gecko/components/results",
            "log4moz",
            "omnivalidator/objutils",
            "omnivalidator/validationstatusbutton",
            "omnivalidator/windowvalidationmanager"
        ],
        function (Cc, Ci, Cr, log4moz, objutils,
                ValidationStatusButton, WindowValidationManager) {
            var logger = log4moz.repository.getLogger("omnivalidator.browserinit"),
                vManager;

            function setupConsoleBox(consoleBox) {
                vManager.addListener(function (wvm, vStatus) {
                    var msg;

                    if (vStatus.clear) {
                        consoleBox.clearConsole();
                    }
                    if (vStatus.message) {
                        msg = vStatus.message.clone();
                        msg.message =
                            vStatus.validator.name + ": " + msg.message;
                        consoleBox.appendItem(msg);
                    }
                });
            }

            function setupShowCommand(showCommand) {
                showCommand.addEventListener("command", function () {
                    var dockedWin,
                        splitter;

                    dockedWin = document.getElementById("omnivalidator-dockedwin");
                    splitter = document.getElementById("omnivalidator-appcontent-splitter");

                    if (dockedWin.collapsed) {
                        dockedWin.collapsed = false;
                        splitter.collapsed = false;
                        vManager.validate();
                    } else {
                        dockedWin.collapsed = true;
                        splitter.collapsed = true;
                    }
                });
            }

            function setupToolbarButton(toolbarButton) {
                var statusButton;

                statusButton = new ValidationStatusButton(toolbarButton);

                vManager.addListener(function (wvm, vStatus) {
                    if (vStatus.clear) {
                        statusButton.reset();
                    }
                    if (vStatus.summary) {
                        statusButton.addValidationSummary(
                            vStatus.validator,
                            vStatus.summary
                        );
                    }
                });
            }

            window.addEventListener("load", function onLoad() {
                var i, toolbarButtons;

                // Note:  Must be done after load to avoid browser.xml docShell
                // is null errors
                logger.trace("Creating validation manager for new window");
                vManager = new WindowValidationManager(gBrowser);

                setupShowCommand(
                    document.getElementById("omnivalidator-showcommand")
                );

                setupConsoleBox(
                    document.getElementById("omnivalidator-console-box")
                );

                toolbarButtons =
                    document.getElementsByClassName("omnivalidator-statusbutton");
                for (i = 0; i < toolbarButtons.length; ++i) {
                    setupToolbarButton(toolbarButtons[i]);
                }
            });
        }
    );
}());

// vi: set sts=4 sw=4 et :
