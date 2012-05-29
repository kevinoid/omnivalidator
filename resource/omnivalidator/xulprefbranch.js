/* An implementation of nsIPrefBranch which stores changes in XUL.
 *
 * The utility of this class is in dealing with !instantApply prefwindows
 * where all changes must be stored as XUL preference elements on the root
 * window until the dialog is accepted.
 *
 * This file is part of the Omnivalidator extension for Firefox.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true, unparam: true */
/*global define */

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

        var complexTypes = {
                file: Ci.nsILocalFile,
                unichar: Ci.nsISupportsString,
                wstring: Ci.nsIPrefLocalizedString
            },
            simpleNameToType = {
                "": Ci.nsIPrefBranch.PREF_INVALID,
                "bool": Ci.nsIPrefBranch.PREF_BOOL,
                "int": Ci.nsIPrefBranch.PREF_INT,
                "string": Ci.nsIPrefBranch.PREF_STRING
            },
            simpleTypeToName = {};

        underscore.each(simpleNameToType, function (type, name) {
            simpleTypeToName[type] = name;
        });

        function startsWith(str, prefix) {
            return str.lastIndexOf(prefix, 0) === 0;
        }

        function XULPrefBranch(xulprefs, root, nextBranch) {
            var prefdoc = xulprefs.ownerDocument,
                prefwindow = prefdoc.documentElement;

            root = String(root || "");
            if (Object.defineProperty) {
                Object.defineProperty(this, "root", {value: root});
            } else {
                this.root = root;
            }

            if (!nextBranch) {
                nextBranch = Cc["@mozilla.org/preferences-service;1"]
                    .getService(Ci.nsIPrefService)
                    .getBranch(root);
            }

            function createPrefElem(prefName, prefType) {
                var prefElem;

                prefElem = prefdoc.createElementNS(
                    globaldefs.XUL_NS,
                    "preference"
                );
                xulprefs.appendChild(prefElem);
                // Note:  Set name after XBL constructor runs to avoid
                // unnecessary work checking for parent values
                prefElem.name = root + prefName;
                if (prefType) {
                    prefElem.type = prefType;
                }

                return prefElem;
            }

            // This function is performance-sensitive
            function getAllPrefElems(prefix) {
                var i, ilength, matchingElems, prefElem, prefElems;

                prefix = root + prefix;

                prefElems =
                    prefwindow.getElementsByTagNameNS(
                        globaldefs.XUL_NS,
                        "preference"
                    );

                if (prefix) {
                    matchingElems = [];
                    ilength = prefElems.length;
                    for (i = 0; i < ilength; ++i) {
                        prefElem = prefElems[i];
                        if (startsWith(prefElem.name, prefix)) {
                            matchingElems.push(prefElem);
                        }
                    }
                } else {
                    matchingElems = prefElems;
                }

                return matchingElems;
            }

            // This function is performance-critical
            function getPrefElem(prefName) {
                var elems, i, ilength, j, jlength, pref, prefs;

                prefName = root + prefName;

                elems = prefwindow.getElementsByTagName("preferences");
                ilength = elems.length;
                for (i = 0; i < ilength; ++i) {
                    prefs = elems[i].getElementsByAttribute("name", prefName);

                    jlength = prefs.length;
                    for (j = 0; j < jlength; ++j) {
                        pref = prefs[j];
                        if (pref.localName === "preference" &&
                                pref.namespaceURI === globaldefs.XUL_NS) {
                            return pref;
                        }
                    }
                }

                return null;
            }

            function getTypeNameNext(prefName) {
                return simpleTypeToName[nextBranch.getPrefType(prefName)];
            }

            function makeGetPref(getter, type) {
                return function (prefName) {
                    var prefElem = getPrefElem(prefName);

                    if (prefElem) {
                        if (prefElem.type === type) {
                            return prefElem.value;
                        } else {
                            throw new Error(prefName + " does not have a " +
                                    type + " value");
                        }
                    }

                    return nextBranch[getter](prefName);
                };
            }

            function makeSetPref(type) {
                return function (prefName, value) {
                    var prefElem = getPrefElem(prefName);

                    if (!prefElem) {
                        prefElem = createPrefElem(prefName, type);
                    }

                    prefElem.value = value;
                };
            }

            this.clearUserPref = function (prefName) {
                var prefElem;

                prefElem = getPrefElem(prefName);

                if (nextBranch.prefHasUserValue(prefName)) {
                    // Must have preference element with value undefined

                    if (!prefElem) {
                        // Note:  Because valueFromPreference setter calls
                        // valueFromPreference getter to check for changes,
                        // (and returns null as default, compared with ==)
                        // we need to set the type correctly.
                        prefElem = createPrefElem(
                            prefName,
                            getTypeNameNext(prefName)
                        );
                    }

                    prefElem.value = undefined;
                } else {
                    // Allow to revert back to value of next branch

                    if (prefElem) {
                        prefElem.parentNode.removeChild(prefElem);
                    }
                }
            };

            this.deleteBranch = function (branchName) {
                var childPref,
                    childPrefs,
                    i,
                    prefElem,
                    prefElems;

                // Delete any local additions to the branch
                prefElems = getAllPrefElems(branchName);
                for (i = prefElems.length - 1; i >= 0; --i) {
                    prefElem = prefElems[i];
                    prefElem.parentNode.removeChild(prefElem);
                }

                // Add removal element for each pref in the branch
                childPrefs = nextBranch.getChildList(branchName, {});
                for (i = 0; i < childPrefs.length; ++i) {
                    childPref = childPrefs[i];
                    // Note:  Because valueFromPreference setter calls
                    // valueFromPreference getter to check for changes,
                    // (and returns null as default, compared with ==)
                    // we need to set the type correctly.
                    prefElem = createPrefElem(
                        childPref,
                        getTypeNameNext(childPref)
                    );
                    prefElem.value = undefined;
                }
            };

            this.getBoolPref = makeGetPref("getBoolPref", "bool");
            this.getCharPref = makeGetPref("getCharPref", "string");

            this.getChildList = function (branchName, out) {
                var childList,
                    i,
                    ilength,
                    nextList,
                    prefElem,
                    prefElems,
                    prefName,
                    removedList;

                prefElems = getAllPrefElems(branchName);
                childList = [];
                removedList = [];
                ilength = prefElems.length;
                for (i = 0; i < ilength; ++i) {
                    prefElem = prefElems[i];
                    prefName = prefElem.name;

                    if (!root || startsWith(prefName, root)) {
                        prefName = prefName.slice(root.length);
                        if (prefElem.value === undefined) {
                            removedList.push(prefName);
                        } else {
                            childList.push(prefName);
                        }
                    }
                }

                nextList = nextBranch.getChildList(branchName, {});
                if (removedList.length > 0) {
                    removedList.sort();
                    nextList = nextList.filter(function (e) {
                        var ind = underscore.sortedIndex(removedList, e);
                        // Placate SpiderMonkey strict option
                        // (ref to undef prop)
                        return ind >= removedList.length ||
                            removedList[ind] !== e;
                    });
                }

                Array.prototype.push.apply(childList, nextList);

                childList = underscore.uniq(childList);

                if (typeof out === "object") {
                    out.value = childList.length;
                }

                return childList;
            };

            this.getComplexValue = function (prefName, type) {
                var prefElem = getPrefElem(prefName);

                if (prefElem) {
                    // Placate SpiderMonkey strict option (ref to undef prop)
                    if (complexTypes.hasOwnProperty(prefElem.type) &&
                            type === complexTypes[prefElem.type]) {
                        return prefElem.value;
                    } else {
                        throw new Error(prefName +
                                " does not have the requested complex type");
                    }
                }

                return nextBranch.getComplexValue(prefName, type);
            };

            this.getIntPref = makeGetPref("getIntPref", "int");

            this.getPrefType = function (prefName) {
                var prefElem = getPrefElem(prefName);

                if (prefElem) {
                    // Placate SpiderMonkey strict option (ref to undef prop)
                    if (simpleNameToType.hasOwnProperty(prefElem.type)) {
                        return simpleNameToType[prefElem.type];
                    } else {
                        return 0;
                    }
                }

                return nextBranch.getPrefType(prefName);
            };

            this.lockPref = function (prefName) {
                return nextBranch.lockPref(prefName);
            };

            this.prefHasUserValue = function (prefName) {
                var prefElem = getPrefElem(prefName);

                if (prefElem) {
                    return prefElem.value !== undefined;
                }

                return nextBranch.prefHasUserValue(prefName);
            };

            this.prefIsLocked = function (prefName) {
                return nextBranch.prefIsLocked(prefName);
            };

            this.resetBranch = function (branchName) {
                throw new Error("Not Implemented");
            };

            this.setBoolPref = makeSetPref("bool");
            this.setCharPref = makeSetPref("string");

            this.setComplexValue = function (prefName, type, value) {
                var typeName, prefElem = getPrefElem(prefName);

                for (typeName in complexTypes) {
                    if (complexTypes.hasOwnProperty(typeName)) {
                        if (complexTypes[typeName] === type) {
                            break;
                        }
                    }
                }
                if (complexTypes[typeName] !== type) {
                    throw new Error("Unable to find type name for type");
                }

                if (!prefElem) {
                    prefElem = createPrefElem(prefName, typeName);
                }

                prefElem.value = value;
            };

            this.setIntPref = makeSetPref("int");

            this.unlockPref = function (prefName) {
                nextBranch.unlockPref(prefName);
            };
        }

        XULPrefBranch.prototype.QueryInterface = function (aIID) {
            if (aIID.equals(Ci.nsIPrefBranch) ||
                    aIID.equals(Ci.nsISupports)) {
                return this;
            }
            throw Cr.NS_NOINTERFACE;
        };

        return XULPrefBranch;
    }
);

// vi: set sts=4 sw=4 et :
