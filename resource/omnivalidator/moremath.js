/* Additional math utility functions
 *
 * This file is part of the Omnivalidator extension for Firefox.
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

        // Discussion http://www.mattsnider.com/javascript/random-integers/
        function randInt(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        return {
            randInt: randInt
        };
    }
);

// vi: set sts=4 sw=4 et :
