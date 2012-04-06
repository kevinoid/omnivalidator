/* Utilities for dealing with classes and objects
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

        // Similar to jQuery.extend
        function extend(target, source) {
            var prop;

            for (prop in source) {
                if (source.hasOwnProperty(prop)) {
                    target[prop] = source[prop];
                }
            }

            return target;
        }

        function clone(obj) {
            return extend({}, obj);
        }

        /** Invoke a Constructor with a given list of arguments
         *
         * From http://stackoverflow.com/questions/3362471/how-can-i-call-a-javascript-constructor-using-call-or-apply
         */
        function construct(Constructor, args) {
            var inst, ret;

            // Constructor to create an empty object with correct prototype
            function Dummy() {}
            Dummy.prototype = Constructor.prototype;

            inst = new Dummy();

            ret = Constructor.apply(inst, args);

            return typeof ret === "object" && ret ? ret : inst;
        }

        function getOwnPropertyNames(obj) {
            var prop, props;

            if (!obj) {
                return [];
            }

            if (obj.getOwnPropertyNames) {
                return obj.getOwnPropertyNames();
            }

            // FIXME:  Is there a way to get non-enumerable properties without
            // getOwnPropertyNames?  Do any implementations provide
            // non-enumerable properties and not provide getOwnPropertyNames?
            props = [];
            for (prop in obj) {
                if (obj.hasOwnProperty(prop)) {
                    props.push(prop);
                }
            }
            return props;
        }

        function hasOwnProperties(obj) {
            var p;

            if (typeof obj === "object") {
                for (p in obj) {
                    if (obj.hasOwnProperty(p)) {
                        return true;
                    }
                }
            }

            return false;
        }

        return {
            clone: clone,
            construct: construct,
            extend: extend,
            getOwnPropertyNames: getOwnPropertyNames,
            hasOwnProperties: hasOwnProperties
        };
    }
);

// vi: set sts=4 sw=4 et :
