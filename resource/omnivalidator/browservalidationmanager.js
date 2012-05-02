/* Class to manage the validation state, clear, and initiate validation for a
 * browser.
 *
 * This file is part of the Omnivalidator extension for Firefox.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true */
/*global define */

define(
    [
        "gecko/components/interfaces",
        "gecko/components/results",
        "log4moz",
        "omnivalidator/cacheid",
        "omnivalidator/validatorregistry"
    ],
    function (Ci, Cr, log4moz, CacheID, vregistry) {
        "use strict";

        var logger =
            log4moz.repository.getLogger("omnivalidator.browservalidationmanager");

        function BrowserValidationManager(browser) {
            var currentResourceID = null,
                listeners = [],
                progressListener,   // Must be referenced in closure to avoid gc
                // Holds {messages, summary} for each validator by id
                // Empty indicates validation incomplete
                results = {},
                thisBVM = this;

            function notifyListeners() {
                var i;
                for (i = 0; i < listeners.length; ++i) {
                    listeners[i].apply(null, arguments);
                }
            }

            function onValidate(validator, resourceid, result) {
                var valResult;

                if (resourceid !== currentResourceID) {
                    logger.info("Response from " + validator.logName +
                            " for " + resourceid.uri +
                            " is no longer of interest.");
                    return;
                }

                valResult = results[validator.id];
                if (!valResult) {
                    valResult = { messages: [], summary: {} };
                    results[validator.id] = valResult;
                }

                if (result.message) {
                    valResult.messages.push(result.message);
                }
                if (result.summary) {
                    valResult.summary = result.summary;
                }
                if (result.message || result.summary) {
                    notifyListeners(thisBVM, {
                        browser: browser,
                        message: result.message,
                        summary: result.summary,
                        validator: validator
                    });
                }
            }

            function applyValidators(validators, doc) {
                var i;

                currentResourceID = CacheID.fromDocument(doc);
                for (i = 0; i < validators.length; ++i) {
                    results[validators[i].id] = { messages: [], summary: {} };
                    validators[i].validate(currentResourceID, onValidate);
                }
            }

            // Return only validators which have not yet been run for the
            // current page
            function filterValidators(validators) {
                var filtered = [],
                    i;

                for (i = 0; i < validators.length; ++i) {
                    if (!results.hasOwnProperty(validators[i].id)) {
                        filtered.push(validators[i]);
                    } else {
                        logger.trace("Excluding " + validators[i].logName +
                            " from validation request, already run on this page");
                    }
                }

                return filtered;
            }

            function onStateStop(loadedWindow) {
                var autoValidators;

                autoValidators = vregistry.getAutoFor(
                    loadedWindow.location
                );

                if (autoValidators.length > 0) {
                    logger.debug("Running automatic validators for " +
                        loadedWindow.location);
                    applyValidators(
                        filterValidators(autoValidators),
                        loadedWindow.document
                    );
                } else {
                    logger.debug("No automatic validators configured for " +
                        loadedWindow.location);
                }
            }

            this.addListener = function (listener) {
                listeners.push(listener);
            };

            this.clear = function () {
                logger.debug("BVM clearing validation results");
                currentResourceID = null;
                results = {};
                notifyListeners(thisBVM, {
                    browser: browser,
                    clear: true
                });
            };

            this.dispose = function () {
                browser.removeProgressListener(progressListener);
            };

            this.getBrowser = function () {
                return browser;
            };

            this.getValidationResults = function () {
                return results;
            };

            this.removeListener = function (listener) {
                listeners.remove(listener);
            };

            this.revalidate = function () {
                this.clear();
                this.validate();
            };

            this.validate = function (validatorIDs) {
                var allValidators,
                    i,
                    validator,
                    validators;

                if (validatorIDs) {
                    if (typeof validatorIDs === "string") {
                        validatorIDs = [ validatorIDs ];
                    }

                    logger.debug("Validation with " +
                        validatorIDs.join(", ") + " requested.");

                    allValidators = vregistry.getAll();
                    validators = [];
                    for (i = 0; i < validatorIDs.length; ++i) {
                        validator = allValidators[validatorIDs[i]];
                        if (validator) {
                            validators.push(validator);
                        } else {
                            logger.warn("Request to validate with unrecognized validator " +
                                validatorIDs[i]);
                        }
                    }
                } else {
                    logger.debug("Manual validation requested.");

                    validators = vregistry.getClickFor(
                        browser.contentDocument.location
                    );

                    if (validators.length === 0) {
                        logger.debug("No manual validators registered.");
                    }
                }

                applyValidators(
                    filterValidators(validators),
                    browser.contentDocument
                );
            };

            progressListener = {
                QueryInterface: function (aIID) {
                    if (aIID.equals(Ci.nsIWebProgressListener) ||
                            aIID.equals(Ci.nsISupportsWeakReference) ||
                            aIID.equals(Ci.nsISupports)) {
                        return this;
                    }
                    throw Cr.NS_NOINTERFACE;
                },

                onStateChange: function (aWebProgress, aRequest, aFlag, aStatus) {
                    // Note:  STATE_STOP for STATE_IS_DOCUMENT and
                    // STATE_IS_WINDOW are fired after all dependent
                    // resources are retrieved.
                    // Might be preferable to use DOMContentLoaded, except that
                    // it does not fire for non-HTML/XML resources and could
                    // slow page loading for users.
                    /*jslint bitwise: true */
                    if ((aFlag & Ci.nsIWebProgressListener.STATE_STOP) &&
                            (aFlag & Ci.nsIWebProgressListener.STATE_IS_DOCUMENT)) {
                        logger.trace("Finished loading " +
                                aWebProgress.DOMWindow.location);
                        onStateStop(aWebProgress.DOMWindow);
                    }
                    /*jslint bitwise: false */
                },

                onLocationChange: function (aWebProgress, aRequest, aURI) {
                    logger.trace("Detected location change to " + aURI.spec);
                    thisBVM.clear();
                },

                onProgressChange: function (aWebProgress, aRequest, curSelf, maxSelf, curTot, maxTot) { },
                onStatusChange: function (aWebProgress, aRequest, aStatus, aMessage) { },
                onSecurityChange: function (aWebProgress, aRequest, aState) { }
            };
            browser.addProgressListener(progressListener);
        }

        return BrowserValidationManager;
    }
);

// vi: set sts=4 sw=4 et :
