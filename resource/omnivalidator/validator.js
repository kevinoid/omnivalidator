/* Defines Validator base class
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

        function Validator(id, name) {
            this.name = String(name || "");

            // Clients can depend on the id property not changing.
            if (Object.defineProperty) {
                Object.defineProperty(
                    this,
                    "id",
                    {
                        value: String(id || ""),
                        enumerable: true
                    }
                );
            } else {
                this.id = String(id || "");
            }
        }

        return Validator;
    }
);

// vi: set sts=4 sw=4 et :
