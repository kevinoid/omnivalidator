/* Implementation of a clickable button which displays validation status
 * information.
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
        "omnivalidator/cssutils",
        "underscore"
    ],
    function (cssutils, underscore) {
        "use strict";

        var CSS_STATUS_PREFIX = "omnivalidator-status-";

        function ValidationStatusButton(toolbarButton) {
            var tooltip,
                totals,
                // Sorted list of summaries by validator
                textSummaries;

            function getCssClass() {
                var className;

                if (totals.valCount === 0) {
                    className = "unknown";
                } else if (totals.errorCount > 0) {
                    className = "invalid";
                } else if (totals.warnCount > 0) {
                    className = "warn";
                } else {
                    className = "valid";
                }

                return CSS_STATUS_PREFIX + className;
            }

            function getTooltip() {
                if (textSummaries.length === 0) {
                    return "Not validated";
                }

                return "Validation Results:\n" + textSummaries.join("\n");
            }

            function update() {
                var className;

                // Update the CSS class of the button
                className = toolbarButton.className;
                className = cssutils.removeClassFrom(className,
                        new RegExp("^" + CSS_STATUS_PREFIX));
                className = cssutils.addClassTo(className, getCssClass());
                toolbarButton.className = className;

                // Update the tooltip
                toolbarButton.tooltipText = getTooltip();
            }

            this.addValidationSummary = function (validator, summary) {
                var textSummary;

                ++totals.valCount;
                totals.errorCount += summary.errorCount;
                totals.warnCount += summary.warnCount;

                textSummary =
                    validator.name + ": " +
                    summary.errorCount +
                    " Errors, " +
                    summary.warnCount +
                    " Warnings";

                textSummaries.splice(
                    underscore.sortedIndex(textSummary),
                    0,
                    textSummary
                );

                update();
            };

            this.reset = function () {
                textSummaries = [];
                tooltip = "Not validated";
                totals = {
                    errorCount: 0,
                    valCount: 0,
                    warnCount: 0
                };

                update();
            };

            this.reset();
        }

        return ValidationStatusButton;
    }
);

// vi: set sts=4 sw=4 et :
