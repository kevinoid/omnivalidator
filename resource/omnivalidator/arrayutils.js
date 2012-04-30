/* Misc. utility functions for dealing with arrays
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

        /** Find the lowest index at which an object may be inserted which
         * maintains sorted order using binary search. 
         *
         * Same as underscore.sortedIndex, except it takes a comparator rather
         * than an iterator.
         */
        function sortedIndex(array, obj, comparator) {
            var low = 0, high = array.length, mid;

            comparator = comparator || function (a, b) {
                // Note:  Only care about less-than
                return a < b ? -1 : 0;
            };

            while (low < high) {
                mid = Math.floor((low + high) / 2);
                if (comparator(array[mid], obj) < 0) {
                    low = mid + 1;
                } else {
                    high = mid;
                }
            }

            return low;
        }

        return {
            sortedIndex: sortedIndex
        };
    }
);

// vi: set sts=4 sw=4 et :
