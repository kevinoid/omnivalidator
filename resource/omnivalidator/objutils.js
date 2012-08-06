/* Utility functions for dealing with objects.
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

        /** Object.create for ES3
         *
         * No support for the properties object.
         */
        function createES3(proto) {
            function Constructor() {}
            Constructor.prototype = proto;
            return new Constructor();
        }

        return {
            create: Object.create || createES3
        };
    }
);

// vi: set sts=4 sw=4 et :
