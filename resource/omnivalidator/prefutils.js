/* Misc utility functions for dealing with preferences
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
        "underscore"
    ],
    function (underscore) {
        "use strict";

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

            childPrefNames = prefBranch.getDescendantNames(prefName, {});
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

            if (typeof value !== "object") {
                prefBranch.setValue(prefName, value);
            } else {
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
            }
        }

        /** Gets the names of all descendants of the named prefBranch, up to,
         * but not including the first "." after the branch name.
         *
         * Important:  Behaves like getDescendantNames where the given branch
         * name is a filter relative to the branch root.
         */
        function getChildNames(prefBranch, branchName) {
            var childNames, prefNames, prefixLength;

            branchName = concat(branchName);
            prefNames = prefBranch.getDescendantNames(branchName);

            prefixLength = branchName.length;

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
        }

        /** Gets a set of preference values representing an array at a given
         * branch.
         *
         * Arrays are represented as preferences with names in object notation
         * below the branch name for the array. (e.g. x.0, x.1)
         *
         * If the branch does not exist, or does not have any numeric children,
         * undefined is returned.
         */
        function getArray(prefBranch, branchName) {
            var childName,
                childNames,
                i,
                result = [];

            branchName = concat(branchName, ".");
            childNames = getChildNames(prefBranch.getBranch(branchName));

            for (i = 0; i < childNames.length; ++i) {
                childName = childNames[i];
                if (/^\d+$/.test(childName)) {
                    result[childName] =
                        getObject(prefBranch, branchName + childName) ||
                        prefBranch.getValue(branchName + childName);
                }
            }

            return result.length === 0 ? undefined : result;
        }

        /** Gets a set of preference values representing an object at a given
         * branch.
         *
         * Objects are represented as preferences with names in object notation
         * below the branch name for the object. (e.g. x.prop0, x.prop1)
         *
         * If an object contains numeric properties, an instance of Array
         * will be returned which contains both numeric and non-numeric
         * properties.
         *
         * If the branch does not exist, or does not have any children,
         * undefined is returned.
         */
        function getObject(prefBranch, branchName) {
            var childBranchName,
                childNames,
                i,
                result;

            childBranchName = concat(branchName, ".");
            childNames = getChildNames(prefBranch.getBranch(childBranchName));
            if (childNames.length === 0) {
                return undefined;
            }

            // If the prefBranch holds an array, add any named properties onto
            // the array object.
            result = getArray(prefBranch, branchName) || {};

            for (i = 0; i < childNames.length; ++i) {
                // Skip properties already added by getArray
                // Note:  Also protects against setting length on array
                if (!result.hasOwnProperty(childNames[i])) {
                    result[childNames[i]] =
                        getObject(prefBranch, childBranchName + childNames[i]) ||
                        prefBranch.getValue(childBranchName + childNames[i]);
                }
            }

            return result;
        }

        /** Gets the object or value at the specified location.
         * If both an object and value are present, the object is returned
         */
        function get(prefBranch, branchName) {
            return getObject(prefBranch, branchName) ||
                prefBranch.getValue(branchName);
        }

        /** Overwrites the value of a preference with a given value.
         *
         * Functions similarly to {@link set}, with the exception that
         * sub-branches/properties which are not present in value are not
         * removed.
         *
         * @param {String} [prefName=""] NSPreferences name (relative to instance
         * root) on which to set the value.
         * @param value Value to store in the preference.
         */
        function overwrite(prefBranch, prefName, value) {
            if (arguments.length === 2) {
                value = prefName;
                prefName = "";
            }

            setPrefInternal(
                prefBranch,
                concat(prefName),
                value,
                []
            );
        }

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
        function set(prefBranch, prefName, value) {
            if (arguments.length === 2) {
                value = prefName;
                prefName = null;
            }

            prefName = concat(prefName);

            if (value &&
                    typeof value === "object" &&
                    !underscore.isEmpty(value)) {
                // Clear this preference, if set
                prefBranch.resetValue(prefName);
                // Delete any child preferences not present in the value
                prunePrefTree(
                    prefBranch,
                    prefName,
                    getChildPrefNamesAsTree(
                        prefBranch.getBranch(prefName + "."),
                        ""
                    ),
                    value
                );
            } else {
                // Value has no children, delete all descendants
                prefBranch.deleteBranch(prefName);
            }

            setPrefInternal(
                prefBranch,
                prefName,
                value,
                []
            );
        }

        return {
            get: get,
            getArray: getArray,
            getChildNames: getChildNames,
            getObject: getObject,
            overwrite: overwrite,
            set: set
        };
    }
);

// vi: set sts=4 sw=4 et :
