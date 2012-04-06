/* Defines the URLMatcher class
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
    ],
    function () {
        "use strict";

        function URLMatcher() {
            this.prefixes = [];
            this.regexes = [];
        }

        URLMatcher.prototype.addPrefix = function (prefixes) {
            if (!(prefixes instanceof Array)) {
                prefixes = [prefixes];
            }
            Array.prototype.push.apply(this.prefixes, prefixes);
        };

        URLMatcher.prototype.addRegex = function (regexes) {
            var i;

            if (!(regexes instanceof Array)) {
                regexes = [regexes];
            }

            for (i = 0; i < regexes.length; ++i) {
                if (typeof regexes[i] === "string") {
                    regexes[i] = new RegExp(regexes[i]);
                }
            }

            Array.prototype.push.apply(this.regexes, regexes);
        };

        URLMatcher.prototype.matches = function (url) {
            var i,
                prefix;

            for (i = 0; i < this.prefixes.length; ++i) {
                prefix = this.prefixes[i];
                if (url.slice(0, prefix.length) === prefix) {
                    return true;
                }
            }

            for (i = 0; i < this.regexes.length; ++i) {
                if (this.regexes[i].test(url)) {
                    return true;
                }
            }

            return false;
        };

        return URLMatcher;
    }
);

// vi: set sts=4 sw=4 et :
