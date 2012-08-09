/* Spec for multitrie.js
 *
 * This file is part of the Omnivalidator extension.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true, unparam: true */
/*global describe, expect, it, require */

require(
    [
        "omnivalidator/multitrie"
    ],
    function (MultiTrie) {
        "use strict";

        describe("A MultiTrie", function () {
            it("inserts and retrieves data by key", function () {
                var trie;

                trie = new MultiTrie();
                trie.add("foo", 1);

                expect(trie.get("foo")).toBe(1);
            });

            it("inserts and retrieves data with empty key", function () {
                var trie;

                trie = new MultiTrie();
                trie.add("", 1);

                expect(trie.get("")).toBe(1);
            });

            it("inserts and retrieves multiple items", function () {
                var trie;

                trie = new MultiTrie();
                trie.add("foo", 1);
                // Insert before
                trie.add("bar", 2);
                // Insert after
                trie.add("quux", 3);
                // Insert between
                trie.add("corge", 4);

                expect(trie.get("foo")).toBe(1);
                expect(trie.get("bar")).toBe(2);
                expect(trie.get("quux")).toBe(3);
                expect(trie.get("corge")).toBe(4);
            });

            it("inserts and retrieves multiple items with the same key", function () {
                var trie;

                trie = new MultiTrie();
                trie.add("foo", 1);
                trie.add("foo", 2);

                expect(trie.get("foo")).toBe(2);
                expect(trie.getAll("foo")).toEqual([1, 2]);
            });

            it("inserts and retrieves with a common prefix", function () {
                var trie;

                trie = new MultiTrie();
                trie.add("bor", 1);
                // Split after
                trie.add("boz", 2);
                // Split before
                trie.add("bar", 3);
                // Share existing prefix
                trie.add("bo", 4);

                expect(trie.get("bor")).toBe(1);
                expect(trie.get("boz")).toBe(2);
                expect(trie.get("bar")).toBe(3);
                expect(trie.get("bo")).toBe(4);
            });

            it("can retrieve by matching prefix", function () {
                var trie;

                trie = new MultiTrie();
                trie.add("bar", 2);
                trie.add("baz", 3);
                trie.add("ba", 4);

                expect(trie.getPrefixes("bar")).toEqual({
                    "ba": [ 4 ],
                    "bar": [ 2 ]
                });
                expect(trie.getPrefixes("baz")).toEqual({
                    "ba": [ 4 ],
                    "baz": [ 3 ]
                });
            });

            it("can retrieve by matching prefix (2)", function () {
                var trie;

                function foo() {
                }

                trie = new MultiTrie();
                trie.add("prefs.extensions.omnivalidator.test.", foo);

                expect(trie.getPrefixes("prefs.extensions.omnivalidator.test.abranch.boolPref")).toEqual({
                    "prefs.extensions.omnivalidator.test.": [ foo ]
                });
            });

            it("can remove items", function () {
                var trie;

                trie = new MultiTrie();
                trie.add("bor", 1);
                trie.add("boz", 2);
                trie.add("bar", 3);
                trie.add("bo", 4);
                trie.add("foo", 5);
                trie.add("food", 6);

                // Removal of leaf node
                trie.remove("food");
                expect(trie.get("foo")).toBe(5);
                expect(trie.get("food")).toBe(undefined);

                // Remove interior causing merge of "bo" and "b" nodes
                trie.remove("bar");
                expect(trie.get("bor")).toBe(1);
                expect(trie.get("boz")).toBe(2);
                expect(trie.get("bar")).toBe(undefined);
                expect(trie.get("bo")).toBe(4);

                // Should cause no structural changes
                trie.remove("bo");
                expect(trie.get("bor")).toBe(1);
                expect(trie.get("boz")).toBe(2);
                expect(trie.get("bo")).toBe(undefined);

                // Remove leaf causing merge of "bo" and "bor"
                trie.remove("boz");
                expect(trie.get("bor")).toBe(1);
                expect(trie.get("boz")).toBe(undefined);
            });

            it("can remove all items", function () {
                var trie;

                trie = new MultiTrie();
                trie.add("foo", 1);

                trie.remove("foo");
                expect(trie.get("foo")).toBe(undefined);

                trie.add("bar", 1);
                expect(trie.get("bar")).toBe(1);
            });

            it("can remove specified data", function () {
                var trie;

                trie = new MultiTrie();

                trie.add("foo", 1);
                trie.add("foo", 2);
                trie.add("foo", 3);

                expect(trie.getAll("foo")).toEqual([1, 2, 3]);

                trie.remove("foo", 2);

                expect(trie.getAll("foo")).toEqual([1, 3]);
            });

            it("can remove data based on an equality comparator", function () {
                var trie;

                trie = new MultiTrie(function (d1, d2) {
                    return d1.toLowerCase() === d2.toLowerCase();
                });

                trie.add("foo", "data1");
                trie.add("foo", "data2");

                expect(trie.getAll("foo")).toEqual(["data1", "data2"]);

                trie.remove("foo", "DATA1");

                expect(trie.getAll("foo")).toEqual(["data2"]);
            });

            it("correctly reports emptyness", function () {
                var trie;

                trie = new MultiTrie();

                expect(trie.isEmpty()).toBe(true);

                trie.add("foo", 1);

                expect(trie.isEmpty()).toBe(false);

                trie.remove("foo", 1);

                expect(trie.isEmpty()).toBe(true);
            })
        });
    }
);

// vi: set sts=4 sw=4 et :
