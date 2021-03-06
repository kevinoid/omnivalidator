/* Code to detect and handle extension version changes
 *
 * This file is part of the Omnivalidator extension.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true, unparam: true */
/*global define */

define(
    [
        "gecko/components/classes",
        "gecko/components/interfaces",
        "log4moz",
        "omnivalidator/globaldefs",
        "omnivalidator/locale",
        "omnivalidator/platform/preferences",
        "omnivalidator/prefutils",
        "omnivalidator/validatorregistry"
    ],
    function (Cc, Ci, log4moz, globaldefs, locale, Preferences, prefutils,
            vregistry) {
        "use strict";

        var buttonId = "omnivalidator-toolbarbutton",
            logger = log4moz.repository.getLogger("omnivalidator");

        // FIXME:  This is a (partial) copy of setToolbarVisibility from
        //         browser/base/content/browser.js, since we can not import
        //         this file outside of a window context.
        function setToolbarVisibility(toolbar, isVisible) {
            var doc = toolbar.ownerDocument,
                hidingAttribute = toolbar.getAttribute("type") === "menubar" ?
                                "autohide" : "collapsed";

            toolbar.setAttribute(hidingAttribute, !isVisible);
            doc.persist(toolbar.id, hidingAttribute);
        }

        function addToolbarButton(toolbar, button) {
            var doc = toolbar.ownerDocument;

            toolbar.insertItem(buttonId, null);
            toolbar.setAttribute("currentset", toolbar.currentSet);
            doc.persist(toolbar.id, "currentset");

            setToolbarVisibility(toolbar, true);
        }

        function setupToolbarButton() {
            var win,
                winEnum;

            function onWindowLoad(evt) {
                var doc = evt.target,
                    toolbar = doc.getElementById("addon-bar");

                if (toolbar) {
                    logger.debug("Adding button to the addon bar");
                    addToolbarButton(toolbar, buttonId);
                } else {
                    logger.debug("Window does not have addon-bar, not adding status button");
                }

                evt.target.removeEventListener("load", onWindowLoad, false);
            }

            // Add the toolbar button to the addon-bar by default
            winEnum = Cc["@mozilla.org/appshell/window-mediator;1"]
                .getService(Ci.nsIWindowMediator)
                .getEnumerator("navigator:browser");
            while (winEnum.hasMoreElements()) {
                win = winEnum.getNext();

                win.addEventListener("load", onWindowLoad, false);
            }
        }

        function addInitialValidators() {
            var i,
                ivPrefs,
                valPrefs,
                vid;

            ivPrefs = [
                {
                    args: {
                        validatorURL: "http://validator.nu"
                    },
                    name: locale.get("validatorName.default.validatornu"),
                    type: "omnivalidator/validatornu"
                },
                {
                    args: {
                        validatorURL: "http://validator.w3.org/check"
                    },
                    name: locale.get("validatorName.default.w3cmarkup"),
                    type: "omnivalidator/w3cmarkup"
                }
            ];

            logger.debug("Adding an initial (default) set of validators");

            valPrefs = Preferences.getBranch(globaldefs.EXT_PREF_PREFIX +
                    "validators.");
            for (i = 0; i < ivPrefs.length; ++i) {
                vid = vregistry.getNewValidatorID();
                prefutils.set(valPrefs, vid, ivPrefs[i]);
            }
        }

        function handleNewInstall() {
            addInitialValidators();
            setupToolbarButton();
        }

        function handleUpgradeDowngrade(oldVersion, newVersion) {
        }

        function getInstalledVersion() {
            return Preferences.getValue(globaldefs.EXT_PREF_PREFIX +
                    "installedVersion");
        }

        function setInstalledVersion(version) {
            return Preferences.setValue(globaldefs.EXT_PREF_PREFIX +
                    "installedVersion", version);
        }

        function checkForVersionChange() {
            var installedVersion;

            installedVersion = getInstalledVersion();
            if (!installedVersion) {
                // New installation
                logger.debug("Detected new installation");

                handleNewInstall();

                setInstalledVersion(globaldefs.EXT_VERSION);
            } else if (installedVersion !== globaldefs.EXT_VERSION) {
                // Upgrade/Downgrade
                logger.debug("Detected version change from " +
                        installedVersion + " to " + globaldefs.EXT_VERSION);

                handleUpgradeDowngrade(installedVersion, globaldefs.EXT_VERSION);

                setInstalledVersion(globaldefs.EXT_VERSION);
            }
        }

        return {
            checkForVersionChange: checkForVersionChange,
            getInstalledVersion: getInstalledVersion
        };
    }
);

// vi: set sts=4 sw=4 et :
