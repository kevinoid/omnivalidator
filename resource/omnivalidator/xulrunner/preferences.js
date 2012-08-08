/* Implementation of our unified preferences API based on nsIPrefBranch
 *
 * This file is part of the Omnivalidator extension.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true, unparam: true */
/*global define: true */

// TODO:  Implement caching

define(
    [
        "gecko/components/classes",
        "gecko/components/interfaces",
        "gecko/components/results",
        "underscore"
    ],
    function (Cc, Ci, Cr, underscore) {
        "use strict";

        var prefService = Cc["@mozilla.org/preferences-service;1"]
                .getService(Ci.nsIPrefService);

        /* Like String.concat, except null and undefined are "" */
        function concat(/*args*/) {
            return Array.prototype.join.call(arguments, "");
        }

        /** Construct a NSPreferences rooted at a given branch name.
         *
         * Note:  NSPreferences can be used as a namespace (e.g. NSPreferences.get()),
         * in which case all functions refer to the root branch, or as a
         * class, in which case all methods are relative to the branch for
         * which the instance was constructed
         *
         * @constructor
         * @class Represents the set of all preferences rooted at
         * (prefixed with) a given string
         * @param {String|nsIPrefBranch} [branch=""] Either the root (prefix)
         * of preferences included in this branch or a branch to wrap.
         * @param {Boolean} [isDefault=false] Is this branch accessing a
         * default preferences branch?
         */
        function NSPreferences(branch, isDefault) {
            if (branch && typeof branch.QueryInterface === "function") {
                this.prefBranch = branch.QueryInterface(Ci.nsIPrefBranch);
                this.branchName = this.prefBranch.root;
                this.isDefault = !!isDefault;
            } else {
                this.branchName = concat(branch);
                this.prefBranch = isDefault ?
                        prefService.getDefaultBranch(this.branchName) :
                        prefService.getBranch(this.branchName);
                this.isDefault = !!isDefault;
            }
        }

        /** Add an observer to preferences below a given branch.
         *
         * Note:  Unlike the other methods, there is a difference between
         * NSPreferences.getBranch("foo").addObserver("bar", ...) and
         * NSPreferences.getBranch("foo.bar").addObserver("", ...).  The
         * observer is called with a preference name relative to the instance
         * root and branchName acts as a filter.
         */
        NSPreferences.addObserver = function (branchName, observer, weakRef) {
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

        NSPreferences.deleteBranch = function (branchName) {
            this.prefBranch.deleteBranch(concat(branchName));
        };

        NSPreferences.getBranch = function (branchName) {
            if (branchName === undefined ||
                    branchName === null ||
                    branchName === "") {
                return this;
            } else if (typeof this.prefBranch.getBranch === "function") {
                return new NSPreferences(
                    this.prefBranch.getBranch(branchName),
                    this.isDefault
                );
            } else {
                return new NSPreferences(
                    concat(this.branchName, branchName),
                    this.isDefault
                );
            }
        };

        NSPreferences.getDefaultBranch = function () {
            return this.isDefault ?
                    null :
                    new NSPreferences(this.branchName, true);
        };

        NSPreferences.getDescendantNames = function (branchName) {
            branchName = concat(branchName);
            return this.prefBranch.getChildList(branchName, {})
                .filter(function (c) { return c.length > branchName.length; });
        };

        NSPreferences.getValue = function (prefName) {
            var prefType;

            prefName = concat(prefName);
            prefType = this.prefBranch.getPrefType(prefName);

            try {
                switch (prefType) {
                case Ci.nsIPrefBranch.PREF_BOOL:
                    return this.prefBranch.getBoolPref(prefName);
                case Ci.nsIPrefBranch.PREF_INT:
                    return this.prefBranch.getIntPref(prefName);
                case Ci.nsIPrefBranch.PREF_STRING:
                    return this.prefBranch.getCharPref(prefName);
                }
            } catch (ex) {
                // getPrefType returns the type of either branch, and when
                // get*Pref is called on the default branch without a default
                // value it throws 0x8000FFFF (NS_ERROR_UNEXPECTED).
                if (!this.isDefault || ex.result !== 0x8000FFFF) {
                    throw ex;
                }
            }

            return undefined;
        };

        NSPreferences.hasValue = function (prefName) {
            prefName = concat(prefName);

            return this.isDefault ?
                    this.getValue(prefName) !== undefined :
                    this.prefBranch.prefHasUserValue(prefName);
        };

        NSPreferences.removeObserver = function (branchName, observer) {
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

        /**
         * Note that unlike deleteBranch, this method will notify observers
         * of each change.
         */
        NSPreferences.resetBranch = function (branchName) {
            // Note:  nsPrefBranch.resetBranch not implemented
            if (this.isDefault) {
                // TODO:  Implement this fully.
                // Need to:
                // - save non-default values for branch
                // - delete branch
                // - restore non-default values
                // FIXME:  Above impl would send bad observer notifications
                this.prefBranch
                    .getChildList(concat(branchName), {})
                    .forEach(function (prefName) {
                        if (this.prefBranch.prefHasUserValue(prefName)) {
                            throw new Error("resetBranch not implemented for " +
                                "default branches under non-default values");
                        }
                    }, this);
                this.deleteBranch(branchName);
            } else {
                this.prefBranch
                    .getChildList(concat(branchName), {})
                    .forEach(function (prefName) {
                        if (this.prefBranch.prefHasUserValue(prefName)) {
                            this.prefBranch.clearUserPref(prefName);
                        }
                    }, this);
            }
        };

        // TODO:  Provide resetObject and/or decide on plain reset behavior
        NSPreferences.resetValue = function (prefName) {
            var childNames;

            prefName = concat(prefName);

            if (this.isDefault) {
                // TODO:  Implement this fully (see resetBranch).
                if (this.prefBranch.prefHasUserValue(prefName)) {
                    throw new Error("resetValue not implemented for " +
                        "default branches under non-default values");
                }

                childNames = this.prefBranch.getChildList(prefName, {});
                if (childNames.length === 0 || childNames[0] !== prefName) {
                    // No pref with the given name, nothing to reset
                    return;
                }

                if (childNames.length !== 1) {
                    throw new Error("resetValue not implemented for " +
                        "default branch values with child prefs");
                }

                // Safe to delete the entire branch (which only has this value)
                this.deleteBranch(prefName);
            } else {
                // Note:  Gecko < 6 throws NS_ERROR_UNEXPECTED if no user value
                if (this.hasValue(prefName)) {
                    this.prefBranch.clearUserPref(prefName);
                }
            }
        };

        /** Set the value of a preference to a given value.
         *
         * Functions similarly to {@link overwrite}, with the exception that
         * sub-branches/properties which are not present in value will be
         * removed.
         *
         * @param {String} [prefName=""] NSPreferences name (relative to instance
         * root) on which to set the value.
         * @param value Value to store in the preference.
         */
        NSPreferences.setValue = function (prefName, value) {
            if (arguments.length === 1) {
                value = prefName;
                prefName = null;
            }

            prefName = concat(prefName);

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
                this.prefBranch.setBoolPref(prefName, value);
                break;
            case "number":
                // Save non-integers as strings to avoid truncation
                // Should be safe enough given string->number coercion
                if (value % 1 === 0) {
                    this.prefBranch.setIntPref(prefName, value);
                } else {
                    this.prefBranch.setCharPref(prefName, String(value));
                }
                break;
            case "string":
                this.prefBranch.setCharPref(prefName, value);
                break;
            default:
                throw new Error("Can't set non-primitive value");
            }
        };

        // Allow use of the functions as either static functions or
        // methods on an instantiated NSPreferences
        NSPreferences.prototype = underscore.extend({}, NSPreferences);
        NSPreferences.branchName = "";
        NSPreferences.prefBranch = prefService.QueryInterface(Ci.nsIPrefBranch);

        return NSPreferences;
    }
);

// vi: set sts=4 sw=4 et :
