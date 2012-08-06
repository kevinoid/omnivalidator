/* Implementation of a clickable button which displays validation status
 * information.
 *
 * This file is part of the Omnivalidator extension.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true, unparam: true */
/*global define */

define(
    [
        "omnivalidator/arrayutils",
        "omnivalidator/cssutils",
        "omnivalidator/globaldefs",
        "omnivalidator/locale"
    ],
    function (arrayutils, cssutils, globaldefs, locale) {
        "use strict";

        var CSS_STATUS_PREFIX = globaldefs.CSS_PREFIX + "status-";

        function ValidationStatusButton(toolbarButton) {
            var totals,
                // Sorted list of summaries by validator name
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
                var title;

                title = locale.format(
                    "status.title",
                    globaldefs.EXT_NAME,
                    globaldefs.EXT_VERSION
                );

                if (textSummaries.length === 0) {
                    return title + "\n" + locale.get("status.notValidated");
                }

                return title + "\n" +
                    locale.get("status.validationResults") + "\n" +
                    textSummaries.join("\n");
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

            this.addValidationSummary = function (validatorName, summary) {
                var textSummary;

                ++totals.valCount;
                totals.errorCount += summary.errorCount;
                totals.warnCount += summary.warnCount;

                textSummary =
                    locale.format(
                        "status.validatorResult",
                        validatorName,
                        locale.formatPlural(
                            summary.errorCount,
                            "status.validatorErrors",
                            summary.errorCount
                        ),
                        locale.formatPlural(
                            summary.warnCount,
                            "status.validatorWarnings",
                            summary.warnCount
                        )
                    );

                textSummaries.splice(
                    arrayutils.sortedIndex(
                        textSummaries,
                        textSummary,
                        function (a, b) { return a.localeCompare(b); }
                    ),
                    0,
                    textSummary
                );

                update();
            };

            this.reset = function () {
                textSummaries = [];
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
