/* Define ConsoleDockedWin class
 *
 * This file is part of the Omnivalidator extension for Firefox.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true, unparam: true */
/*global define */

define(
    [
        "gecko/components/interfaces",
        "gecko/components/results",
        "log4moz",
        "omnivalidator/locale",
        "omnivalidator/validatorregistry"
    ],
    function (Ci, Cr, log4moz, locale, vregistry) {
        "use strict";

        var logger =
            log4moz.repository.getLogger("omnivalidator.consoledockedwin");

        /** Gets a string which uniquely identifies the given browser.
         *
         * Duplicate of getIDForBrowser function in windowvalidationmanager,
         * but no need for both to use the same algorithm (both are fully
         * private implementation details).  Can merge code if a solid
         * algorithm is found.
         *
         * Note:  There does not appear to be a really good way to do this...
         * http://forums.mozillazine.org/viewtopic.php?f=19&t=618378
         * http://stackoverflow.com/questions/6445381/how-to-differentiate-between-firefox-tabs
         * http://forums.mozillazine.org/viewtopic.php?f=19&t=1317515
         */
        function getIDForBrowser(browser) {
            // Get the id from the browser element if it has one,
            // or from the stack or panel which contains it
            return browser.id ||
                browser.parentNode.id ||
                browser.parentNode.parentNode.id;
        }

        function ConsoleDockedWin(vManager, tabbrowser,
                consoleBox, dockedElems) {
            var listeners = [],
                // URI on which the window was opened, by browser ID
                openLocations = {},
                progressListener,
                thisCDW = this;

            dockedElems = dockedElems || [];

            function onTabSelect() {
                var browserID, currentURI, openURI;

                browserID = getIDForBrowser(tabbrowser.selectedBrowser);
                currentURI = tabbrowser.selectedBrowser.currentURI.spec;
                // Placate SpiderMonkey strict option (ref to undef prop)
                openURI = openLocations[browserID] || null;

                /* Avoid trace logging in performance-sensitive functions
                logger.trace("Detected change to tab " + browserID +
                    " on " + currentURI +
                    (openURI ? " (was " + openURI + ")" : ""));
                 */

                // Note:  Location may change while tab is not selected,
                // in which case onLocationChange doesn't fire.
                // So we un-collapse only if the URI is unchanged.
                thisCDW.setCollapsed(openURI !== currentURI);
            }

            function onValidationEvent(wvm, vStatus) {
                var msg;

                if (vStatus.clear || vStatus.reload) {
                    logger.debug("Console clearing validation messages");
                    consoleBox.clearConsole();
                }

                if (vStatus.message) {
                    msg = vStatus.message.clone();
                    msg.message =
                        vStatus.validator.name + ": " + msg.message;
                    if (msg.hasOwnProperty("errorMessage")) {
                        msg.errorMessage =
                            vStatus.validator.name + ": " + msg.errorMessage;
                    }
                    consoleBox.appendItem(msg);
                }

                if (vStatus.state) {
                    if (vStatus.state === "done") {
                        consoleBox.removeStatus(vStatus.validator.id);
                    } else {
                        consoleBox.setStatus(
                            vStatus.validator.id,
                            vStatus.validator.name + ": " +
                                locale.get("validatorState." + vStatus.state)
                        );
                    }
                }

                if (vStatus.reload) {
                    thisCDW.reloadMessages();
                }
            }

            function notifyListeners(/*args*/) {
                var i;
                for (i = 0; i < listeners.length; ++i) {
                    listeners[i].apply(null, arguments);
                }
            }

            this.addListener = function (listener) {
                listeners.push(listener);
            };

            this.removeListener = function (listener) {
                listeners.remove(listener);
            };

            this.reloadMessages = function () {
                var i, messages, msg, results, validatorNames, vid;

                logger.debug("Console reloading validation messages");

                consoleBox.clearConsole();

                results = vManager.getValidationResults();
                validatorNames = vregistry.getNames();
                for (vid in results) {
                    if (results.hasOwnProperty(vid)) {
                        messages = results[vid].messages;
                        for (i = 0; i < messages.length; ++i) {
                            msg = messages[i].clone();
                            msg.message =
                                validatorNames[vid] + ": " +
                                msg.message;
                            if (msg.hasOwnProperty("errorMessage")) {
                                msg.errorMessage =
                                    validatorNames[vid] + ": " +
                                    msg.errorMessage;
                            }
                            consoleBox.appendItem(messages[i]);
                        }
                    }
                }
            };

            this.setCollapsed = function (collapsed) {
                var browserID, i;

                if (dockedElems.length === 0 ||
                        dockedElems[0].collapsed === collapsed) {
                    // State is unchanged
                    return;
                }

                for (i = 0; i < dockedElems.length; ++i) {
                    dockedElems[i].collapsed = collapsed;
                }

                browserID = getIDForBrowser(tabbrowser.selectedBrowser);
                if (collapsed) {
                    delete openLocations[browserID];
                } else {
                    openLocations[browserID] =
                        tabbrowser.selectedBrowser.currentURI.spec;
                }

                notifyListeners(this, collapsed);
            };

            this.toggleCollapsed = function () {
                var collapsed = !dockedElems[0].collapsed;
                this.setCollapsed(collapsed);
                return collapsed;
            };

            tabbrowser.tabContainer.addEventListener(
                "TabSelect",
                onTabSelect,
                false
            );

            progressListener = {
                QueryInterface: function (aIID) {
                    if (aIID.equals(Ci.nsIWebProgressListener) ||
                            aIID.equals(Ci.nsISupportsWeakReference) ||
                            aIID.equals(Ci.nsISupports)) {
                        return this;
                    }
                    throw Cr.NS_NOINTERFACE;
                },

                onStateChange: function (aWebProgress, aRequest, aFlag, aStatus) { },

                onLocationChange: function (aWebProgress, aRequest, aURI) {
                    // Note:  onLocationChange is fired when tab selection
                    // changes, before onTabSelect.  In this case aRequest is
                    // null.  We want to ignore that case here and handle it
                    // in onTabChange, so we only act if we have aRequest.
                    if (aRequest) {
                        thisCDW.setCollapsed(true);
                    }
                },

                onProgressChange: function (aWebProgress, aRequest, curSelf, maxSelf, curTot, maxTot) { },
                onStatusChange: function (aWebProgress, aRequest, aStatus, aMessage) { },
                onSecurityChange: function (aWebProgress, aRequest, aState) { }
            };
            tabbrowser.addProgressListener(progressListener);

            vManager.addListener(onValidationEvent);
        }

        return ConsoleDockedWin;
    }
);

// vi: set sts=4 sw=4 et :
