/* Defines the PrefAVTreeView class which represents the automatic validation
 * preferences tree in the preferences window.
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
        "log4moz",
        "omnivalidator/arrayutils",
        "omnivalidator/globaldefs",
        "omnivalidator/objutils",
        "omnivalidator/preferences",
        "omnivalidator/simpletreeview",
        "omnivalidator/validatorregistry",
        "underscore"
    ],
    function (log4moz, arrayutils, globaldefs, objutils, Preferences,
            SimpleTreeView, vregistry, underscore) {
        "use strict";

        var logger = log4moz.repository.getLogger("omnivalidator.prefavtree");

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

        function PrefAVTreeView(valPrefs) {
            var colIdToProp = {
                    "auto-validate-url-treecol": "url",
                    "auto-validate-vid-treecol": "vname"
                },
                observer,
                superRemoveRange,
                thisPAVTV = this;

            SimpleTreeView.call(this, colIdToProp);

            if (!valPrefs) {
                valPrefs = Preferences.getBranch(
                    globaldefs.EXT_PREF_PREFIX + "validators."
                );
            }

            function addAVPref(url, vid) {
                var i;

                i = 0;
                while (valPrefs.hasUserValue(vid + ".autoValidate." + i)) {
                    ++i;
                }

                thisPAVTV.disableUpdateFromPref();
                try {

                    valPrefs.set(vid + ".autoValidate." + i, url);

                } finally {
                    thisPAVTV.enableUpdateFromPref();
                }
            }

            function addAVRow(url, vid, vname) {
                thisPAVTV.addRowData({
                    url: url,
                    vid: vid,
                    vname: vname
                });
            }

            function arrayToRanges(arr) {
                var i, ranges = [], start;

                if (arr.length === 0) {
                    return ranges;
                }

                start = arr[0];
                for (i = 1; i < arr.length; ++i) {
                    if (arr[i - 1] + 1 !== arr[i]) {
                        ranges.push({
                            start: start,
                            end: arr[i - 1] + 1
                        });
                        start = arr[i];
                    }
                }
                ranges.push({
                    start: start,
                    end: arr[arr.length - 1] + 1
                });

                return ranges;
            }

            function checkAVRows(vid) {
                var autoPrefs,
                    autoURLs,
                    i,
                    ind,
                    toRemove,
                    toRemoveRange,
                    toRemoveRanges,
                    row,
                    rows;

                autoPrefs = valPrefs.getBranch(vid + ".autoValidate.");
                autoURLs = autoPrefs.getChildNames()
                    .filter(function (e) {
                        return (/^\d+$/).test(e);
                    }).map(function (e) {
                        return autoPrefs.getValue(e);
                    });
                autoURLs.sort();

                rows = thisPAVTV.getRowsData();
                toRemove = [];
                for (i = 0; i < rows.length; ++i) {
                    row = rows[i];

                    if (row.vid === vid) {
                        ind = arrayutils.sortedIndex(autoURLs, row.url);
                        if (ind >= autoURLs.length ||
                                autoURLs[ind] !== row.url) {
                            toRemove.push(i);
                        }
                    }
                }

                toRemoveRanges = arrayToRanges(toRemove);

                if (thisPAVTV.treebox) {
                    thisPAVTV.treebox.beginUpdateBatch();
                }

                for (i = 0; i < toRemoveRanges.length; ++i) {
                    toRemoveRange = toRemoveRanges[i];
                    thisPAVTV.removeRange(
                        toRemoveRange.start,
                        toRemoveRange.end
                    );
                }

                if (thisPAVTV.treebox) {
                    thisPAVTV.treebox.endUpdateBatch();
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
                        thisPAVTV.disableUpdateFromPref();
                        try {

                            // Replace with last to avoid moving all subsequent
                            if (i !== autoInds.length - 1) {
                                autoPrefs.set(autoInd, lastAutoURL);
                            }
                            autoPrefs.resetValue(autoInds[autoInds.length - 1]);

                        } finally {
                            thisPAVTV.enableUpdateFromPref();
                        }

                        removed = true;
                        break;
                    }
                }

                return removed;
            }

            function updateValidatorName(vid, vname) {
                var vnames;

                vnames = thisPAVTV.getRowsData()
                    .map(function (row) {
                        return row.vid === vid ? vname : row.vname;
                    });

                thisPAVTV.setColData("auto-validate-vid-treecol", vnames);
            }

            observer = {
                observe: logUncaught(function (subject, topic, data) {
                    var index, match, url, vid, vname;

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
                        checkAVRows(vid);
                    } else {
                        // auto-validator has been added or changed,
                        // but we don't know which or the URL that was changed

                        // FIXME:  This doesn't handle duplicate-reduction
                        // correctly, since the former-duplicate will not
                        // be removed by checkAVRows
                        vname = subject.getCharPref(vid + ".name");
                        addAVRow(url, vid, vname);
                        checkAVRows(vid);
                    }
                })
            };

            this.add = function (url, vid, vname) {
                logger.debug("Adding automatic validation of " + url +
                        " to " + vid + " (" + vname + ")");

                addAVRow(url, vid, vname);
                addAVPref(url, vid);
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
                    rowData,
                    url,
                    validatorNames,
                    vid,
                    vname;

                validatorNames = vregistry.getNames(valPrefs);

                rowData = [];
                prefNames = valPrefs.getDescendantNames();
                for (i = 0; i < prefNames.length; ++i) {
                    match = /^(\w+)\.autoValidate\.\d+$/.exec(prefNames[i]);
                    if (match) {
                        vid = match[1];
                        url = valPrefs.getValue(prefNames[i]);
                        vname = validatorNames[vid];

                        rowData.push({
                            url: url,
                            vid: vid,
                            vname: vname
                        });
                    }
                }

                this.setRowsData(rowData);
            };

            superRemoveRange = this.removeRange;
            this.removeRange = function (start, end) {
                var i, rowData, vids;

                if (start === 0 && end === this.rowCount) {
                    // Performance optimization for removing everything
                    logger.debug("Removing all automatic validators");

                    vids = valPrefs.getChildNames();

                    this.disableUpdateFromPref();
                    try {

                        for (i = 0; i < vids.length; ++i) {
                            valPrefs.deleteBranch(vids[i] + ".autoValidate");
                        }

                    } finally {
                        this.enableUpdateFromPref();
                    }
                } else {
                    for (i = start; i < end; ++i) {
                        rowData = this.getRowDataAt(i);

                        logger.debug("Removing automatic validation of " +
                            rowData.url + " from " + rowData.vid);

                        removeAVPref(rowData.url, rowData.vid);
                    }
                }

                superRemoveRange.apply(this, arguments);
            };

            this.reload();
            this.enableUpdateFromPref();
        }

        PrefAVTreeView.prototype = objutils.create(SimpleTreeView.prototype);
        PrefAVTreeView.prototype.constructor = PrefAVTreeView;

        return PrefAVTreeView;
    }
);

// vi: set sts=4 sw=4 et :
