/* Defines the PrefAVListbox class which represents the automatic validation
 * preferences listbox in the preferences window.
 *
 * This file is part of the Omnivalidator extension for Firefox.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true */
/*global define */

define(
    [
        "dom/xpathresult",
        "log4moz",
        "omnivalidator/arrayutils",
        "omnivalidator/globaldefs",
        "omnivalidator/preferences",
        "omnivalidator/validatorregistry",
        "omnivalidator/xpathutils",
        "underscore"
    ],
    function (XPathResult, log4moz, arrayutils, globaldefs, Preferences,
            vregistry, xpathutils, underscore) {
        "use strict";

        var logger = log4moz.repository.getLogger("omnivalidator.prefavlistbox");

        function compact(array) {
            var li, ri, result;

            // Attempt to preserve as many index values as possible
            // This will minimize the number of observer notifications made
            // by the preferences system.
            // Fill undefined values from the back of the array.

            li = 0;
            ri = array.length - 1;
            result = [];

            while (ri >= 0 && array[ri] === undefined) {
                --ri;
            }
            if (ri < 0) {
                // No non-undefined values in array
                return result;
            }

            for (li = 0; li <= ri; ++li) {
                if (array[li] !== undefined) {
                    result[li] = array[li];
                } else {
                    result[li] = array[ri];
                    do {
                        --ri;
                    } while (ri >= li && array[ri] === undefined);
                }
            }

            return result;
        }

        function deleteAndTrim(array, index) {
            delete array[index];
            while (array.length > 0 && array[array.length - 1] === undefined) {
                array.pop();
            }
        }

        function PrefAVListbox(listbox) {
            var document = listbox.ownerDocument,
                // State of the preferences represented in the listbox
                // Map of VID to Array of auto-validate URLs
                // Array may be non-continuous in order to properly match
                // underlying preferences (particularly for observer updates)
                localAVPrefs = {},
                observer,
                // Sorted list of VIDs for which localAVPrefs may differ from
                // the stored preferences
                unsavedChanges = [],
                valPrefs = Preferences.getBranch(globaldefs.EXT_PREF_PREFIX +
                        "validators.");

            /* listitems appear after all other nodes, sorted in order
             * of the label of their first element */
            function compareListitem(a, b) {
                if (a.localName !== "listitem" ||
                        a.namespaceURI !== globaldefs.XUL_NS) {
                    return -1;
                } else if (b.localName !== "listitem" ||
                        b.namespaceURI !== globaldefs.XUL_NS) {
                    return 1;
                } else {
                    // Note:  May be called before XBL is attached, so don't
                    // rely on any XBL properties (e.g. label)
                    return a.firstChild.getAttribute("label").localeCompare(
                        b.firstChild.getAttribute("label")
                    ) || a.childNodes[1].getAttribute("label").localeCompare(
                        b.childNodes[1].getAttribute("label")
                    );
                }
            }

            function createAVListitem(url, vid, vname) {
                var listcell, listitem;

                listitem = document.createElementNS(
                    globaldefs.XUL_NS,
                    "listitem"
                );

                listcell = document.createElementNS(
                    globaldefs.XUL_NS,
                    "listcell"
                );
                listcell.setAttribute("label", url);
                listcell.setAttribute("value", url);
                listitem.appendChild(listcell);

                listcell = document.createElementNS(
                    globaldefs.XUL_NS,
                    "listcell"
                );
                listcell.setAttribute("label", vname);
                listcell.setAttribute("value", vid);
                listitem.appendChild(listcell);

                return listitem;
            }

            function findAVListitem(url, vid) {
                function namespaceResolver(prefix) {
                    var namespaces = {
                            xul: globaldefs.XUL_NS
                        };

                    return namespaces[prefix] || null;
                }

                url = xpathutils.quote(url);
                vid = xpathutils.quote(vid);
                return document.evaluate(
                    "//xul:listitem[" +
                        "xul:listcell[1][@label = " + url + "] and " +
                        "xul:listcell[2][@value = " + vid + "]]",
                    listbox,
                    namespaceResolver,
                    XPathResult.ANY_UNORDERED_NODE_TYPE,
                    null
                ).singleNodeValue;
            }

            function insertAVListitem(listitem) {
                var index;

                index = arrayutils.sortedIndex(
                    listbox.childNodes,
                    listitem,
                    compareListitem
                );

                listbox.insertBefore(listitem, listbox.childNodes[index]);
            }

            function markChanged(vid) {
                var index = underscore.sortedIndex(unsavedChanges, vid);
                // Extra check to placate Gecko strict mode
                if (index === unsavedChanges.length ||
                        unsavedChanges[index] !== vid) {
                    unsavedChanges.splice(index, 0, vid);
                }
            }

            function getAVPrefs() {
                var autoURLsByVID = {},
                    i,
                    match,
                    prefNames;

                prefNames = valPrefs.getDescendantNames();
                for (i = 0; i < prefNames.length; ++i) {
                    match = /^(\w+)\.autoValidate\.(\d+)$/.exec(prefNames[i]);
                    if (match) {
                        if (!autoURLsByVID.hasOwnProperty(match[1])) {
                            autoURLsByVID[match[1]] = [];
                        }
                        autoURLsByVID[match[1]][match[2]] =
                            valPrefs.getValue(prefNames[i]);
                    }
                }

                return autoURLsByVID;
            }

            observer = {
                observe: function (subject, topic, data) {
                    var autoURLs, index, listitem, match, url, vid, vname;

                    match = /^(\w+)\.autoValidate\.(\d+)$/.exec(data);
                    if (!match) {
                        // This isn't a preference we're looking for
                        return;
                    }

                    vid = match[1];
                    index = match[2];

                    if (!localAVPrefs.hasOwnProperty(vid)) {
                        // Auto-validation added for a validator
                        localAVPrefs[vid] = [];
                    }
                    autoURLs = localAVPrefs[vid];

                    url = valPrefs.getValue(data);
                    if (!url) {
                        // One of the auto-validators has been removed
                        listitem = findAVListitem(
                            autoURLs[index],
                            vid
                        );
                        if (listitem) {
                            listitem.parentNode.removeChild(listitem);
                        }

                        deleteAndTrim(autoURLs, index);
                    } else if (!autoURLs.hasOwnProperty(index)) {
                        // New auto-validator added
                        vname = vregistry.getNames()[vid];
                        insertAVListitem(createAVListitem(url, vid, vname));

                        autoURLs[index] = url;
                    } else if (autoURLs[index] !== url) {
                        // auto-validator has been changed
                        listitem = findAVListitem(
                            autoURLs[index],
                            vid
                        );
                        listitem.firstChild.setAttribute("label", url);
                        listitem.firstChild.setAttribute("value", url);

                        autoURLs[index] = url;
                    }
                }
            };

            this.add = function (url, vid, vname) {
                logger.debug("Adding automatic validation of " + url +
                        " to " + vid + " (" + vname + ")");

                if (!localAVPrefs.hasOwnProperty(vid)) {
                    localAVPrefs[vid] = [];
                }
                localAVPrefs[vid].push(url);
                markChanged(vid);

                insertAVListitem(createAVListitem(url, vid, vname));
            };

            this.clear = function () {
                var i, listitems;

                listitems = listbox.getElementsByTagNameNS(
                    globaldefs.XUL_NS,
                    "listitem"
                );

                for (i = listitems.length - 1; i >= 0; --i) {
                    listitems[i].parentNode.removeChild(listitems[i]);
                }

                underscore.keys(localAVPrefs).forEach(markChanged);
                localAVPrefs = {};
            };

            this.disableUpdateFromPref = function () {
                valPrefs.removeObserver(observer);
            };

            this.enableUpdateFromPref = function () {
                // FIXME:  Remove the cycle between observer and valPrefs to
                // remove the need for a weak reference here
                valPrefs.addObserver("", observer, true);
            };

            this.reload = function () {
                var autoURLs,
                    autoVal = [],
                    i,
                    validatorNames,
                    vid;

                this.clear();

                localAVPrefs = getAVPrefs();
                unsavedChanges = [];

                validatorNames = vregistry.getNames();
                for (vid in localAVPrefs) {
                    if (localAVPrefs.hasOwnProperty(vid)) {
                        autoURLs = localAVPrefs[vid];
                        for (i = 0; i < autoURLs.length; ++i) {
                            if (autoURLs[i] !== undefined) {
                                autoVal.push({
                                    url: autoURLs[i],
                                    vid: vid,
                                    vname: validatorNames[vid]
                                });
                            }
                        }
                    }
                }

                autoVal.sort(function (a, b) {
                    return a.url.localeCompare(b.url) ||
                        a.vname.localeCompare(b.vname);
                });

                for (i = 0; i < autoVal.length; ++i) {
                    listbox.appendChild(
                        createAVListitem(
                            autoVal[i].url,
                            autoVal[i].vid,
                            autoVal[i].vname
                        )
                    );
                }
            };

            this.removeSelected = function () {
                var listitem,
                    url,
                    vid;

                listitem = listbox.selectedItem;
                if (!listitem) {
                    return;
                }

                url = listitem.childNodes[0].getAttribute("label");
                vid = listitem.childNodes[1].getAttribute("value");

                logger.debug("Removing automatic validation of " + url +
                        " from " + vid);

                deleteAndTrim(
                    localAVPrefs[vid],
                    localAVPrefs[vid].indexOf(url)
                );

                markChanged(vid);

                listbox.removeChild(listitem);
            };

            this.save = function () {
                var i,
                    vid;

                logger.debug("Saving automatic validation preferences");

                this.disableUpdateFromPref();
                for (i = 0; i < unsavedChanges.length; ++i) {
                    vid = unsavedChanges[i];

                    logger.trace("Saving automatic validation preferences for " + vid);

                    if (!localAVPrefs.hasOwnProperty(vid) ||
                            localAVPrefs[vid].length === 0) {
                        valPrefs.deleteBranch(vid + ".autoValidate");
                        delete localAVPrefs[vid];
                    } else {
                        // Compact the array
                        localAVPrefs[vid] = compact(localAVPrefs[vid]);

                        valPrefs.set(vid + ".autoValidate", localAVPrefs[vid]);
                    }
                }
                this.enableUpdateFromPref();

                unsavedChanges = [];
            };

            this.reload();
            this.enableUpdateFromPref();
        }

        return PrefAVListbox;
    }
);

// vi: set sts=4 sw=4 et :
