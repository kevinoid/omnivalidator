/* Class to manage the validation state, clear, and initiate validation for a
 * browser window.
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
        "log4moz",
        "omnivalidator/browservalidationmanager"
    ],
    function (log4moz, BrowserValidationManager) {
        "use strict";

        var logger =
            log4moz.repository.getLogger("omnivalidator.windowvalidationmanager");

        /** Gets a string which uniquely identifies the given browser.
         *
         * Duplicate of getIDForBrowser function in consoledockedwin,
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
            var idElem;

            function ancestorWithId(elem, upToLocalName) {
                if (!elem || elem.localName === upToLocalName) {
                    return null;
                } else if (elem.id) {
                    return elem;
                } else {
                    return ancestorWithId(elem.parentNode, upToLocalName);
                }
            }

            idElem = ancestorWithId(browser, "tabbrowser");

            if (!idElem) {
                throw new Error("Unable to find ID for browser!");
            } else if (!/^panel\d+$/.test(idElem.id)) {
                logger.warn("Browser ID is not \"panelXXXX\".  Is it usable?");
            }

            return idElem.id;
        }

        function WindowValidationManager(tabbrowser) {
            var browserManagers = {},
                browsers,
                i,
                listeners = [],
                thisWVM = this;

            function notifyListeners() {
                var i;
                for (i = 0; i < listeners.length; ++i) {
                    listeners[i].apply(null, arguments);
                }
            }

            function onBrowserValidationEvent(bvm, vStatus) {
                if (bvm.getBrowser() === tabbrowser.selectedBrowser) {
                    notifyListeners(thisWVM, vStatus);
                }
            }

            function createBVM(browser) {
                var browserid,
                    bvm;

                browserid = getIDForBrowser(browser);

                logger.trace("Creating validation manager for browser " +
                    browserid);
                bvm = new BrowserValidationManager(browser);
                bvm.addListener(onBrowserValidationEvent);
                browserManagers[browserid] = bvm;
                return bvm;
            }

            function onTabClose(event) {
                var browser,
                    browserid;
                logger.trace("Received TabClose event, destroying browser validation manager");
                browser = tabbrowser.getBrowserForTab(event.target);
                browserid = getIDForBrowser(browser);
                delete browserManagers[browserid];
            }

            function onTabOpen(event) {
                logger.trace("Received TabOpen event, creating browser validation manager");
                createBVM(tabbrowser.getBrowserForTab(event.target));
            }

            function onTabSelect(event) {
                logger.trace("Received TabSelect event, swapping validation state");
                notifyListeners(thisWVM, {reload: true});
            }

            this.addListener = function (listener) {
                listeners.push(listener);
            };

            this.getBrowserManager = function (browser) {
                var browserid;

                browser = browser || tabbrowser.selectedBrowser;
                browserid = getIDForBrowser(browser);
                return browserManagers[browserid];
            };

            this.getValidationResults = function () {
                var bvm;
                bvm = this.getBrowserManager();
                return bvm.getValidationResults();
            };

            this.removeListener = function (listener) {
                listeners.remove(listener);
            };

            this.validate = function () {
                var bvm;
                bvm = this.getBrowserManager();
                return bvm.validate.apply(bvm, arguments);
            };

            // Create a validation manager for each browser
            browsers = tabbrowser.browsers;
            for (i = 0; i < browsers.length; ++i) {
                createBVM(browsers[i]);
            }

            tabbrowser.tabContainer.addEventListener("TabOpen", onTabOpen, false);
            tabbrowser.tabContainer.addEventListener("TabClose", onTabClose, false);
            tabbrowser.tabContainer.addEventListener("TabSelect", onTabSelect, false);
        }

        return WindowValidationManager;
    }
);

// vi: set sts=4 sw=4 et :
