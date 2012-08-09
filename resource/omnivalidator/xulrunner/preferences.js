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

        var observers = {},
            prefService = Cc["@mozilla.org/preferences-service;1"]
                .getService(Ci.nsIPrefService);

        /* Like String.concat, except null and undefined are "" */
        function concat(/*args*/) {
            return Array.prototype.join.call(arguments, "");
        }

        function NSObserver(branch, clientObserve) {
            this.branch = branch;
            this.clientObserve = clientObserve;
        }

        NSObserver.prototype.QueryInterface = function (aIID) {
            if (aIID.equals(Ci.nsIObserver) ||
                    aIID.equals(Ci.nsISupports)) {
                return this;
            }
            throw Cr.NS_NOINTERFACE;
        };

        NSObserver.prototype.observe = function (subject, topic, data) {
            this.clientObserve.call(
                null,
                this.branch,
                data.slice(this.branch.branchName.length)
            );
        };

        /** Construct an NSPreferences rooted at a given branch name.
         *
         * Note:  NSPreferences can be used as a singleton object referring
         * to the root branch (e.g. NSPreferences.getValue("foo")), or as a
         * constructor, in which case all methods of the constructed class are
         * relative to the branch name passed to the constructor.
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
        NSPreferences.addObserver = function (branchName, observe) {
            var fullBranchName, observer;

            if (this.isDefault) {
                // Observers fire whenever the primary branch is modified
                // regardless of how the observer was registered.
                throw new Error(
                    "addObserver is not supported on default branches"
                );
            }

            if (arguments.length === 1) {
                observe = branchName;
                branchName = null;
            }

            fullBranchName = concat(this.branchName, branchName);
            observer = new NSObserver(this, observe);
            if (!observers.hasOwnProperty(fullBranchName)) {
                observers[fullBranchName] = [];
            }
            observers[fullBranchName].push(observer);

            prefService.QueryInterface(Ci.nsIPrefBranch2).addObserver(
                fullBranchName,
                observer,
                false
            );
        };

        /** Removes all child preferences of this branch and its default
         * branches (if any).
         *
         * Unspecified if delete on default branch deletes primary
         * (does in NS, doesn't in LS)
         */
        NSPreferences.deleteBranch = function (branchName) {
            this.prefBranch.deleteBranch(concat(branchName));
        };

        /** Gets sub-branch by name (preserves defaultness).
         */
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

        /** Gets the branch providing fallback/default values for this branch,
         * if any.
         */
        NSPreferences.getDefaultBranch = function () {
            return this.isDefault ?
                    null :
                    new NSPreferences(this.branchName, true);
        };

        /** Gets the names of all preferences below this branch (excluding
         * the preference at this branch name, if any)
         *
         * - May return descendant names in any order.
         * - Includes descendant names from chained (default) branches.
         * - Unspecified if getDN on default branch includes names in primary
         *   (does in NS, doesn't in LS).
         */
        NSPreferences.getDescendantNames = function (branchName) {
            branchName = concat(branchName);
            return this.prefBranch.getChildList(branchName, {})
                .filter(function (c) { return c.length > branchName.length; });
        };

        /** Gets the preference value stored at with a given name */
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

        /** Checks if there is a value in this branch with a given name
         * (excluding values in any fallback/default branch).
         */
        NSPreferences.hasValue = function (prefName) {
            prefName = concat(prefName);

            return this.isDefault ?
                    this.getValue(prefName) !== undefined :
                    this.prefBranch.prefHasUserValue(prefName);
        };

        /** Removes a preference observer for a given branch name.
         */
        NSPreferences.removeObserver = function (branchName, observe) {
            var branchObservers, fullBranchName, i;

            if (arguments.length === 1) {
                observe = branchName;
                branchName = null;
            }

            fullBranchName = concat(this.branchName, branchName);
            if (observers.hasOwnProperty(fullBranchName)) {
                branchObservers = observers[fullBranchName];
                for (i = 0; i < branchObservers.length; ++i) {
                    if (branchObservers[i].clientObserve === observe) {
                        prefService.QueryInterface(Ci.nsIPrefBranch2)
                            .removeObserver(fullBranchName, branchObservers[i]);
                        if (branchObservers.length === 1) {
                            delete observers[fullBranchName];
                        } else {
                            branchObservers.splice(i, 1);
                        }
                        return;
                    }
                }
            }
        };

        /** Removes all child preferences of this branch without modifying the
         * values in its default branches (if any).
         */
        NSPreferences.resetBranch = function (branchName) {
            var prefNames;

            prefNames = this.getDescendantNames(branchName);

            // Can't resetValue on default values that have children (since we
            // use deleteBranch internally).  Sort in decreasing nesting level
            // to avoid the problem
            if (this.isDefault) {
                prefNames.sort(function (a, b) {
                    var alen, blen;
                    alen = a.split(".").length;
                    blen = b.split(".").length;
                    return alen > blen ? -1 : alen < blen ? 1 : 0;
                });
            }

            prefNames.forEach(function (prefName) {
                this.resetValue(prefName);
            }, this);
            this.resetValue(branchName);
        };

        /** Removes a given child preference without modifying the value in its
         * default branches (if any).
         */
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

        /** Set the value of a named preference to a given value.
         *
         * @param {String} [prefName=""] Preference name (relative to instance
         * root) on which to set the value.
         * @param value Value to store in the preference.  Must be a primitive
         * data type (boolean, number, or string).
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
