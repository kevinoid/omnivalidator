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
        "log4moz",
        "omnivalidator/globaldefs",
        "omnivalidator/locale",
        "omnivalidator/predicatemultimap",
        "omnivalidator/preferences",
        "omnivalidator/urlutils",
        "underscore",

        /* Supported validator types */
        "omnivalidator/validatornu",
        "omnivalidator/w3cmarkup"
    ],
    function (log4moz, globaldefs, locale, PredicateMultimap, Preferences,
            urlutils, underscore,

            /* Supported validator types */
            validatornu, w3cmarkup) {
        "use strict";

        var logger = log4moz.repository.getLogger("omnivalidator.validatorregistry"),
            allValidators,
            autoValByURL = new PredicateMultimap(function (url, regex) {
                return regex.test(url);
            }),
            defaultName = locale.get("validatorName.unnamed"),
            // Note:  Must hold reference to prevent observer GC
            validatorsPref = Preferences.getBranch(
                globaldefs.EXT_PREF_PREFIX + "validators."
            ),
            validatorTypes;

        // FIXME:  Is there a way to read the dependency IDs from inside
        // the module?  If so, can avoid repeating these here.
        validatorTypes = {
            "omnivalidator/validatornu":    validatornu,
            "omnivalidator/w3cmarkup":      w3cmarkup
        };

        function getValidatorPrefs() {
            return Preferences.getObject(
                globaldefs.EXT_PREF_PREFIX + "validators"
            ) || {};
        }

        function clearValidators() {
            allValidators = undefined;
            autoValByURL.clear();
        }

        function loadValidators() {
            var autoValidate,
                i,
                validator,
                validatorName,
                vid,
                vPrefs = getValidatorPrefs();

            logger.debug("Loading validators");

            allValidators = {};
            autoValByURL.clear();

            for (vid in vPrefs) { if (vPrefs.hasOwnProperty(vid)) {
                validatorName = vPrefs[vid].name || defaultName;

                if (!validatorTypes.hasOwnProperty(vPrefs[vid].type)) {
                    logger.error("Preferences error:  Validator " + vid +
                            " (" + validatorName + ")" +
                            " has unrecognized type \"" +
                            String(vPrefs[vid].type) +
                            "\"");
                    continue;
                }

                logger.debug("Constructing validator " + vid +
                        " (" + validatorName + ")" +
                        " of type " + vPrefs[vid].type);

                try {
                    validator = new validatorTypes[vPrefs[vid].type](
                        validatorName,
                        vPrefs[vid].args
                    );
                } catch (ex) {
                    logger.error("Unable to construct validator " + vid +
                        " (" + validatorName + ")" +
                        " of type " + vPrefs[vid].type + ": " +
                        ex.message, ex);
                    continue;
                }

                allValidators[vid] = validator;

                autoValidate = vPrefs[vid].autoValidate;
                if (autoValidate) {
                    for (i = 0; i < autoValidate.length; ++i) {
                        try {
                            autoValByURL.put(
                                new RegExp("^" + autoValidate[i]),
                                validator
                            );
                        } catch (ex2) {
                            logger.error(
                                "Unable to add automatic validation to " +
                                    vid + " (" + validatorName + ") for " +
                                    autoValidate[i] + ": " + ex2.message,
                                ex2
                            );
                        }
                    }
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
            var nsurl, validators;

            ensureValidators();

            url = String(url);
            try {
                nsurl = urlutils.getURL(url);
            } catch (ex) {
                // Will throw for about: pages and other non-URL locations
                logger.trace("Unable to parse " + url + ": " + ex.message, ex);
            }

            // Remove reference portion of the URL, if any
            if (nsurl && nsurl.ref) {
                url = url.slice(0, -(nsurl.ref.length + 1));
            }

            // Get validators which match the whole URL
            logger.debug("Getting automatic validators which match " + url);
            validators = autoValByURL.getAll(url);

            // If url is a parseable URL, also add validators which match
            // the host and subsequent portions
            if (nsurl) {
                // Remove scheme and username/password, if any
                url = url.slice(nsurl.scheme.length + 3);
                if (nsurl.userPass) {
                    url = url.slice(nsurl.userPass.length + 1);
                }

                // Get validators which match host, port, path, query
                logger.debug("Getting automatic validators which match " + url);
                Array.prototype.push.apply(
                    validators,
                    autoValByURL.getAll(url)
                );
            }

            return validators;
        }

        function getClickFor(url) {
            ensureValidators();

            return underscore.values(allValidators);
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
            if (validatorsPref.getValue(vid + ".name")) {
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
                prefNames,
                vid,
                valNames;

            prefNames = validatorsPref.getDescendantNames();
            valNames = {};
            for (i = 0; i < prefNames.length; ++i) {
                match = /^(\w+)\.name$/.exec(prefNames[i]);
                if (match) {
                    valNames[match[1]] = validatorsPref.getValue(prefNames[i]);
                } else {
                    // Make sure all validators get a name
                    vid = prefNames[i].split(".")[0];
                    if (!valNames.hasOwnProperty(vid)) {
                        valNames[vid] = defaultName;
                    }
                }
            }

            return valNames;
        }

        function getTypeNames() {
            var prop,
                typeNames;

            typeNames = {};
            for (prop in validatorTypes) {
                if (validatorTypes.hasOwnProperty(prop)) {
                    typeNames[prop] = locale.get(
                        "validatorTypeName." + prop.replace("/", ".")
                    );
                }
            }

            return typeNames;
        }

        function remove(vid) {
            logger.debug("Removing validator " + vid);
            validatorsPref.deleteBranch(vid);
        }

        function removeAll() {
            logger.debug("Removing all validators");
            validatorsPref.deleteBranch();
        }

        // Clear the validators list (causing lazy reload) when Preferences change
        validatorsPref.addObserver("", {
            observe: function () {
                logger.debug("Validator preferences changed, clearing validators");
                clearValidators();
            }
        }, false);

        return {
            getAll: getAll,
            getAutoFor: getAutoFor,
            getClickFor: getClickFor,
            getNames: getNames,
            getNewValidatorID: getNewValidatorID,
            getTypeNames: getTypeNames,
            remove: remove,
            removeAll: removeAll
        };
    }
);

// vi: set sts=4 sw=4 et :
