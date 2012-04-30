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
        "gecko/components/results",
        "omnivalidator/globaldefs",
        "underscore"
    ],
    function (Cc, Ci, Cr, globaldefs, underscore) {
        "use strict";

            // Hold extension pref branch as a convenience for users
            // To allow extension-wide observers without holding the reference
            // by each user
        var extPrefBranch,
            prefService = Cc["@mozilla.org/preferences-service;1"]
                .getService(Ci.nsIPrefService);

        /* Like String.concat, except null and undefined are "" */
        function concat(/*args*/) {
            return Array.prototype.join.call(arguments, "");
        }

        /** Add each part of a prefName as a property of the subtree for the
         * part before it.
         */
        function addPrefNameToTree(prefName, tree) {
            prefName.split(".").reduce(
                function (subtree, prefPart) {
                    return (subtree[prefPart] = subtree[prefPart] || {});
                },
                tree
            );
        }

        function getChildPrefNamesAsTree(prefBranch, prefName) {
            var childPrefNames,
                i,
                tree = {};

            childPrefNames = prefBranch.getChildList(prefName, {});
            for (i = 0; i < childPrefNames.length; ++i) {
                addPrefNameToTree(childPrefNames[i], tree);
            }

            return tree;
        }

        /** Remove all preferences which are not in refTree */
        function prunePrefTree(prefBranch, prefName, prefTree, refTree) {
            var prop;

            for (prop in prefTree) {
                if (prefTree.hasOwnProperty(prop)) {
                    if (refTree.hasOwnProperty(prop) && refTree[prop]) {
                        prunePrefTree(
                            prefBranch,
                            prefName + "." + prop,
                            prefTree[prop],
                            refTree[prop]
                        );
                    } else {
                        prefBranch.deleteBranch(prefName + "." + prop);
                    }
                }
            }
        }

        function setPrefInternal(prefBranch, prefName, value, seen) {
            var prop;

            if (value === null || value === undefined) {
                // FIXME:  Can't store in preferences.  Ignore or throw?
                // Probably want to ignore unused array indexes...
                // Could interpret as "reset to default"...
                return;
            }

            // FIXME:  Do we want to check for toPreference on primitive
            // type wrappers for primitives?

            if (typeof value.toPreference === "function") {
                value = value.toPreference(prefName);
            }

            // Unwrap primitive wrappers
            if (typeof value === "object") {
                switch (Object.prototype.toString.call(value)) {
                case '[object Boolean]':
                case '[object Number]':
                case '[object String]':
                    value = value.valueOf();
                    break;
                }
            }

            switch (typeof value) {
            case "boolean":
                prefBranch.setBoolPref(prefName, value);
                break;
            case "number":
                // Save non-integers as strings to avoid truncation
                // Should be safe enough given string->number coercion
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
                if (seen.indexOf(value) !== -1) {
                    throw new TypeError("cyclic object value");
                }
                seen.push(value);

                for (prop in value) {
                    if (value.hasOwnProperty(prop)) {
                        if (prop.indexOf(".") !== -1) {
                            throw new TypeError("property name \"" + prop +
                                "\" creates ambiguity");
                        }

                        setPrefInternal(
                            prefBranch,
                            prefName + "." + prop,
                            value[prop],
                            seen
                        );
                    }
                }

                seen.pop();
                break;
            }
        }

        /** Construct a Preferences rooted at a given branch name.
         *
         * Note:  Preferences can be used as a namespace (e.g. Preferences.get()),
         * in which case all functions refer to the root branch, or as a
         * class, in which case all methods are relative to the branch for
         * which the instance was constructed
         *
         * @constructor
         * @class Represents the set of all preferences rooted at
         * (prefixed with) a given string
         * @param {String} [branchName=""] Root (prefix) of preferences
         * included in this branch.
         */
        function Preferences(branchName) {
            this.branchName = concat(branchName);
            this.prefBranch = prefService.getBranch(this.branchName);
        }

        /** Add an observer to preferences below a given branch.
         *
         * Note:  Unlike the other methods, there is a difference between
         * Preferences.getBranch("foo").addObserver("bar", ...) and
         * Preferences.getBranch("foo.bar").addObserver("", ...).  The
         * observer is called with a preference name relative to the instance
         * root and branchName acts as a filter.
         */
        Preferences.addObserver = function (branchName, observer, weakRef) {
            if (arguments.length === 1) {
                observer = branchName;
                branchName = null;
            }

            // Patch up the observer for the client
            // FIXME: This is intrusive, but it's also an implementation detail
            // that we would like to hide from the caller... reconsider?
            if (weakRef && typeof observer.QueryInterface !== "function") {
                observer.QueryInterface = function (aIID) {
                    if (aIID.equals(Ci.nsIObserver) ||
                            aIID.equals(Ci.nsISupportsWeakReference) ||
                            aIID.equals(Ci.nsISupports)) {
                        return this;
                    }
                    throw Cr.NS_NOINTERFACE;
                };
            }

            if (!this.prefBranch2) {
                this.prefBranch2 =
                    this.prefBranch.QueryInterface(Ci.nsIPrefBranch2);
            }

            this.prefBranch2.addObserver(
                concat(branchName),
                observer,
                Boolean(weakRef)
            );
        };

        Preferences.deleteBranch = function (branchName) {
            this.prefBranch.deleteBranch(concat(branchName));
        };

        /** Gets the object or value at the specified location.
         * If both an object and value are present, the object is returned
         */
        Preferences.get = function (branchName) {
            return this.getObject(branchName) ||
                this.getValue(branchName);
        };

        Preferences.getArray = function (branchName) {
            var childName,
                childNames,
                i,
                result = [];

            branchName = concat(branchName, ".");
            childNames = this.getBranch(branchName).getChildNames();

            for (i = 0; i < childNames.length; ++i) {
                childName = childNames[i];
                if (/^\d+$/.test(childName)) {
                    result[childName] =
                        this.getObject(branchName + childName) ||
                        this.getValue(branchName + childName);
                }
            }

            return result;
        };

        Preferences.getBranch = function (branchName) {
            if (branchName === undefined ||
                    branchName === null ||
                    branchName === "") {
                return this;
            } else {
                return new Preferences(concat(this.branchName, branchName));
            }
        };

        /** Gets the names of all descendants of the named branch, up to, but
         * not including the first "." after the named portion.
         */
        Preferences.getChildNames = function (branchName) {
            var childNames, prefNames, prefixLength;

            branchName = concat(branchName);
            prefNames = this.getDescendantNames(branchName);

            prefixLength = branchName.length;
            if (branchName.slice(-1) === ".") {
                ++prefixLength;
            }

            childNames = underscore.uniq(
                prefNames.map(function (prefName) {
                    var dotInd = prefName.indexOf(".", prefixLength);
                    if (dotInd === -1) {
                        return prefName;
                    } else {
                        return prefName.slice(0, dotInd);
                    }
                })
            );

            return childNames;
        };

        Preferences.getDescendantNames = function (branchName) {
            return this.prefBranch.getChildList(concat(branchName), {})
                .filter(function (c) { return c.length > 0; });
        };

        Preferences.getObject = function (branchName) {
            var childBranchName,
                childNames,
                i,
                result;

            childBranchName = concat(branchName, ".");
            childNames = this.getBranch(childBranchName).getChildNames();
            if (childNames.length === 0) {
                // FIXME:  undefined, null, or {}?  Decide and document.
                // Note:  Other methods currently depend on falseyness
                return undefined;
            }

            // If the branch holds an array, add any named properties onto
            // the array object.
            result = this.getArray(branchName);
            if (result.length === 0) {
                result = {};
            }

            for (i = 0; i < childNames.length; ++i) {
                // Skip properties already added by getArray
                // Note:  Also protects against setting length on array
                if (!result.hasOwnProperty(childNames[i])) {
                    result[childNames[i]] =
                        this.getObject(childBranchName + childNames[i]) ||
                        this.getValue(childBranchName + childNames[i]);
                }
            }

            return result;
        };

        Preferences.getValue = function (prefName) {
            prefName = concat(prefName);

            switch (this.prefBranch.getPrefType(prefName)) {
            case Ci.nsIPrefBranch.PREF_BOOL:
                return this.prefBranch.getBoolPref(prefName);
            case Ci.nsIPrefBranch.PREF_INT:
                return this.prefBranch.getIntPref(prefName);
            case Ci.nsIPrefBranch.PREF_STRING:
                return this.prefBranch.getCharPref(prefName);
            }

            return undefined;
        };

        Preferences.hasUserValue = function (prefName) {
            return this.prefBranch.prefHasUserValue(concat(prefName));
        };

        /** Overwrites the value of a preference with a given value.
         *
         * Functions similarly to {@link set}, with the exception that
         * sub-branches/properties which are not present in value are not
         * removed.
         *
         * @param {String} [prefName=""] Preferences name (relative to instance
         * root) on which to set the value.
         * @param value Value to store in the preference.
         */
        Preferences.overwrite = function (prefName, value) {
            if (arguments.length === 1) {
                value = prefName;
                prefName = "";
            }

            setPrefInternal(
                this.prefBranch,
                concat(prefName),
                value,
                []
            );
        };

        Preferences.removeObserver = function (branchName, observer) {
            if (arguments.length === 1) {
                observer = branchName;
                branchName = null;
            }

            if (this.prefBranch2) {
                this.prefBranch2.removeObserver(
                    concat(branchName),
                    observer
                );
            }
        };

        // TODO:  Provide resetObject and/or decide on plain reset behavior
        Preferences.resetValue = function (prefName) {
            prefName = concat(prefName);
            // Note:  In Gecko < 6, throws NS_ERROR_UNEXPECTED if no user value
            if (this.hasUserValue(prefName)) {
                this.prefBranch.clearUserPref(prefName);
            }
        };

        /** Set the value of a preference to a given value.
         *
         * Functions similarly to {@link overwrite}, with the exception that
         * sub-branches/properties which are not present in value will be
         * removed.
         *
         * @param {String} [prefName=""] Preferences name (relative to instance
         * root) on which to set the value.
         * @param value Value to store in the preference.
         */
        Preferences.set = function (prefName, value) {
            if (arguments.length === 1) {
                value = prefName;
                prefName = null;
            }

            prefName = concat(prefName);

            if (value &&
                    typeof value === "object" &&
                    !underscore.isEmpty(value)) {
                // Clear this preference, if set
                this.resetValue(prefName);
                // Delete any child preferences not present in the value
                prunePrefTree(
                    this.prefBranch,
                    prefName,
                    getChildPrefNamesAsTree(
                        this.getBranch(prefName + ".").prefBranch,
                        ""
                    ),
                    value
                );
            } else {
                // Value has no children, delete all descendants
                this.prefBranch.deleteBranch(prefName);
            }

            setPrefInternal(
                this.prefBranch,
                prefName,
                value,
                []
            );
        };

        // Allow use of the functions as either static functions or
        // methods on an instantiated Preferences
        Preferences.prototype = underscore.extend({}, Preferences);
        Preferences.branchName = "";
        Preferences.prefBranch = prefService.QueryInterface(Ci.nsIPrefBranch);

        // Non-instance functions
        extPrefBranch = new Preferences(globaldefs.EXT_PREF_PREFIX);
        Preferences.getExtPrefBranch = function () {
            return extPrefBranch;
        };

        return Preferences;
    }
);

// vi: set sts=4 sw=4 et :
