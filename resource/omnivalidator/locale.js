/* Defines functions for localizing messages
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
        "gecko/components/classes",
        "gecko/components/interfaces",
        "gecko/components/results",
        "log4moz",
        "pluralform"
    ],
    function (Cc, Ci, Cr, log4moz, PluralForm) {
        "use strict";

        var PROP_FILE = "chrome://omnivalidator/locale/omnivalidator.properties",
            logger = log4moz.repository.getLogger("omnivalidator.locale"),
            pfGet,
            pfNumForms,
            stringBundle;

        function get(key) {
            return stringBundle.GetStringFromName(key);
        }

        function getLocaleName() {
            var prefBranch = Cc["@mozilla.org/preferences-service;1"]
                .getService(Ci.nsIPrefService)
                .getBranch("general.useragent.");

            // FIXME: Is this the best way to find the current locale for this
            // addon?
            try {
                return prefBranch.getComplexValue(
                    "locale",
                    Ci.nsIPrefLocalizedString
                ).data;
            } catch (ex1) {
                try {
                    return prefBranch.getCharPref("locale");
                } catch (ex2) {
                    logger.warn("Unable to determine current locale", ex2);
                }
            }

            return null;
        }

        function getPlural(num, key) {
            return pfGet(num, get(key));
        }

        function format(key, args) {
            var argArray;

            if (arguments.length === 2 && args instanceof Array) {
                argArray = args;
            } else {
                argArray = Array.prototype.slice.call(arguments);
                argArray.shift();
            }

            try {
                return stringBundle.formatStringFromName(
                    key,
                    argArray,
                    argArray.length
                );
            } catch (ex) {
                switch (ex.result) {
                case Cr.NS_ERROR_OUT_OF_MEMORY:
                    // Note:  This result is returned for any failure in
                    // nsTextFormatter.  Unlikely to be out of memory.
                    logger.error("Error formatting " + key +
                        " for the " + (getLocaleName() || "unknown") + " locale" +
                        " with " + argArray.length + " arguments.");
                    break;
                default:
                    // Not a formatting error, re-throw
                    throw ex;
                }

                // Fallback, return the format string without formatting
                return get(key);
            }
        }

        function formatPlural(num, key, args) {
            var argArray;

            if (arguments.length === 3 && args instanceof Array) {
                argArray = args;
            } else {
                argArray = Array.prototype.slice.call(arguments);
                argArray.shift();
                argArray.shift();
            }

            // FIXME:  Is there a way to call this which does formatting after
            // splitting?
            return pfGet(num, format(key, argArray));
        }

        function init() {
            var getter,
                pluralRule;

            stringBundle = Cc["@mozilla.org/intl/stringbundle;1"]
                .getService(Ci.nsIStringBundleService)
                .createBundle(PROP_FILE);
            pluralRule = parseInt(get("pluralRule"), 10);
            if (!isNaN(pluralRule)) {
                getter = PluralForm.makeGetter(pluralRule);
                pfGet = getter[0];
                pfNumForms = getter[1];
            } else {
                pfGet = PluralForm.get;
                pfNumForms = PluralForm.numforms;
            }
        }

        init();

        return {
            format: format,
            formatPlural: formatPlural,
            get: get,
            getPlural: getPlural
        };
    }
);

// vi: set sts=4 sw=4 et :
