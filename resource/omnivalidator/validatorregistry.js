/* Defines a registry for the different validator types
 *
 * This file is part of the Omnivalidator extension for Firefox.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint continue: true, indent: 4, plusplus: true */
/*global define */

define(
    [
        "require",
        "log4moz",
        "omnivalidator/objutils",
        "omnivalidator/preferences",
        "omnivalidator/urlmatcher",

        /* Supported validator types */
        "omnivalidator/validatornu",
        "omnivalidator/w3cmarkup"
    ],
    function (require, log4moz, objutils, prefs, URLMatcher) {
        "use strict";

        var logger = log4moz.repository.getLogger("omnivalidator.validatorregistry"),
            allValidators,
            allValidatorsByName,
            autoURLMatcher,
            autoValidators,
            clickValidators;

        function getValidatorPrefs() {
            return prefs.getExtPrefBranch().get("validators");
        }

        function loadAutoURLMatcher() {
            autoURLMatcher = new URLMatcher();
            autoURLMatcher.addPrefix(
                prefs.getExtPrefBranch().getArray("autovalidate")
            );
            autoURLMatcher.addRegex(
                prefs.getExtPrefBranch().getArray("autovalidatere")
            );
        }

        function clearValidators() {
            allValidators =
                allValidatorsByName =
                autoValidators =
                clickValidators = undefined;
        }

        function loadValidators() {
            var i,
                validator,
                vPrefs = getValidatorPrefs();

            logger.debug("Loading validators");

            allValidators = [];
            allValidatorsByName = {};
            autoValidators = [];
            clickValidators = [];

            for (i = 0; i < vPrefs.length; ++i) {
                if (typeof vPrefs[i].module !== "string") {
                    logger.error("Preferences error:  \"" +
                            String(vPrefs[i].module) +
                            "\" is not a valid module name");
                    continue;
                }

                logger.debug("Constructing validator " + i +
                        " (" + vPrefs[i].name + ")" +
                        " from module " + vPrefs[i].module +
                        " (auto: " + vPrefs[i].auto +
                        ", click: " + vPrefs[i].click +
                        ")");

                validator =
                    objutils.construct(
                        require(vPrefs[i].module),
                        [vPrefs[i].name, vPrefs[i].args]
                    );

                allValidators.push(validator);
                allValidatorsByName[validator.name] = validator;
                if (vPrefs[i].auto) {
                    autoValidators.push(validator);
                }
                if (vPrefs[i].click) {
                    clickValidators.push(validator);
                }
            }
        }

        function ensureValidators() {
            if (!allValidators) {
                loadValidators();
            }
        }

        function getAll() {
            ensureValidators();
            return allValidators;
        }

        function getAllByName() {
            ensureValidators();
            return allValidatorsByName;
        }

        function getAutoFor(url) {
            if (autoURLMatcher.matches(url)) {
                ensureValidators();

                return autoValidators;
            }
            return [];
        }

        function getClickFor(url) {
            ensureValidators();

            return clickValidators;
        }

        // Load the autoURLMatcher and reload it when prefs change
        prefs.getExtPrefBranch()
            .getBranch("autovalidate")
            .addObserver(loadAutoURLMatcher);
        prefs.getExtPrefBranch()
            .getBranch("autovalidatere")
            .addObserver(loadAutoURLMatcher);
        loadAutoURLMatcher();

        // Clear the validators list (causing lazy reload) when prefs change
        prefs.getExtPrefBranch()
            .getBranch("validators")
            .addObserver(clearValidators);

        return {
            getAll: getAll,
            getAllByName: getAllByName,
            getAutoFor: getAutoFor,
            getClickFor: getClickFor
        };
    }
);

// vi: set sts=4 sw=4 et :
