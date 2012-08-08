/* Spec for omnivalidator/prefutils
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
        "omnivalidator/platform/preferences",
        "omnivalidator/prefutils"
    ],
    function (Preferences, prefutils) {
        "use strict";

        var TEST_PREFIX = "extensions.omnivalidator.test.";

        describe("prefutils", function () {
            beforeEach(function () {
                new Preferences(TEST_PREFIX).deleteBranch();
            });
            afterEach(function () {
                new Preferences(TEST_PREFIX).deleteBranch();
            });

            it("can list child branch names", function () {
                var branch1, branch2, branch3, branch4, names;

                branch1 = new Preferences(TEST_PREFIX + "abranch.");

                branch1.setValue("pref1.subpref", false);
                branch1.setValue("pref2", 5);
                branch1.setValue("pref3..subsubpref", "stuff");

                branch2 = new Preferences(TEST_PREFIX);

                expect(
                    prefutils.getChildNames(branch2, "testmissing")
                ).toEqual([]);

                expect(prefutils.getChildNames(branch2, "abranch")).toEqual([
                    "abranch"
                ]);

                names = prefutils.getChildNames(branch2, "abranch.");
                names.sort();
                expect(names).toEqual([
                    "abranch.pref1",
                    "abranch.pref2",
                    "abranch.pref3"
                ]);

                expect(
                    prefutils.getChildNames(branch2, "abranch.pref1.")
                ).toEqual([
                    "abranch.pref1.subpref"
                ]);

                branch3 = new Preferences(TEST_PREFIX + "abranch.");
                names = prefutils.getChildNames(branch3);
                names.sort();
                expect(names).toEqual([
                    "pref1",
                    "pref2",
                    "pref3"
                ]);

                branch4 = new Preferences(TEST_PREFIX + "abranch");
                names = prefutils.getChildNames(branch4);
                names.sort();
                expect(names).toEqual([
                    ""
                ]);
            });

            it("can get array values", function () {
                var branch1, branch2;

                branch1 = new Preferences(TEST_PREFIX + "abranch");

                branch1.setValue(".0", false);
                branch1.setValue(".1", 5);
                branch1.setValue(".2", "stuff");

                expect(prefutils.getArray(branch1)).toEqual([
                    false,
                    5,
                    "stuff"
                ]);

                branch2 = new Preferences(TEST_PREFIX);
                expect(prefutils.getArray(branch2, "abranch")).toEqual([
                    false,
                    5,
                    "stuff"
                ]);

                expect(
                    prefutils.getArray(branch2, "testmissing")
                ).toBe(undefined);
            });

            it("can get non-contiguous array values", function () {
                var branch1, branch2;

                branch1 = new Preferences(TEST_PREFIX + "abranch");

                branch1.setValue(".0", false);
                branch1.setValue(".1", 5);
                branch1.setValue(".3", "stuff");

                expect(prefutils.getArray(branch1)).toEqual([
                    false,
                    5,
                    undefined,
                    "stuff"
                ]);

                branch2 = new Preferences(TEST_PREFIX);
                expect(prefutils.getArray(branch2, "abranch")).toEqual([
                    false,
                    5,
                    undefined,
                    "stuff"
                ]);
            });

            it("can get object values", function () {
                var branch1, branch2;

                branch1 = new Preferences(TEST_PREFIX + "abranch");

                branch1.setValue(".foo", false);
                branch1.setValue(".bar", 5);
                branch1.setValue(".baz", "stuff");

                expect(prefutils.getObject(branch1)).toEqual({
                    foo: false,
                    bar: 5,
                    baz: "stuff"
                });

                branch2 = new Preferences(TEST_PREFIX);

                expect(prefutils.getObject(branch2, "abranch")).toEqual({
                    foo: false,
                    bar: 5,
                    baz: "stuff"
                });

                expect(
                    prefutils.getObject(branch2, "testmissing")
                ).toBe(undefined);
            });

            it("can get mixed values", function () {
                var branch1, obj;

                branch1 = new Preferences(TEST_PREFIX + "abranch");

                branch1.setValue(".foo", false);
                branch1.setValue(".bar", 5);
                branch1.setValue(".baz", "stuff");
                branch1.setValue(".1", 1);

                obj = prefutils.getObject(branch1);
                expect(obj).toEqual({
                    1: 1,
                    foo: false,
                    bar: 5,
                    baz: "stuff"
                });
                expect(obj instanceof Array).toBe(true);
            });

            it("can get arrays in objects", function () {
                var branch1;

                branch1 = new Preferences(TEST_PREFIX + "abranch");

                branch1.setValue(".foo", false);
                branch1.setValue(".bar", 5);
                branch1.setValue(".baz", "stuff");
                branch1.setValue(".qux.0", 200);
                branch1.setValue(".qux.1", 400);
                branch1.setValue(".qux.2", 600);

                expect(prefutils.getObject(branch1)).toEqual({
                    foo: false,
                    bar: 5,
                    baz: "stuff",
                    qux: [200, 400, 600]
                });
            });

            it("can get objects in arrays", function () {
                var branch1;

                branch1 = new Preferences(TEST_PREFIX + "abranch");

                branch1.setValue(".0.foo", false);
                branch1.setValue(".0.bar", 5);
                branch1.setValue(".1", "stuff");
                branch1.setValue(".2.baz", "more stuff");

                expect(prefutils.getObject(branch1)).toEqual([
                    {
                        foo: false,
                        bar: 5
                    },
                    "stuff",
                    {
                        baz: "more stuff"
                    }
                ]);
            });

            it("can get object or value", function () {
                var branch1;

                branch1 = new Preferences(TEST_PREFIX + "abranch");

                branch1.setValue(".foo", false);
                branch1.setValue(".bar.0", 5);
                branch1.setValue(".baz", "ill-advised");
                branch1.setValue(".baz.0", "stuff");

                expect(prefutils.get(branch1, ".foo")).toBe(false);
                expect(prefutils.get(branch1, ".bar")).toEqual([ 5 ]);
                expect(prefutils.get(branch1, ".baz")).toEqual([ "stuff" ]);
            });

            it("can set array values", function () {
                var branch1;

                branch1 = new Preferences(TEST_PREFIX + "abranch");

                prefutils.set(branch1, [false, 5, "stuff"]);

                expect(branch1.getValue(".0")).toBe(false);
                expect(branch1.getValue(".1")).toBe(5);
                expect(branch1.getValue(".2")).toBe("stuff");

                prefutils.set(branch1, "abranch", [false, 5, "stuff"]);

                expect(branch1.getValue("abranch.0")).toBe(false);
                expect(branch1.getValue("abranch.1")).toBe(5);
                expect(branch1.getValue("abranch.2")).toBe("stuff");
            });

            it("can set non-contiguous array values", function () {
                var branch1;

                branch1 = new Preferences(TEST_PREFIX + "abranch");

                prefutils.set(branch1, [false, 5, undefined, "stuff"]);

                expect(branch1.getValue(".0")).toBe(false);
                expect(branch1.getValue(".1")).toBe(5);
                expect(branch1.getValue(".3")).toBe("stuff");
            });

            it("can set object values", function () {
                var branch1;

                branch1 = new Preferences(TEST_PREFIX + "abranch");

                prefutils.set(branch1, {
                    foo: false,
                    bar: 5,
                    baz: "stuff"
                });

                expect(branch1.getValue(".foo")).toBe(false);
                expect(branch1.getValue(".bar")).toBe(5);
                expect(branch1.getValue(".baz")).toBe("stuff");
            });

            it("can set mixed values", function () {
                var branch1, obj;

                branch1 = new Preferences(TEST_PREFIX + "abranch");

                obj = [ undefined, 1 ];
                obj.foo = false;
                obj.bar = 5;
                obj.baz = "stuff";
                prefutils.set(branch1, obj);

                expect(branch1.getValue(".foo")).toBe(false);
                expect(branch1.getValue(".bar")).toBe(5);
                expect(branch1.getValue(".baz")).toBe("stuff");
                expect(branch1.getValue(".1")).toBe(1);
            });

            it("can set arrays in objects", function () {
                var branch1;

                branch1 = new Preferences(TEST_PREFIX + "abranch");

                prefutils.set(branch1, {
                    foo: false,
                    bar: 5,
                    baz: "stuff",
                    qux: [ 200, 400, 600 ]
                });

                expect(branch1.getValue(".foo")).toBe(false);
                expect(branch1.getValue(".bar")).toBe(5);
                expect(branch1.getValue(".baz")).toBe("stuff");
                expect(branch1.getValue(".qux.0")).toBe(200);
                expect(branch1.getValue(".qux.1")).toBe(400);
                expect(branch1.getValue(".qux.2")).toBe(600);
            });

            it("can set objects in arrays", function () {
                var branch1;

                branch1 = new Preferences(TEST_PREFIX + "abranch");

                prefutils.set(branch1, [
                    {
                        foo: false,
                        bar: 5
                    },
                    "stuff",
                    {
                        baz: "more stuff"
                    }
                ]);

                expect(branch1.getValue(".0.foo")).toBe(false);
                expect(branch1.getValue(".0.bar")).toBe(5);
                expect(branch1.getValue(".1")).toBe("stuff");
                expect(branch1.getValue(".2.baz")).toBe("more stuff");
            });

            it("set removes children", function () {
                var branch1;

                branch1 = new Preferences(TEST_PREFIX + "abranch");

                prefutils.set(branch1, {
                    foo: false,
                    bar: [ 5, 10 ],
                    baz: "stuff"
                });
                prefutils.set(branch1, {
                    qux: "other stuff"
                });

                expect(branch1.getValue(".foo")).toBe(undefined);
                expect(branch1.getValue(".bar.0")).toBe(undefined);
                expect(branch1.getValue(".bar.1")).toBe(undefined);
                expect(branch1.getValue(".baz")).toBe(undefined);
                expect(branch1.getValue(".qux")).toBe("other stuff");

                expect(branch1.getDescendantNames()).toEqual([ ".qux" ]);
            });

            it("can overwrite children without removal", function () {
                var branch1, names;

                branch1 = new Preferences(TEST_PREFIX + "abranch");

                prefutils.set(branch1, {
                    foo: false,
                    bar: [ 5, 10 ],
                    baz: "stuff"
                });
                prefutils.overwrite(branch1, {
                    foo: true,
                    qux: "other stuff"
                });

                expect(branch1.getValue(".foo")).toBe(true);
                expect(branch1.getValue(".bar.0")).toBe(5);
                expect(branch1.getValue(".bar.1")).toBe(10);
                expect(branch1.getValue(".baz")).toBe("stuff");
                expect(branch1.getValue(".qux")).toBe("other stuff");

                names = branch1.getDescendantNames();
                names.sort();
                expect(names).toEqual([
                    ".bar.0",
                    ".bar.1",
                    ".baz",
                    ".foo",
                    ".qux"
                ]);
            });

            it("reports cyclic values", function () {
                var branch1, obj;

                branch1 = new Preferences(TEST_PREFIX + "abranch");

                obj = { prop: {} };
                obj.prop.prop = obj;
                expect(function () {
                    prefutils.set(branch1, obj);
                }).toThrow();
                expect(function () {
                    prefutils.overwrite(branch1, obj);
                }).toThrow();
            });
        });
    }
);

// vi: set sts=4 sw=4 et :
