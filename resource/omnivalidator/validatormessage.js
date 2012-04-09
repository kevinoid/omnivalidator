/* Implementation of the ValidatorMessage class
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
        "gecko/components/interfaces",
        "gecko/components/results",
        "omnivalidator/locale"
    ],
    function (Ci, Cr, locale) {
        "use strict";

        function ValidatorMessage(message) {
            if (typeof message === "string") {
                this.message = message;
                this.level = ValidatorMessage.INFO;
            } else {
                this.errorMessage = message.errorMessage || message.message;
                this.sourceName = message.sourceName;
                this.sourceLine = message.sourceLine;
                this.lineNumber = message.lineNumber;
                this.columnNumber = message.columnNumber;
                this.flags = message.flags || 0;
                this.category = message.category;
                this.level = message.level;

                /*jslint bitwise: true */
                if (message.level) {
                    switch (message.level) {
                    case ValidatorMessage.ERROR:
                        // Note:  Does nothing, errorFlag = 0x0
                        this.flags |= Ci.nsIScriptError.errorFlag;
                        break;
                    case ValidatorMessage.WARNING:
                        this.flags |= Ci.nsIScriptError.warningFlag;
                        break;
                    case ValidatorMessage.INFO:
                        break;
                    }
                }
                /*jslint bitwise: false */

                this.message = message.message || this.toString();
            }
        }

        ValidatorMessage.ERROR = 0;
        ValidatorMessage.WARNING = 1;
        ValidatorMessage.INFO = 2;

        ValidatorMessage.prototype.QueryInterface = function (aIID) {
            if (aIID.equals(Ci.nsIScriptError) &&
                    this.level !== ValidatorMessage.INFO) {
                // Since there is no way to indicate non-error/warning with
                // flags, the only way to show informational messages in the
                // console is for them not to be nsIScriptError
                return this;
            }
            if (aIID.equals(Ci.nsIConsoleMessage) ||
                    aIID.equals(Ci.nsISupports)) {
                return this;
            }
            throw Cr.NS_NOINTERFACE;
        };

        ValidatorMessage.prototype.clone = function () {
            return new ValidatorMessage(this);
        };

        ValidatorMessage.prototype.toString = function () {
            var levelStr;

            switch (this.level) {
            case ValidatorMessage.ERROR:
                levelStr = locale.get("message.levelError");
                break;
            case ValidatorMessage.WARNING:
                levelStr = locale.get("message.levelWarning");
                break;
            case ValidatorMessage.INFO:
                levelStr = locale.get("message.levelInfo");
                break;
            default:
                levelStr = this.level;
                break;
            }

            return locale.format(
                "message.format",
                levelStr,
                this.message || ""
            );
        };

        return ValidatorMessage;
    }
);

// vi: set sts=4 sw=4 et :
