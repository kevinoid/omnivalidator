/* Misc. utility functions for dealing with arrays
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

        /** Merges two sorted arrays.
         * @returns a sorted array containing a1 and a2.
         */
        function merge(a, b) {
            var c = [], i = 0, j = 0;
            while (i < a.length && j < b.length) {
                if (a[i] < b[j]) {
                    c.push(a[i++]);
                } else {
                    c.push(b[j++]);
                }
            }

            while (i < a.length) {
                c.push(a[i++]);
            }
            while (j < b.length) {
                c.push(b[j++]);
            }

            return c;
        }

        function mergeUniq(a, b) {
            var c = [], i = 0, j = 0, last = {};
            while (i < a.length && j < b.length) {
                if (a[i] < b[j]) {
                    if (a[i] !== last) {
                        last = a[i];
                        c.push(last);
                    }
                    ++i;
                } else {
                    if (b[j] !== last) {
                        last = b[j];
                        c.push(last);
                    }
                    ++j;
                }
            }

            while (i < a.length) {
                if (a[i] !== last) {
                    last = a[i];
                    c.push(last);
                }
                ++i;
            }
            while (j < b.length) {
                if (b[j] !== last) {
                    last = b[j];
                    c.push(last);
                }
                ++j;
            }

            return c;
        }

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
            merge: merge,
            mergeUniq: mergeUniq,
            sortedIndex: sortedIndex
        };
    }
);

// vi: set sts=4 sw=4 et :
