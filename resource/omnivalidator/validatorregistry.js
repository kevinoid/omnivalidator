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
            autoURLMatcher,
            autoValidators,
            clickValidators;

        function getValidatorPrefsBranch() {
            return prefs.getExtPrefBranch().getBranch("validators");
        }

        function getValidatorPrefs() {
            return getValidatorPrefsBranch().get();
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
                autoValidators =
                clickValidators = undefined;
        }

        function loadValidators() {
            var validator,
                vid,
                vPrefs = getValidatorPrefs();

            logger.debug("Loading validators");

            allValidators = {};
            autoValidators = [];
            clickValidators = [];

            for (vid in vPrefs) { if (vPrefs.hasOwnProperty(vid)) {
                if (typeof vPrefs[vid].type !== "string") {
                    logger.error("Preferences error:  \"" +
                            String(vPrefs[vid].type) +
                            "\" is not a valid type name");
                    continue;
                }

                logger.debug("Constructing validator " + vid +
                        " (" + vPrefs[vid].name + ")" +
                        " of type " + vPrefs[vid].type +
                        " (auto: " + vPrefs[vid].auto +
                        ", click: " + vPrefs[vid].click +
                        ")");

                validator =
                    objutils.construct(
                        require(vPrefs[vid].type),
                        [vPrefs[vid].name, vPrefs[vid].args]
                    );

                allValidators[vid] = validator;
                if (vPrefs[vid].auto) {
                    autoValidators.push(validator);
                }
                if (vPrefs[vid].click) {
                    clickValidators.push(validator);
                }
            } }
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

        function getNewValidatorID() {
            var i, id, vid;

            id = Math.floor(Math.random() * 10000);
            vid = String(id);

            // Add leading 0s to pad everything to 4 digits
            for (i = 10; i < 10000; i *= 10) {
                if (id < i) {
                    vid = "0" + vid;
                }
            }

            vid = "v" + vid;
            logger.trace("Generated new validator ID " + vid);

            // If the vid is already in use (unlikely), try again
            if (getValidatorPrefsBranch().getValue(vid + ".name")) {
                logger.debug("Collision generating new validator ID");
                return getNewValidatorID();
            }

            return vid;
        }

        // Get the validator names without constructing all the validator
        // objects
        function getNames() {
            var i,
                match,
                prefBranch,
                prefNames,
                valName,
                valNames;

            prefBranch = getValidatorPrefsBranch();
            prefNames = prefBranch.getDescendantNames();
            valNames = {};
            for (i = 0; i < prefNames.length; ++i) {
                match = /^(\w+)\.name$/.exec(prefNames[i]);
                if (match) {
                    valNames[match[1]] = prefBranch.getValue(prefNames[i]);
                }
            }

            return valNames;
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
            getAutoFor: getAutoFor,
            getClickFor: getClickFor,
            getNames: getNames,
            getNewValidatorID: getNewValidatorID
        };
    }
);

// vi: set sts=4 sw=4 et :
