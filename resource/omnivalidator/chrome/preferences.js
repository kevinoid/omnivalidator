/* Implementation of our unified preferences API backed by localStorage.
 *
 * This file is part of the Omnivalidator extension.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true, unparam: true */
/*global define, localStorage */

define(
    [
        "omnivalidator/arrayutils",
        "omnivalidator/multitrie",
        "underscore"
    ],
    function (arrayutils, MultiTrie, underscore) {
        "use strict";

        var DEFAULT_PREFIX = "prefdefaults.",
            PREF_PREFIX = "prefs.",
            observers = new MultiTrie(function (o1, o2) {
                return o1.observe === o2.observe && o1.root === o2.root;
            }),
            // Names of all stored preferences, sorted, by prefix
            // Since localStorage can't provide keys by prefix quickly
            prefNamesBySP = {};

        /* Like String.concat, except null and undefined are "" */
        function concat(/*args*/) {
            return Array.prototype.join.call(arguments, "");
        }

        function startsWith(str, prefix) {
            return str.lastIndexOf(prefix, 0) === 0;
        }

        function getPrefNamesFromStorage(storage, prefix) {
            var i, key, len, names;

            names = [];
            len = storage.length;
            for (i = 0; i < len; ++i) {
                key = storage.key(i);
                if (startsWith(key, prefix)) {
                    names.push(key.slice(prefix.length));
                }
            }

            names.sort();

            return names;
        }

        function fireChange(key) {
            var prefix, keyObservers;

            function callObserver(keyObserver) {
                keyObserver.observe.call(
                    null,
                    keyObserver.branch,
                    key.slice(keyObserver.root.length)
                );
            }

            keyObservers = observers.getPrefixes(key);
            for (prefix in keyObservers) {
                if (keyObservers.hasOwnProperty(prefix)) {
                    keyObservers[prefix].forEach(callObserver);
                }
            }
        }

        /** Construct an LSPreferences rooted at a given branch name.
         *
         * Note:  LSPreferences can be used as a singleton object referring
         * to the root branch (e.g. LSPreferences.getValue("foo")), or as a
         * constructor, in which case all methods of the constructed class are
         * relative to the branch name passed to the constructor.
         *
         * @constructor
         * @class Represents the set of all preferences rooted at
         * (prefixed with) a given string
         * @param {String|nsIPrefBranch} [branch=""] Either the root (prefix)
         * of preferences included in this branch or a branch to wrap.
         * @param {String} [storagePrefix="prefs."] A string to prefix all
         * preference names with when adding the preference to localStorage.
         * @param {LSPreferences} [defaultBranch=LSPreferences] A
         * fallback/default branch to query when preferences are not found in
         * this branch.
         */
        function LSPreferences(branchName, storagePrefix, defaultBranch) {
            this.branchName = concat(branchName);

            if (storagePrefix === undefined || storagePrefix === null) {
                storagePrefix = PREF_PREFIX;
            } else {
                storagePrefix = concat(storagePrefix);
            }

            this.storagePrefix = storagePrefix;
            if (!prefNamesBySP.hasOwnProperty(storagePrefix)) {
                prefNamesBySP[storagePrefix] =
                    getPrefNamesFromStorage(localStorage, storagePrefix);
            }

            if (defaultBranch === undefined) {
                this.defaultBranch = new LSPreferences(
                    this.branchName,
                    DEFAULT_PREFIX,
                    null
                );
            } else {
                this.defaultBranch = defaultBranch;
            }
        }

        /** Add an observer of preferences below a given branch.
         *
         * Note:  Unlike the other methods, there is a difference between
         * Preferences.getBranch("foo").addObserver("bar", ...) and
         * Preferences.getBranch("foo.bar").addObserver("", ...).  The
         * observer is called with a preference name relative to the instance
         * root and branchName acts as a filter.
         */
        LSPreferences.addObserver = function (branchName, observe) {
            if (arguments.length === 1) {
                observe = branchName;
                branchName = null;
            }

            observers.add(
                concat(this.storagePrefix, this.branchName, branchName),
                {
                    branch: this,
                    observe: observe,
                    root: this.storagePrefix + this.branchName
                }
            );
        };

        /** Removes all child preferences of this branch and its default
         * branches (if any).
         *
         * Unspecified if delete on default branch deletes primary
         * (does in NS, doesn't in LS)
         */
        LSPreferences.deleteBranch = function (branchName) {
            if (this.defaultBranch) {
                this.defaultBranch.deleteBranch(branchName);
            }

            this.resetBranch(branchName);
        };

        /** Gets sub-branch by name (preserves defaultness).
         */
        LSPreferences.getBranch = function (branchName) {
            if (branchName === undefined ||
                    branchName === null ||
                    branchName === "") {
                return this;
            } else {
                return new LSPreferences(
                    concat(this.branchName, branchName),
                    this.storagePrefix,
                    this.defaultBranch ?
                            this.defaultBranch.getBranch(branchName) :
                            null
                );
            }
        };

        /** Gets the branch providing fallback/default values for this branch,
         * if any.
         */
        LSPreferences.getDefaultBranch = function () {
            return this.defaultBranch;
        };

        /** Gets the names of all preferences below this branch (excluding
         * the preference at this branch name, if any)
         *
         * - May return descendant names in any order.
         * - Includes descendant names from chained (default) branches.
         * - Unspecified if getDN on default branch includes names in primary
         *   (does in NS, doesn't in LS).
         */
        LSPreferences.getDescendantNames = function (branchName) {
            var descendants, fullBranchName, i, prefNames, start, trimlen;

            fullBranchName = concat(this.branchName, branchName);
            prefNames = prefNamesBySP[this.storagePrefix];

            i = start = arrayutils.sortedIndex(prefNames, fullBranchName);

            // Skip self
            if (i < prefNames.length && prefNames[i] === fullBranchName) {
                ++start;
                ++i;
            }

            while (i < prefNames.length &&
                    startsWith(prefNames[i], fullBranchName)) {
                ++i;
            }

            trimlen = this.branchName.length;
            descendants = prefNames
                .slice(start, i)
                .map(function (prefName) {
                    return prefName.slice(trimlen);
                });

            if (this.defaultBranch) {
                descendants = arrayutils.mergeUniq(
                    descendants,
                    this.defaultBranch.getDescendantNames(branchName)
                );
            }

            return descendants;
        };

        /** Gets the preference value stored at with a given name */
        LSPreferences.getValue = function (prefName) {
            var item, val;

            item = localStorage.getItem(
                concat(this.storagePrefix, this.branchName, prefName)
            );

            if (item === null) {
                if (this.defaultBranch) {
                    val = this.defaultBranch.getValue(prefName);
                } else {
                    val = undefined;
                }
            } else {
                val = JSON.parse(item);
            }

            return val;
        };

        /** Checks if there is a value in this branch with a given name
         * (excluding values in any fallback/default branch).
         */
        LSPreferences.hasValue = function (prefName) {
            return localStorage.getItem(
                    concat(this.storagePrefix, this.branchName, prefName)
                ) !== null;
        };

        /** Removes a preference observer for a given branch name.
         */
        LSPreferences.removeObserver = function (branchName, observe) {
            if (arguments.length === 1) {
                observe = branchName;
                branchName = null;
            }

            observers.remove(
                concat(this.storagePrefix, this.branchName, branchName),
                {
                    branch: this,
                    observe: observe,
                    root: this.storagePrefix + this.branchName
                }
            );
        };

        /** Removes all child preferences of this branch without modifying the
         * values in its default branches (if any).
         */
        LSPreferences.resetBranch = function (branchName) {
            this.resetValue(branchName);
            this.getDescendantNames(branchName)
                .forEach(function (prefName) {
                    this.resetValue(prefName);
                }, this);
        };

        /** Removes a given child preference without modifying the value in its
         * default branches (if any).
         */
        LSPreferences.resetValue = function (prefName) {
            var i, prefNames, storeName;

            prefName = concat(this.branchName, prefName);
            prefNames = prefNamesBySP[this.storagePrefix];

            i = arrayutils.sortedIndex(prefNames, prefName);
            if (i < prefNames.length && prefNames[i] === prefName) {
                prefNames.splice(i, 1);
            }

            storeName = this.storagePrefix + prefName;
            if (localStorage.getItem(storeName) !== null) {
                localStorage.removeItem(storeName);
                fireChange(storeName);
            }
        };

        /** Set the value of a named preference to a given value.
         *
         * @param {String} [prefName=""] Preference name (relative to instance
         * root) on which to set the value.
         * @param value Value to store in the preference.  Must be a primitive
         * data type (boolean, number, or string).
         */
        LSPreferences.setValue = function (prefName, value) {
            var i, prefNames, storeName, strValue;

            if (arguments.length === 1) {
                value = prefName;
                prefName = null;
            }

            prefName = concat(this.branchName, prefName);
            prefNames = prefNamesBySP[this.storagePrefix];

            i = arrayutils.sortedIndex(prefNames, prefName);
            if (i === prefNames.length || prefNames[i] !== prefName) {
                prefNames.splice(i, 0, prefName);
            }

            strValue = JSON.stringify(value);
            storeName = this.storagePrefix + prefName;
            if (localStorage.getItem(storeName) !== strValue) {
                localStorage.setItem(storeName, strValue);
                fireChange(storeName);
            }
        };

        // Allow use of the functions as either static functions or
        // methods on an instantiated LSPreferences
        LSPreferences.prototype = underscore.extend({}, LSPreferences);
        LSPreferences.branchName = "";
        LSPreferences.storagePrefix = PREF_PREFIX;
        LSPreferences.defaultBranch = new LSPreferences(
            "",
            DEFAULT_PREFIX,
            null
        );

        return LSPreferences;
    }
);

// vi: set sts=4 sw=4 et :
