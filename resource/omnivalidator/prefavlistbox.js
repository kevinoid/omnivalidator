/* Defines the PrefAVListbox class which represents the automatic validation
 * preferences listbox in the preferences window.
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

        // Return a wrapper around the function which will catch and log
        // any exceptions
        // Used as workaround for bug 503244
        function logUncaught(fun) {
            return function () {
                try {
                    fun.apply(this, arguments);
                } catch (ex) {
                    logger.error("Uncaught exception", ex);
                }
            };
        }

        function namespaceResolver(prefix) {
            var namespaces = {
                    xhtml: globaldefs.XHTML_NS,
                    xul: globaldefs.XUL_NS
                };

            return namespaces[prefix] || null;
        }

        function PrefAVListbox(listbox, valPrefs) {
            var document = listbox.ownerDocument,
                observer,
                thisPAVL = this;

            if (!valPrefs) {
                valPrefs = Preferences.getBranch(
                    globaldefs.EXT_PREF_PREFIX + "validators."
                );
            }

            function addAVPref(url, vid) {
                var i = 0;

                thisPAVL.disableUpdateFromPref();
                try {

                    while (valPrefs.hasUserValue(vid + ".autoValidate." + i)) {
                        ++i;
                    }

                    valPrefs.set(vid + ".autoValidate." + i, url);

                } finally {
                    thisPAVL.enableUpdateFromPref();
                }
            }

            function removeAVPref(url, vid) {
                var autoInds,
                    autoInd,
                    autoPrefs,
                    autoURL,
                    i,
                    lastAutoURL,
                    removed = false;

                thisPAVL.disableUpdateFromPref();
                try {

                    autoPrefs = valPrefs.getBranch(vid + ".autoValidate.");

                    autoInds = autoPrefs.getChildNames().filter(function (e) {
                        return (/^\d+$/).test(e);
                    });
                    autoInds.sort();

                    for (i = autoInds.length - 1; i >= 0; --i) {
                        autoInd = autoInds[i];
                        autoURL = autoPrefs.getValue(autoInd);

                        if (i === autoInds.length - 1) {
                            // Store for later
                            lastAutoURL = autoURL;
                        }

                        if (autoURL === url) {
                            // Replace with last to avoid moving all subsequent
                            if (i !== autoInds.length - 1) {
                                autoPrefs.set(autoInd, lastAutoURL);
                            }
                            autoPrefs.resetValue(autoInds[autoInds.length - 1]);
                            removed = true;
                            break;
                        }
                    }

                } finally {
                    thisPAVL.enableUpdateFromPref();
                }

                return removed;
            }

            function clearAVListitems() {
                var i, listitems;

                listitems = listbox.getElementsByTagNameNS(
                    globaldefs.XUL_NS,
                    "listitem"
                );

                for (i = listitems.length - 1; i >= 0; --i) {
                    listitems[i].parentNode.removeChild(listitems[i]);
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

            function findAVListitems(url, vid) {
                var i, listitems, predicate = [], xpresult;

                if (url) {
                    predicate.push(
                        "xul:listcell[1][@label = " +
                            xpathutils.quote(url) +
                            "]"
                    );
                }
                if (vid) {
                    predicate.push(
                        "xul:listcell[2][@value = " +
                            xpathutils.quote(vid) +
                            "]"
                    );
                }

                if (predicate.length > 0) {
                    predicate = "[" + predicate.join(" and ") + "]";
                } else {
                    predicate = "";
                }

                xpresult = document.evaluate(
                    "//xul:listitem" + predicate,
                    listbox,
                    namespaceResolver,
                    XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
                    null
                );

                listitems = [];
                for (i = 0; i < xpresult.snapshotLength; ++i) {
                    listitems.push(xpresult.snapshotItem(i));
                }

                return listitems;
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

            function checkAVListitems(vid) {
                var autoInd, autoPrefs, autoURLs, i, listitem, listitems, url;

                autoPrefs = valPrefs.getBranch(vid + ".autoValidate.");
                autoURLs = autoPrefs.getChildNames()
                    .filter(function (e) {
                        return (/^\d+$/).test(e);
                    }).map(function (e) {
                        return autoPrefs.getValue(e);
                    });
                autoURLs.sort();

                listitems = findAVListitems(null, vid);

                for (i = 0; i < listitems.length; ++i) {
                    listitem = listitems[i];
                    url = listitem.firstChild.getAttribute("label");
                    autoInd = underscore.sortedIndex(autoURLs, url);

                    // Strict mode...
                    if (autoInd === autoURLs.length ||
                            autoURLs[autoInd] !== url) {
                        // The URL for this listitem is not in autoURLs
                        listitem.parentNode.removeChild(listitem);
                    }
                }
            }

            function updateValidatorName(vid, name) {
                findAVListitems(null, vid)
                    .forEach(function (listitem) {
                        listitem.childNodes[1].setAttribute("label", name);
                    });
            }

            observer = {
                observe: logUncaught(function (subject, topic, data) {
                    var index, listitem, match, url, vid, vname;

                    match = /^(\w+)\.name$/.exec(data);
                    if (match) {
                        updateValidatorName(
                            match[1],
                            subject.getCharPref(data)
                        );
                        return;
                    }

                    match = /^(\w+)\.autoValidate\.(\d+)$/.exec(data);
                    if (!match) {
                        // This isn't a preference we're looking for
                        return;
                    }

                    vid = match[1];
                    index = match[2];
                    try {
                        url = subject.getCharPref(data);
                    } catch (ex) {
                        // Pref is unset or not a string, ok
                    }

                    if (!url) {
                        // One of the auto-validators has been removed
                        // Don't know the URL that was removed yet
                        checkAVListitems(vid);
                    } else {
                        listitem = findAVListitem(url, vid);

                        if (!listitem) {
                            // New auto-validator added
                            vname = vregistry.getNames(valPrefs)[vid];
                            insertAVListitem(createAVListitem(url, vid, vname));
                        } else {
                            // auto-validator has been changed
                            listitem.firstChild.setAttribute("label", url);
                            listitem.firstChild.setAttribute("value", url);
                        }
                    }
                })
            };

            this.add = function (url, vid, vname) {
                logger.debug("Adding automatic validation of " + url +
                        " to " + vid + " (" + vname + ")");

                insertAVListitem(createAVListitem(url, vid, vname));

                addAVPref(url, vid);
            };

            this.clear = function () {
                var i, vids;

                clearAVListitems();

                this.disableUpdateFromPref();
                try {

                    vids = valPrefs.getChildNames();
                    for (i = 0; i < vids.length; ++i) {
                        valPrefs.deleteBranch(vids[i] + ".autoValidate");
                    }

                } finally {
                    this.enableUpdateFromPref();
                }
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
                var i,
                    match,
                    prefNames,
                    url,
                    validatorNames,
                    vid,
                    vname;

                clearAVListitems();

                validatorNames = vregistry.getNames(valPrefs);

                prefNames = valPrefs.getDescendantNames();
                for (i = 0; i < prefNames.length; ++i) {
                    match = /^(\w+)\.autoValidate\.\d+$/.exec(prefNames[i]);
                    if (match) {
                        vid = match[1];
                        url = valPrefs.getValue(prefNames[i]);
                        vname = validatorNames[vid];

                        insertAVListitem(createAVListitem(url, vid, vname));
                    }
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

                listbox.removeChild(listitem);

                removeAVPref(url, vid);
            };

            this.reload();
            this.enableUpdateFromPref();
        }

        return PrefAVListbox;
    }
);

// vi: set sts=4 sw=4 et :
