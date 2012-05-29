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
/*jslint continue: true, indent: 4, plusplus: true, unparam: true */
/*global define */

define(
    [
        "gecko/components/classes",
        "gecko/components/interfaces",
        "gecko/components/results",
        "log4moz",
        "omnivalidator/globaldefs",
        "underscore"
    ],
    function (Cc, Ci, Cr, log4moz, globaldefs, underscore) {
        "use strict";

        var complexTypes = {
                file: Ci.nsILocalFile,
                unichar: Ci.nsISupportsString,
                wstring: Ci.nsIPrefLocalizedString
            },
            logger = log4moz.repository.getLogger("omnivalidator.xulprefbranch"),
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
            var nextBranch2,
                observerInfos = [],
                prefdoc = xulprefs.ownerDocument,
                prefObserver,
                prefwindow = prefdoc.documentElement,
                thisPrefBranch = this,
                unusedPrefName = globaldefs.EXT_PREF_PREFIX + "unused",
                weakObserverInfos = [];

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
            } else if (nextBranch.root !== root) {
                throw new Error("nextBranch must share root with this branch");
            }
            nextBranch2 = nextBranch.QueryInterface(Ci.nsIPrefBranch2);

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

            function createPrefElem(prefName, prefType) {
                var prefElem;

                // Try to reuse an unused preference element, if any
                prefElem = getPrefElem(unusedPrefName);
                if (!prefElem) {
                    prefElem = prefdoc.createElementNS(
                        globaldefs.XUL_NS,
                        "preference"
                    );
                    xulprefs.appendChild(prefElem);
                }

                prefElem.name = root + prefName;
                if (prefType) {
                    prefElem.type = prefType;
                }

                return prefElem;
            }

            /* Note:  We can't removeChild(prefElem) because this will cause
             * its XBL destructor to throw.  Instead we change the name to
             * a sentinel value and reuse it as needed.  Note:  Sentinel
             * should not be a prefix of preferences in use, since a
             * preferences observer is added by the preference
             */
            function removePrefElem(prefElem) {
                var prefName, prefType;

                if (typeof prefElem === "string") {
                    prefElem = getPrefElem(prefElem);
                }

                if (!prefElem) {
                    return false;
                }

                // Notify listeners of removal by sending a change event
                // with the value from the nextBranch
                // Note:  Can't call notifyObservers directly because it
                // wouldn't notify all instances of XULPrefBranch.

                // Set the type to match nextBranch where possible
                // FIXME:  Is there a way to get complex types?
                prefName = prefElem.name.slice(root.length);
                prefType = nextBranch.getPrefType(prefName);
                if (prefType !== Ci.nsIPrefBranch.PREF_INVALID) {
                    prefElem.type = simpleTypeToName[prefType];
                }
                switch (prefType) {
                case Ci.nsIPrefBranch.PREF_BOOL:
                    prefElem.value = nextBranch.getBoolPref(prefName);
                    break;
                case Ci.nsIPrefBranch.PREF_INT:
                    prefElem.value = nextBranch.getIntPref(prefName);
                    break;
                case Ci.nsIPrefBranch.PREF_STRING:
                    prefElem.value = nextBranch.getCharPref(prefName);
                    break;
                default:
                    if (prefElem.type) {
                        try {
                            prefElem.value = prefElem.valueFromPreferences;
                        } catch (ex) {
                            // Happens when nextBranch has complex type and the
                            // type has changed on the preference element
                            logger.warn(
                                "Unable to set pref value to nextBranch value",
                                ex
                            );
                            prefElem.value = undefined;
                        }
                    } else {
                        prefElem.value = undefined;
                    }
                }

                prefElem.name = unusedPrefName;
                // Note: To avoid firing an useless change event for the
                // unused pref, set the _value field directly
                prefElem._value = undefined;

                return true;
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

            function notifyObservers(prefName) {
                var i, observer;

                for (i = 0; i < observerInfos.length; ++i) {
                    if (startsWith(prefName, observerInfos[i].branchName)) {
                        try {
                            observerInfos[i].observer.observe(
                                thisPrefBranch,
                                "nsPref:changed",
                                prefName
                            );
                        } catch (ex) {
                            logger.error("Preference observer threw an error",
                                ex);
                        }
                    }
                }

                i = 0;
                while (i < weakObserverInfos.length) {
                    if (startsWith(prefName, weakObserverInfos[i].branchName)) {
                        try {
                            /* Don't actually have an nsIWeakReference...
                             * See addListener
                            observer = weakObserverInfos[i].observer
                                .QueryReferent(Ci.nsIObserver);
                             */
                            observer = weakObserverInfos[i].observer;
                        } catch (ex2) {
                            // Reference expired
                            weakObserverInfos.splice(i, 1);
                            continue;
                        }

                        try {
                            observer.observe(
                                thisPrefBranch,
                                "nsPref:changed",
                                prefName
                            );
                        } catch (ex3) {
                            logger.error("Preference observer threw an error",
                                ex3);
                        }

                        ++i;
                    }
                }
            }

            prefObserver = {
                QueryInterface: function (aIID) {
                    if (aIID.equals(Ci.nsIObserver) ||
                            aIID.equals(Ci.nsISupportsWeakReference) ||
                            aIID.equals(Ci.nsISupports)) {
                        return this;
                    }
                    throw Cr.NS_NOINTERFACE;
                },

                observe: function (subject, topic, data) {
                    if (getPrefElem(data)) {
                        // XUL preference will fire change if it changes
                        return;
                    }

                    notifyObservers(data);
                }
            };

            function eventListener(evt) {
                if (evt.type === "change" &&
                        evt.target.localName === "preference" &&
                        evt.target.namespaceURI === globaldefs.XUL_NS) {
                    notifyObservers(evt.target.name.slice(root.length));
                }
            }

            this.addObserver = function (branchName, observer, holdWeak) {
                if (observerInfos.length === 0 &&
                        weakObserverInfos.length === 0) {
                    nextBranch2.addObserver("", prefObserver, true);
                    prefwindow.addEventListener("change", eventListener, false);
                }

                if (holdWeak) {
                    weakObserverInfos.push({
                        branchName: branchName,
                        /* FIXME: This doesn't work because we aren't going
                         * through XPConnect so the observer doesn't get
                         * wrapped in an nsXPCWrappedJS that inherits
                         * nsSupportsWeakReference
                         *
                        observer: observer
                            .QueryInterface(Ci.nsISupportsWeakReference)
                            .getWeakReference()
                         */
                        observer: observer
                    });
                } else {
                    observerInfos.push({
                        branchName: branchName,
                        observer: observer
                    });
                }
            };

            this.clearUserPref = function (prefName) {
                var prefElem;

                prefElem = getPrefElem(prefName);

                if (nextBranch.prefHasUserValue(prefName)) {
                    // Must have preference element with value undefined
                    // to cause the stored preference to be reset

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
                    // Clearing a preference only stored as an XUL element,
                    // just remove the element.

                    if (prefElem) {
                        removePrefElem(prefElem);
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
                    removePrefElem(prefElems[i]);
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

            this.getBranch = function (branchName) {
                var nextSubBranch;
                if (typeof nextBranch.getBranch === "function") {
                    nextSubBranch = nextBranch.getBranch(branchName);
                } else {
                    nextSubBranch = Cc["@mozilla.org/preferences-service;1"]
                        .getService(Ci.nsIPrefService)
                        .getBranch(root + branchName);
                }

                return new XULPrefBranch(
                    xulprefs,
                    root + branchName,
                    nextSubBranch
                );
            };

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

            this.removeObserver = function (branchName, observer) {
                var i, removed = false, weakObserver;

                for (i = 0; i < observerInfos.length; ++i) {
                    if (observerInfos[i].branchName === branchName &&
                            observerInfos[i].observer === observer) {
                        observerInfos.splice(i, 1);
                        removed = true;
                        break;
                    }
                }

                if (!removed) {
                    i = 0;
                    while (i < weakObserverInfos.length) {
                        if (weakObserverInfos[i].branchName === branchName) {
                            try {
                                /* Don't actually have an nsIWeakReference...
                                 * See addListener
                                observer = weakObserverInfos[i].observer
                                    .QueryReferent(Ci.nsIObserver);
                                 */
                                weakObserver = weakObserverInfos[i].observer;
                            } catch (ex) {
                                // Reference expired
                                weakObserverInfos.splice(i, 1);
                                continue;
                            }

                            if (observer === weakObserver) {
                                weakObserverInfos.splice(i, 1);
                                removed = true;
                                break;
                            }
                        }

                        ++i;
                    }
                }

                if (removed &&
                        observerInfos.length === 0 &&
                        weakObserverInfos.length === 0) {
                    prefwindow.removeEventListener(
                        "change",
                        eventListener,
                        false
                    );
                    nextBranch2.removeObserver("", prefObserver);
                }
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
            if (aIID.equals(Ci.nsIPrefBranch2) ||
                    aIID.equals(Ci.nsIPrefBranch) ||
                    aIID.equals(Ci.nsISupports)) {
                return this;
            }
            throw Cr.NS_NOINTERFACE;
        };

        return XULPrefBranch;
    }
);

// vi: set sts=4 sw=4 et :
