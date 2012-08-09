/* Spec for omnivalidator/platform/preferences
 *
 * This file is part of the Omnivalidator extension.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true, unparam: true */
/*global afterEach, beforeEach, describe, expect, it, require, xdescribe, xit */

require(
    [
        "omnivalidator/platform/preferences"
    ],
    function (Preferences) {
        "use strict";

        var TEST_PREFIX = "extensions.omnivalidator.test.";

        describe("Preferences", function () {
            beforeEach(function () {
                new Preferences(TEST_PREFIX).deleteBranch();
            });
            afterEach(function () {
                new Preferences(TEST_PREFIX).deleteBranch();
            });

            it("can set and get preferences by name", function () {
                var branch;

                branch = new Preferences(TEST_PREFIX);

                // Preserves type for (at least) bool, int, string
                branch.setValue("boolPref", false);
                branch.setValue("intPref", 1);
                branch.setValue("stringPref", "stuff");
                branch.setValue("other stuff");

                expect(branch.getValue("boolPref")).toBe(false);
                expect(branch.getValue("intPref")).toBe(1);
                expect(branch.getValue("stringPref")).toBe("stuff");
                expect(branch.getValue()).toBe("other stuff");
            });

            it("can set and get preferences across branches", function () {
                var branch1, branch2, branch3;

                branch1 = new Preferences(TEST_PREFIX);
                branch1.setValue("abranch.boolPref", false);
                branch1.setValue("abranch.intPref", 1);
                branch1.setValue("abranch.stringPref", "stuff");

                branch2 = new Preferences(TEST_PREFIX + "abranch.");
                expect(branch2.getValue("boolPref")).toBe(false);
                expect(branch2.getValue("intPref")).toBe(1);
                expect(branch2.getValue("stringPref")).toBe("stuff");

                branch3 = branch1.getBranch("abranch.");
                expect(branch3.getValue("boolPref")).toBe(false);
                expect(branch3.getValue("intPref")).toBe(1);
                expect(branch3.getValue("stringPref")).toBe("stuff");
            });

            it("can be used without instantiation", function () {
                var branch1, branch2;

                branch1 = new Preferences(TEST_PREFIX);
                branch1.setValue("abranch.boolPref", false);
                branch1.setValue("abranch.intPref", 1);
                branch1.setValue("abranch.stringPref", "stuff");

                branch2 = Preferences;
                expect(
                    branch2.getValue(TEST_PREFIX + "abranch.boolPref")
                ).toBe(false);
                expect(
                    branch2.getValue(TEST_PREFIX + "abranch.intPref")
                ).toBe(1);
                expect(
                    branch2.getValue(TEST_PREFIX + "abranch.stringPref")
                ).toBe("stuff");
            });

            it("has a single default branch", function () {
                var branch1;

                branch1 = new Preferences(TEST_PREFIX);
                expect(branch1.getDefaultBranch()).not.toBe(null);

                expect(
                    branch1.getDefaultBranch().getDefaultBranch()
                ).toBe(null);
            });

            it("gets default values from the default branch", function () {
                var branch1, branch2, defbranch1, defbranch2;

                branch1 = new Preferences(TEST_PREFIX);
                defbranch1 = branch1.getDefaultBranch();

                defbranch1.setValue("abranch.intPref", 1);
                branch1.setValue("abranch.stringPref", "stuff");

                expect(branch1.getValue("abranch.intPref")).toBe(1);
                expect(defbranch1.getValue("abranch.intPref")).toBe(1);
                expect(branch1.getValue("abranch.stringPref")).toBe("stuff");
                expect(
                    defbranch1.getValue("abranch.stringPref")
                ).toBe(undefined);

                branch2 = branch1.getBranch("abranch.");
                defbranch2 = defbranch1.getBranch("abranch.");

                expect(branch2.getValue("intPref")).toBe(1);
                expect(defbranch2.getValue("intPref")).toBe(1);
                expect(branch2.getValue("stringPref")).toBe("stuff");
                expect(defbranch2.getValue("stringPref")).toBe(undefined);

                defbranch1.resetValue("abranch.intPref");

                expect(branch1.getValue("abranch.intPref")).toBe(undefined);
                expect(defbranch1.getValue("abranch.intPref")).toBe(undefined);
            });

            it("correctly queries if the branch has a value", function () {
                var branch1, branch2, defbranch1, defbranch2;

                branch1 = new Preferences(TEST_PREFIX);
                defbranch1 = branch1.getDefaultBranch();
                branch2 = branch1.getBranch("abranch.");
                defbranch2 = branch2.getDefaultBranch();

                branch1.setValue("abranch.intPref", 1);
                defbranch1.setValue("abranch.stringPref", "stuff");

                expect(branch1.hasValue("abranch.intPref")).toBe(true);
                expect(branch1.hasValue("abranch.stringPref")).toBe(false);
                expect(defbranch1.hasValue("abranch.intPref")).toBe(false);
                expect(defbranch1.hasValue("abranch.stringPref")).toBe(true);
                expect(branch2.hasValue("intPref")).toBe(true);
                expect(branch2.hasValue("stringPref")).toBe(false);
                expect(defbranch2.hasValue("intPref")).toBe(false);
                expect(defbranch2.hasValue("stringPref")).toBe(true);
            });

            it("can get descendant names", function () {
                var branch1, branch2, branch3, defbranch1, names;

                branch1 = new Preferences(TEST_PREFIX);
                branch1.setValue("abranch.", true);
                branch1.setValue("abranch.boolPref", false);
                branch1.setValue("abranch.intPref", 1);
                branch1.setValue("abranch.stringPref", "stuff");

                branch2 = new Preferences(TEST_PREFIX);
                names = branch2.getDescendantNames("abranch.");
                names.sort();
                expect(names).toEqual([
                    "abranch.boolPref",
                    "abranch.intPref",
                    "abranch.stringPref"
                ]);

                branch3 = new Preferences(TEST_PREFIX + "abranch.");
                names = branch3.getDescendantNames();
                names.sort();
                expect(names).toEqual([
                    "boolPref",
                    "intPref",
                    "stringPref"
                ]);

                defbranch1 = branch1.getDefaultBranch();
                defbranch1.setValue("abranch.defPref", 1);

                names = branch2.getDescendantNames("abranch.");
                names.sort();
                expect(names).toEqual([
                    "abranch.boolPref",
                    "abranch.defPref",
                    "abranch.intPref",
                    "abranch.stringPref"
                ]);

                names = branch3.getDescendantNames();
                names.sort();
                expect(names).toEqual([
                    "boolPref",
                    "defPref",
                    "intPref",
                    "stringPref"
                ]);
            });

            it("can reset values", function () {
                var branch1, branch2;

                branch1 = new Preferences(TEST_PREFIX);
                branch1.setValue("abranch.boolPref", false);
                branch1.setValue("abranch.intPref", 1);
                branch1.setValue("abranch.stringPref", "stuff");

                branch2 = new Preferences(TEST_PREFIX);
                branch2.resetValue("abranch.boolPref");
                branch2.resetValue("abranch.intPref");
                branch2.resetValue("abranch.stringPref");

                expect(branch1.getValue("abranch.boolPref")).toBe(undefined);
                expect(branch1.getValue("abranch.intPref")).toBe(undefined);
                expect(branch1.getValue("abranch.stringPref")).toBe(undefined);
            });

            it("reset only affects branch on which it is called", function () {
                var branch1, defbranch1;

                branch1 = new Preferences(TEST_PREFIX);
                defbranch1 = branch1.getDefaultBranch();

                defbranch1.setValue("abranch.intPref", 1);
                defbranch1.setValue("abranch.stringPref", "stuff");

                expect(branch1.getValue("abranch.intPref")).toBe(1);
                expect(branch1.getValue("abranch.stringPref")).toBe("stuff");

                branch1.resetValue("abranch.intPref");
                branch1.resetValue("abranch.stringPref");

                expect(branch1.getValue("abranch.intPref")).toBe(1);
                expect(branch1.getValue("abranch.stringPref")).toBe("stuff");

                defbranch1.resetValue("abranch.intPref");

                expect(branch1.getValue("abranch.intPref")).toBe(undefined);
                expect(branch1.getValue("abranch.stringPref")).toBe("stuff");
            });

            it("can delete branches", function () {
                var branch1, branch2;

                branch1 = new Preferences(TEST_PREFIX);
                branch1.setValue("abranch.", 10);
                branch1.setValue("abranch.boolPref", false);
                branch1.setValue("abranch.intPref", 1);
                branch1.setValue("abranch.stringPref", "stuff");
                branch1.setValue("bbranch.stringPref", "junk");

                branch2 = new Preferences(TEST_PREFIX);
                branch2.deleteBranch("abranch.");

                expect(branch1.getDescendantNames("abranch.")).toEqual([]);
                expect(branch1.getValue("abranch.")).toBe(undefined);
                expect(branch1.getValue("abranch.boolPref")).toBe(undefined);
                expect(branch1.getValue("abranch.intPref")).toBe(undefined);
                expect(branch1.getValue("abranch.stringPref")).toBe(undefined);
                expect(branch1.getValue("bbranch.stringPref")).toBe("junk");
            });

            it("deletes default branch with primary branch", function () {
                var branch1, branch2, defbranch1;

                branch1 = new Preferences(TEST_PREFIX);
                branch1.setValue("abranch.boolPref", false);
                branch1.setValue("abranch.intPref", 1);

                defbranch1 = branch1.getDefaultBranch();
                defbranch1.setValue("abranch.stringPref", "stuff");

                branch2 = new Preferences(TEST_PREFIX);
                branch2.deleteBranch("abranch.");

                expect(branch1.getDescendantNames("abranch.")).toEqual([]);
                expect(branch1.getValue("abranch.boolPref")).toBe(undefined);
                expect(branch1.getValue("abranch.intPref")).toBe(undefined);
                expect(branch1.getValue("abranch.stringPref")).toBe(undefined);
                expect(
                    defbranch1.getValue("abranch.stringPref")
                ).toBe(undefined);
            });

            it("can reset branches", function () {
                var branch1, branch2;

                branch1 = new Preferences(TEST_PREFIX);
                branch1.setValue("abranch.", 10);
                branch1.setValue("abranch.boolPref", false);
                branch1.setValue("abranch.intPref", 1);
                branch1.setValue("abranch.stringPref", "stuff");
                branch1.setValue("bbranch.stringPref", "junk");

                branch2 = new Preferences(TEST_PREFIX);

                branch2.resetBranch("abranch.");

                expect(branch1.getDescendantNames("abranch.")).toEqual([]);
                expect(branch1.getValue("abranch.")).toBe(undefined);
                expect(branch1.getValue("abranch.boolPref")).toBe(undefined);
                expect(branch1.getValue("abranch.intPref")).toBe(undefined);
                expect(branch1.getValue("abranch.stringPref")).toBe(undefined);
                expect(branch1.getValue("bbranch.stringPref")).toBe("junk");
            });

            it("can reset default branches", function () {
                var branch1, branch2;

                branch1 = new Preferences(TEST_PREFIX).getDefaultBranch();
                branch1.setValue("abranch.boolPref", false);
                branch1.setValue("abranch.intPref", 1);
                branch1.setValue("abranch.stringPref", "stuff");
                branch1.setValue("bbranch.stringPref", "junk");

                branch2 = new Preferences(TEST_PREFIX).getDefaultBranch();

                branch2.resetBranch("abranch.");

                expect(branch1.getDescendantNames("abranch.")).toEqual([]);
                expect(branch1.getValue("abranch.boolPref")).toBe(undefined);
                expect(branch1.getValue("abranch.intPref")).toBe(undefined);
                expect(branch1.getValue("abranch.stringPref")).toBe(undefined);
                expect(branch1.getValue("bbranch.stringPref")).toBe("junk");
            });

            // Delete of value with default should cause one event
            // Values (and descendant lists) should be updated when event fires
        });

        // Remove any test values
        new Preferences(TEST_PREFIX).deleteBranch();
    }
);

// vi: set sts=4 sw=4 et :
