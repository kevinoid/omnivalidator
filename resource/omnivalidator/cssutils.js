/* Utilities for dealing with CSS
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

        function toArray(classNames) {
            if (!classNames || classNames.length === 0) {
                return [];
            }

            return classNames.trim().split(/\s+/);
        }

        function addClassTo(classNames, className) {
            if (!classNames || classNames.length === 0) {
                return className;
            }

            return classNames + " " + className;
        }

        function removeClassFrom(classNames, nameOrRegEx) {
            var classes, i, newClasses;

            classes = toArray(classNames);
            if (typeof nameOrRegEx === "string") {
                classes.remove(nameOrRegEx);
                newClasses = classes;
            } else {
                newClasses = [];
                for (i = 0; i < classes.length; ++i) {
                    if (!nameOrRegEx.test(classes[i])) {
                        newClasses.push(classes[i]);
                    }
                }
            }

            return newClasses;
        }

        return {
            addClassTo: addClassTo,
            removeClassFrom: removeClassFrom
        };
    }
);

// vi: set sts=4 sw=4 et :
