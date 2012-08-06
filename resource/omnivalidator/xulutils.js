/* Misc utility functions for dealing with XUL
 * See also domutils
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
        "omnivalidator/globaldefs",
        "underscore"
    ],
    function (globaldefs, underscore) {
        "use strict";

        /** Convert each element of an associative array to an XUL element
         * (typically listitem or menuitem) with a label attribute set to the
         * value and a value attribute set to the key, then append to a
         * target element or document.
         */
        function listToXul(obj, tagName, target, sortFunc) {
            var doc = target.ownerDocument || target,
                elem,
                i,
                propNames;

            propNames = underscore.keys(obj);
            if (sortFunc) {
                propNames.sort(sortFunc);
            }

            for (i = 0; i < propNames.length; ++i) {
                elem = doc.createElementNS(globaldefs.XUL_NS, tagName);
                elem.setAttribute("label", obj[propNames[i]]);
                elem.setAttribute("value", propNames[i]);
                target.appendChild(elem);
            }

            return target;
        }

        return {
            listToXul: listToXul
        };
    }
);

// vi: set sts=4 sw=4 et :
