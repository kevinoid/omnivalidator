/* Utility functions for dealing with XPath
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

        /** Quote a string for use in an XPath expression as a string literal.
         */
        function quote(str) {
            var aposind, parts, quotind, start;

            str = String(str);

            // Happy path, can quote whole string
            if ((quotind = str.indexOf('"')) === -1) {
                return '"' + str + '"';
            } else if ((aposind = str.indexOf("'")) === -1) {
                return "'" + str + "'";
            }

            // Unhappy path, must break string into quotable parts
            parts = ["concat("];
            start = 0;
            while (aposind !== -1 && quotind !== -1) {
                // Use whichever quote type would result in larger substring
                if (aposind > quotind) {
                    parts.push("'");
                    parts.push(str.slice(start, aposind));
                    parts.push("'");
                    start = aposind;
                    quotind = str.indexOf('"', start + 1);
                } else {
                    parts.push('"');
                    parts.push(str.slice(start, quotind));
                    parts.push('"');
                    start = quotind;
                    aposind = str.indexOf("'", start + 1);
                }
                parts.push(", ");
            }

            if (aposind === -1) {
                parts.push("'");
                parts.push(str.slice(start));
                parts.push("'");
            } else {
                parts.push('"');
                parts.push(str.slice(start));
                parts.push('"');
            }

            parts.push(")");
            return parts.join("");
        }

        return {
            quote: quote
        };
    }
);

// vi: set sts=4 sw=4 et :
