/* Defines the PredicateMultimap class
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
    ],
    function () {
        "use strict";

        function PredicateMultimap(predicate) {
            var keys = [],
                values = [];

            if (typeof predicate !== "function") {
                throw new Error("predicate must be a function");
            }

            this.clear = function () {
                keys = [];
                values = [];
            };

            this.getFirst = function (key) {
                var i;

                for (i = 0; i < keys.length; ++i) {
                    if (predicate(key, keys[i])) {
                        return values[i];
                    }
                }

                return undefined;
            };

            this.getAll = function (key) {
                var i, result = [];

                for (i = 0; i < keys.length; ++i) {
                    if (predicate(key, keys[i])) {
                        result.push(values[i]);
                    }
                }

                return result;
            };

            this.put = function (key, value) {
                keys.push(key);
                values.push(value);
            };

            this.removeFirst = function (key) {
                var i, removed;

                for (i = 0; i < keys.length; ++i) {
                    if (predicate(key, keys[i])) {
                        removed = values[i];
                        keys.splice(i, 1);
                        values.splice(i, 1);
                        return removed;
                    }
                }

                return undefined;
            };

            this.removeAll = function (key) {
                var i, newkeys = [], newvalues = [], removed = [];

                for (i = 0; i < keys.length; ++i) {
                    if (!predicate(key, keys[i])) {
                        newkeys.push(keys[i]);
                        newvalues.push(values[i]);
                    } else {
                        removed.push(values[i]);
                    }
                }

                keys = newkeys;
                values = newvalues;

                return removed;
            };

            this.size = function () {
                return keys.length;
            };
        }

        return PredicateMultimap;
    }
);

// vi: set sts=4 sw=4 et :
