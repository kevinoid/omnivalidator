/* Implementation of a multi-trie (aka multi-prefix tree) implemented as a
 * Radix tree.
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
        "omnivalidator/arrayutils"
    ],
    function (arrayutils) {
        "use strict";

        /* Tree invariants:
         * - No sibling nodes share a common prefix.
         * - All leaf and single-child nodes have data.
         * - Children are sorted in order of prefix.
         * - The children property is null or has length > 0
         * - The data property is null or has length > 0
         */

        /** Gets the length of the common prefix of 2 strings */
        function commonPrefixLen(str1, str2) {
            var i, minLen;

            minLen = Math.min(str1.length, str2.length);
            for (i = 0; i < minLen; ++i) {
                if (str1.charCodeAt(i) !== str2.charCodeAt(i)) {
                    return i;
                }
            }

            return i;
        }

        /** Compare tree nodes to string keys based on prefix.
         * Only used for sortedIndex, so only needs < operation.
         */
        function compareTreeName(node, key) {
            return node.prefix < key ? -1 : 0;
        }

        /** Checks if a string starts with a given prefix */
        function startsWith(str, prefix) {
            return str.lastIndexOf(prefix, 0) === 0;
        }

        /** Checks if a key belongs in a given tree.
         * ("in" may indicate being in a new tree beside the given node)
         */
        function inTree(tree, key) {
            return tree.prefix.charCodeAt(0) === key.charCodeAt(0);
        }

        /** Merges the children of a node into the node, if permitted. */
        function checkMergeUp(node) {
            var child;
            if (!node.data && node.children.length === 1) {
                child = node.children[0];
                node.prefix += child.prefix;
                node.data = child.data;
                node.children = child.children;
            }
        }

        /** Get data for a given key in a given tree */
        function get(tree, key) {
            var child, children, i;

            children = tree.children;
            if (!children) {
                return null;
            }

            i = arrayutils.sortedIndex(
                children,
                key,
                compareTreeName
            );
            if (i < children.length && children[i].prefix === key) {
                return children[i].data;
            } else if (i > 0 && startsWith(key, children[i - 1].prefix)) {
                child = children[i - 1];
                return get(child, key.slice(child.prefix.length));
            } else {
                return null;
            }
        }

        /** Get data for all keys which are prefixes of a given key, store
         * prefix->data mapping in acc */
        function getPrefixes(node, key, prefix, acc) {
            var child, children, i;

            prefix += node.prefix;
            if (node.data) {
                acc[prefix] = node.data;
            }

            children = node.children;
            if (!children) {
                return;
            }

            i = arrayutils.sortedIndex(
                children,
                key,
                compareTreeName
            );
            if (i < children.length && children[i].prefix === key) {
                getPrefixes(children[i], "", prefix, acc);
            } else if (i > 0 && startsWith(key, children[i - 1].prefix)) {
                child = children[i - 1];
                getPrefixes(child, key.slice(child.prefix.length), prefix, acc);
            }
        }

        /** Insert data with a given key into the children of a given tree node.
         */
        function add(tree, key, data) {
            var child, children, i, prefixLen;

            children = tree.children;
            if (!children) {
                // If tree has no children, make a new child with the given data
                tree.children = [ {
                    prefix: key,
                    data: [ data ],
                    children: null
                } ];
            } else {
                // Otherwise, find the index at which it would be inserted
                i = arrayutils.sortedIndex(
                    children,
                    key,
                    compareTreeName
                );
                if (i < children.length && inTree(children[i], key)) {
                    // Belongs in, above, or beside child i
                    child = children[i];
                    if (key === child.prefix) {
                        // Belongs in this child
                        if (!child.data) {
                            child.data = [ data ];
                        } else {
                            child.data.push(data);
                        }
                    } else if (startsWith(child.prefix, key)) {
                        // Belongs above this child
                        children[i - 1] = {
                            prefix: key,
                            data: [ data ],
                            children: [ child ]
                        };
                        child.prefix = child.prefix.slice(key.length);
                    } else {
                        // Belongs beside this child
                        // Note:  child.prefix is not a prefix of key
                        // because sortedIndex would have returned i-1
                        prefixLen = commonPrefixLen(key, child.prefix);
                        children[i] = {
                            prefix: key.slice(0, prefixLen),
                            data: null,
                            children: [
                                {
                                    prefix: key.slice(prefixLen),
                                    data: [ data ],
                                    children: null
                                },
                                child
                            ]
                        };
                        child.prefix = child.prefix.slice(prefixLen);
                    }
                } else if (i > 0 && inTree(children[i - 1], key)) {
                    // Belongs below or beside child i - 1
                    child = children[i - 1];
                    if (startsWith(key, child.prefix)) {
                        // Belongs below this child
                        add(child, key.slice(child.prefix.length), data);
                    } else {
                        // Belongs beside this child
                        prefixLen = commonPrefixLen(key, child.prefix);
                        children[i - 1] = {
                            prefix: key.slice(0, prefixLen),
                            data: null,
                            children: [
                                child,
                                {
                                    prefix: key.slice(prefixLen),
                                    data: [ data ],
                                    children: null
                                }
                            ]
                        };
                        child.prefix = child.prefix.slice(prefixLen);
                    }
                } else {
                    // Belongs between i - 1 and i
                    children.splice(i, 0, {
                        prefix: key,
                        data: [ data ],
                        children: null
                    });
                }
            }
        }

        /** Remove data from a given node if it matches according to dataEq */
        function removeData(node, data, dataEq) {
            var i;

            if (!node.data) {
                // No data to remove
                return false;
            } else if (data === undefined) {
                // Remove all data in this node
                node.data = null;
                return true;
            } else if (node.data.length === 1) {
                if (dataEq(node.data[0], data)) {
                    // Remove only data in this node
                    node.data = null;
                    return true;
                } else {
                    // Not in this node
                    return false;
                }
            } else {
                for (i = 0; i < node.data.length; ++i) {
                    if (dataEq(node.data[i], data)) {
                        node.data.splice(i, 1);
                        return true;
                    }
                }
                return false;
            }
        }

        /** Removes data with a given key in the children of a given tree node.
         */
        function remove(tree, key, data, dataEq) {
            var child, children, i, removed;

            children = tree.children;
            if (!children) {
                // This node has no children, key is not present
                return false;
            }

            i = arrayutils.sortedIndex(
                children,
                key,
                compareTreeName
            );
            if (i < children.length && children[i].prefix === key) {
                // Key is in this child, if anywhere
                child = children[i];
                removed = removeData(child, data, dataEq);
                if (removed && !child.data) {
                    // Removed all data in child
                    if (!child.children) {
                        // Node has no data and no children, remove it
                        if (children.length === 1) {
                            tree.children = children = null;
                        } else {
                            children.splice(i, 1);
                            // Parent may now have single child and no data
                            checkMergeUp(tree);
                        }
                    } else {
                        // Child may now have single child and no data
                        checkMergeUp(child);
                    }
                }
                return removed;
            } else if (i > 0 && startsWith(key, children[i - 1].prefix)) {
                // key is under child i - 1, if anywhere
                child = children[i - 1];
                return remove(
                    child,
                    key.slice(child.prefix.length),
                    data,
                    dataEq
                );
            } else {
                // key is not in child i or under child i - 1
                return false;
            }
        }

        function toString(node, indent) {
            var i, str = indent;

            str += node.prefix || "(root)";
            if (node.data) {
                str += ": " + node.data;
            }

            if (node.children) {
                indent += "  ";
                for (i = 0; i < node.children.length; ++i) {
                    str += "\n" + toString(node.children[i], indent);
                }
            }

            return str;
        }

        function MultiTrie(dataEq) {
            var root = {
                    prefix: "",
                    data: null,
                    children: null
                };

            if (!dataEq) {
                dataEq = function (d1, d2) { return d1 === d2; };
            }

            this.add = function (key, data) {
                if (key === root.prefix) {
                    if (!root.data) {
                        root.data = [ data ];
                    } else {
                        root.data.push(data);
                    }
                } else {
                    add(root, key, data);
                }
            };

            this.get = function (key) {
                var data = this.getAll(key);
                if (data.length === 0) {
                    return undefined;
                } else {
                    return data[data.length - 1];
                }
            };

            this.getAll = function (key) {
                if (key === root.prefix) {
                    return root.data || [];
                } else {
                    return get(root, key) || [];
                }
            };

            this.getPrefixes = function (key) {
                var prefixData = {};
                getPrefixes(root, key, "", prefixData);
                return prefixData;
            };

            this.isEmpty = function () {
                return !root.data && !root.children;
            };

            this.remove = function (key, data) {
                if (key === root.prefix) {
                    return removeData(root, data, dataEq);
                } else {
                    return remove(root, key, data, dataEq);
                }
            };

            this.toString = function () {
                return "[MultiTrie\n" + toString(root, "") + "]"
            };
        }

        return MultiTrie;
    }
);

// vi: set sts=4 sw=4 et :
