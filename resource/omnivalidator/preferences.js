/* Defines functions for accessing the Preferences API
 *
 * This file is part of the Omnivalidator extension for Firefox.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true */
/*global define: true */

// TODO:  Implement caching

define(
    [
        "gecko/components/classes",
        "gecko/components/interfaces",
        "omnivalidator/globaldefs",
        "omnivalidator/objutils",
        "underscore"
    ],
    function (Cc, Ci, globaldefs, objutils, underscore) {
        "use strict";

        var prefService = Cc["@mozilla.org/preferences-service;1"]
                .getService(Ci.nsIPrefService);

        /* Exclude null and undefined to accomodate optional arguments */
        function combineBranchNames(/*args*/) {
            var branchNames = [],
                i;

            for (i = 0; i < arguments.length; ++i) {
                if (arguments[i] !== undefined && arguments[i] !== null) {
                    branchNames.push(arguments[i]);
                }
            }

            return branchNames.join(".");
        }

        function PrefBranch(branchName) {
            this.branchName = branchName;
        }

        PrefBranch.prototype.addObserver = function (branchName, observe) {
            var observer,
                prefBranch,
                prefBranch2;

            if (arguments.length === 1) {
                observe = branchName;
                branchName = null;
            }

            prefBranch = prefService.getBranch(
                combineBranchNames(this.branchName, branchName) + "."
            );

            if (typeof observe === "function") {
                observer = { observe: observe };
            } else {
                observer = observe;
            }

            prefBranch2 = prefBranch.QueryInterface(Ci.nsIPrefBranch2);

            prefBranch2.addObserver("", observer, false);

            // Note:  removeObserver must be called on the same instance
            // as addObserver and with the same object.  So we return the
            // unregister function as a convenience.
            return function () {
                prefBranch2.removeObserver("", observer);
            };
        };

        /** Gets the object or value at the specified location.
         * If both an object and value are present, the object is returned
         */
        PrefBranch.prototype.get = function (branchName) {
            var objval;

            objval = this.getObject(branchName);
            if (!objval || !objutils.hasOwnProperties(objval)) {
                objval = this.getValue(branchName);
            }

            return objval;
        };

        PrefBranch.prototype.getArray = function (branchName) {
            var childName,
                childNames,
                i,
                result = [];

            childNames = this.getChildNames(branchName);

            for (i = 0; i < childNames.length; ++i) {
                childName = childNames[i];
                if (/^\d+$/.test(childName)) {
                    result[parseInt(childName, 10)] =
                        this.get(combineBranchNames(branchName, childName));
                }
            }

            return result;
        };

        PrefBranch.prototype.getBranch = function (branchName) {
            return new PrefBranch(combineBranchNames(this.branchName, branchName));
        };

        PrefBranch.prototype.getChildNames = function (branchName) {
            var dnames;

            dnames = this.getDescendantNames(branchName);

            return underscore.uniq(
                dnames.map(function (d) { return d.split('.')[0]; })
            );
        };

        PrefBranch.prototype.getDescendantNames = function (branchName) {
            var prefBranch;

            // Important:  getChildList returns all branch names which have
            // its branch name + argument as a proper prefix.
            // The "." character has no special meaning.
            prefBranch = prefService.getBranch(
                combineBranchNames(this.branchName, branchName) + "."
            );

            return prefBranch.getChildList("", {})
                .filter(function (c) { return c.length > 0; });
        };

        PrefBranch.prototype.getObject = function (branchName) {
            var childNames,
                i,
                result;

            childNames = this.getChildNames(branchName);
            if (childNames.length === 0) {
                return null;
            }

            // If the branch holds an array, add any named properties onto
            // the array object.
            result = this.getArray(branchName);
            if (result.length === 0) {
                result = {};
            }

            for (i = 0; i < childNames.length; ++i) {
                // Skip properties already added by getArray
                if (!/^\d+$/.test(childNames[i])) {
                    result[childNames[i]] =
                        this.get(combineBranchNames(branchName, childNames[i]));
                }
            }

            return result;
        };

        PrefBranch.prototype.getValue = function (branchName, prefName) {
            var prefBranch;

            if (arguments.length === 1) {
                prefName = branchName;
                branchName = null;
            }

            prefBranch = prefService.getBranch(
                combineBranchNames(this.branchName, branchName) + "."
            );

            switch (prefBranch.getPrefType(prefName)) {
            case prefBranch.PREF_BOOL:
                return prefBranch.getBoolPref(prefName);
            case prefBranch.PREF_INT:
                return prefBranch.getIntPref(prefName);
            case prefBranch.PREF_STRING:
                return prefBranch.getCharPref(prefName);
            }

            return null;
        };

        PrefBranch.prototype.set = function (branchName, prefName, value) {
            var i,
                prefBranch,
                prop;

            if (arguments.length === 2) {
                value = prefName;
                prefName = branchName;
                branchName = null;
            }
            prefBranch = prefService.getBranch(
                combineBranchNames(this.branchName, branchName) + "."
            );

            switch (typeof value) {
            case "boolean":
                prefBranch.setBoolPref(prefName, value);
                break;
            case "number":
                // Save non-integers as strings to avoid truncation
                if (value % 1 === 0) {
                    prefBranch.setIntPref(prefName, value);
                } else {
                    prefBranch.setCharPref(prefName, String(value));
                }
                break;
            case "string":
                prefBranch.setCharPref(prefName, value);
                break;
            default:
                if (value instanceof Array) {
                    for (i = 0; i < value.length; ++i) {
                        this.set(
                            combineBranchNames(branchName, prefName, i),
                            value[i]
                        );
                    }
                } else {
                    for (prop in value) {
                        if (value.hasOwnProperty(prop)) {
                            this.set(
                                combineBranchNames(branchName, prefName, prop),
                                value[prop]
                            );
                        }
                    }
                }
            }
        };

        function getExtPrefBranch() {
            return new PrefBranch(globaldefs.EXT_PREF_PREFIX);
        }

        return {
            PrefBranch: PrefBranch,
            getExtPrefBranch: getExtPrefBranch
        };
    }
);

// vi: set sts=4 sw=4 et :
