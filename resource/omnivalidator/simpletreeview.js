/* Defines SimpleTreeView class which serves as the view for a simple (i.e.
 * non-nested) tree backed by an array of row data.
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
        "gecko/components/interfaces",
        "gecko/components/results",
        "omnivalidator/arrayutils",
        "underscore"
    ],
    function (Ci, Cr, arrayutils, underscore) {
        "use strict";

        /** Constructs a new SimpleTreeView with a given column mapping.
         *
         * Note:  The SimpleTreeView is always sorted to guarantee fast
         * performance of indexOf and other find operations.
         *
         * @constructor
         * @param {Object} colIdToProp Associative array from column id to
         * property name which will act as the text/value for that column.
         * @param {Array} [initialCols=[]] An array of rows to be added
         * to the SimpleTreeView.
         */
        function SimpleTreeView(colIdToProp, initialRowsData) {
            var // Row data, sorted according to sortProps and sortDesc
                rowsData,
                // True if the property is sorted in descending order
                sortDesc = [],
                // Property name on which rows is sorted
                sortProps = [];

            function comparator(rowData1, rowData2) {
                var c, i, sortProp;
                for (i = 0; i < sortProps.length; ++i) {
                    sortProp = sortProps[i];
                    c = rowData1[sortProp].localeCompare(rowData2[sortProp]);
                    if (c !== 0) {
                        return c * (sortDesc[i] ? -1 : 1);
                    }
                }
                return 0;
            }

            rowsData = initialRowsData ? initialRowsData.slice(0) : [];
            sortProps = underscore.values(colIdToProp);
            sortDesc = sortProps.map(function () { return false; });
            rowsData.sort(comparator);

            // TODO:  Replace with property when only supporting ES5+
            this.rowCount = rowsData.length;

            this.addRowData = function (row) {
                var ind;

                ind = arrayutils.sortedIndex(rowsData, row, comparator);
                rowsData.splice(ind, 0, row);

                this.rowCount = rowsData.length;
                if (this.treebox) {
                    this.treebox.rowCountChanged(ind, 1);
                }
            };

            this.cycleHeader = function (column) {
                var i, ind, prop, sortCol;

                prop = colIdToProp[column.id];
                ind = sortProps.indexOf(prop);
                if (ind === 0) {
                    // User clicked the sorted column, reverse sort order
                    sortDesc[0] = !sortDesc[0];
                } else {
                    // Move clicked column to front of sort order
                    for (i = ind; i > 0; --i) {
                        sortProps[i] = sortProps[i - 1];
                        sortDesc[i] = sortDesc[i - 1];
                    }
                    sortProps[0] = prop;
                    sortDesc[0] = false;
                }

                rowsData.sort(comparator);

                if (this.treebox) {
                    // Clear sort indicator on previous sort column
                    sortCol = this.treebox.columns.getSortedColumn();
                    if (sortCol) {
                        sortCol.element.removeAttribute("sortDirection");
                    }
                }

                // Set sort indicator on first sorted column
                column.element.setAttribute(
                    "sortDirection",
                    sortDesc[0] ? "descending" : "ascending"
                );

                if (this.treebox) {
                    this.treebox.invalidate();
                }
            };

            this.getCellText = function (rowNum, col) {
                return rowsData[rowNum][colIdToProp[col.id]];
            };
            this.getCellValue = this.getCellText;

            this.getRowDataAt = function (i) { return rowsData[i]; };

            this.getRowsData = function () { return rowsData.slice(0); };

            this.removeRange = function (start, end) {
                var count = end - start;
                rowsData.splice(start, count);
                this.rowCount = rowsData.length;
                if (this.treebox) {
                    this.treebox.rowCountChanged(start, -count);
                }
            };

            this.removeSelected = function () {
                var end = {}, i, start = {};

                if (this.treebox) {
                    this.treebox.beginUpdateBatch();
                }

                // Careful, ranges are affected by removals
                for (i = this.selection.getRangeCount() - 1;
                        i >= 0;
                        --i) {
                    this.selection.getRangeAt(i, start, end);
                    this.removeRange(start.value, end.value + 1);
                }

                if (this.treebox) {
                    this.treebox.endUpdateBatch();
                }
            };

            this.setColData = function (colId, colData) {
                var column, i, propName;

                propName = colIdToProp[colId];
                for (i = 0; i < rowsData.length; ++i) {
                    rowsData[i][propName] = colData[i];
                }

                if (this.treebox) {
                    column = this.treebox.columns.getNamedColumn(colId);
                    this.treebox.invalidateColumn(column);
                }
            };

            this.setRowsData = function (newRowData) {
                var oldCount;

                oldCount = rowsData.length;
                rowsData = [];
                this.rowCount = 0;
                if (this.treebox) {
                    this.treebox.rowCountChanged(0, -oldCount);
                }

                rowsData = newRowData.splice(0);
                this.rowCount = rowsData.length;
                rowsData.sort(comparator);

                if (this.treebox) {
                    this.treebox.rowCountChanged(0, rowsData.length);
                }
            };

            this.setTree = function (treebox) {
                var colId, columns, i, sortProp;

                this.treebox = treebox;

                if (!treebox) {
                    return;
                }

                // Set the sort indicator to match the current sort
                // Remove any previous sort indicators
                columns = treebox.columns;
                for (i = 0; i < columns.count; ++i) {
                    columns.getColumnAt(i).element
                        .removeAttribute("sortDirection");
                }

                // Set the sort indicator on the first column matching
                // the current sort property
                sortProp = sortProps[0];
                for (colId in colIdToProp) {
                    if (colIdToProp.hasOwnProperty(colId)) {
                        if (colIdToProp[colId] === sortProp) {
                            columns.getNamedColumn(colId).element.setAttribute(
                                "sortDirection",
                                sortDesc[0] ? "descending" : "ascending"
                            );
                            break;
                        }
                    }
                }
            };
        }

        SimpleTreeView.prototype.QueryInterface = function (aIID) {
            if (aIID.equals(Ci.nsITreeView) ||
                    aIID.equals(Ci.nsISupports)) {
                return this;
            }
            throw Cr.NS_NOINTERFACE;
        };

        SimpleTreeView.prototype.isContainer = function (row) { return false; };
        SimpleTreeView.prototype.isSeparator = function (row) { return false; };
        SimpleTreeView.prototype.isSorted = function () { return true; };
        SimpleTreeView.prototype.getLevel = function (row) { return 0; };
        SimpleTreeView.prototype.getImageSrc = function (row, col) { return null; };
        SimpleTreeView.prototype.getRowProperties = function (row, props) {};
        SimpleTreeView.prototype.getCellProperties = function (row, col, props) {};
        SimpleTreeView.prototype.getColumnProperties = function (colid, col, props) {};

        return SimpleTreeView;
    }
);

// vi: set sts=4 sw=4 et :
