/* Define Validator subclass for the validator.nu service
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
        "json",
        "log4moz",
        "omnivalidator/cacheutils",
        "omnivalidator/locale",
        "omnivalidator/mediatypeutils",
        "omnivalidator/nserrorutils",
        "omnivalidator/validator",
        "omnivalidator/validatormessage",
        "underscore"
    ],
    function (Cc, Ci, Cr, JSON, log4moz, cacheutils, locale, mediatypeutils,
            nserrorutils, Validator, ValidatorMessage, underscore) {
        "use strict";

        var logger = log4moz.repository.getLogger("omnivalidator.validatornu");

        function ValidatorNuValidator(vid, validatorName, validatorArgs) {
            var thisValidator = this,
                validatorURL;

            validatorName = String(validatorName || "");
            Validator.call(this, vid, validatorName);

            if (!validatorArgs || !validatorArgs.validatorURL) {
                throw new Error("ValidatorNu requires a validatorURL argument");
            }
            validatorURL = validatorArgs.validatorURL;

            // Private members
            function convertMessage(vmessage, resourceid) {
                var
                    // category is somewhat arbitrary
                    // use one displayed in the Web Console for convenience
                    category = "malformed-xml",
                    columnNumber = null,
                    lineNumber = null,
                    level,
                    messageText,
                    sourceLine = null;

                messageText = vmessage.message;

                if (vmessage.type === "error") {
                    level = ValidatorMessage.ERROR;
                } else if (vmessage.type === "info" &&
                        // Placate SpiderMonkey strict option
                        // (ref to undef prop)
                        vmessage.hasOwnProperty("subType") &&
                        vmessage.subType === "warning") {
                    level = ValidatorMessage.WARNING;
                } else if (vmessage.type === "info" ||
                        vmessage.type === "non-document-error") {
                    level = ValidatorMessage.INFO;
                } else {
                    logger.warn('Unrecognized validator message type "' +
                            vmessage.type + '"');
                    level = ValidatorMessage.INFO;
                }

                if (vmessage.extract) {
                    sourceLine = vmessage.extract;
                    columnNumber = vmessage.offset || vmessage.hiliteStart;
                }

                if (vmessage.lastLine) {
                    lineNumber = vmessage.lastLine;
                }

                logger.trace(thisValidator.logName + " validating " +
                        resourceid.uri +
                        " message: " +
                        messageText +
                        " of type " +
                        vmessage.type);

                return new ValidatorMessage({
                    message: messageText,
                    sourceName: resourceid.uri,
                    sourceLine: sourceLine,
                    lineNumber: lineNumber,
                    columnNumber: columnNumber,
                    category: category,
                    level: level
                });
            }

            function parseResponse(response, resourceid, callbackValidate) {
                var errorCount = 0,
                    i,
                    message,
                    messages,
                    warnCount = 0;

                messages = response.messages;
                if (!messages) {
                    logger.warn("No messages in response from " +
                            thisValidator.logName + " validating " +
                            resourceid.uri);
                    messages = [];
                }

                for (i = 0; i < messages.length; ++i) {
                    message = messages[i];
                    if (!message || !message.message) {
                        logger.warn("Incomplete message in response from " +
                            thisValidator.logName + " validating " +
                            resourceid.uri);
                        continue;
                    }

                    if (message.type === "error") {
                        ++errorCount;
                    } else if (message.type === "info" &&
                            // Placate SpiderMonkey strict option
                            // (ref to undef prop)
                            message.hasOwnProperty("subType") &&
                            message.subType === "warning") {
                        ++warnCount;
                    }

                    callbackValidate(
                        thisValidator,
                        resourceid,
                        {message: convertMessage(message, resourceid)}
                    );
                }

                logger.debug("Summary information from " +
                        thisValidator.logName + " for " + resourceid.uri +
                        ": " +
                        errorCount + " errors, " +
                        warnCount + " warnings");

                return {
                    errorCount: errorCount,
                    warnCount: warnCount
                };
            }

            function handleResponse(xhr, resourceid, callbackValidate) {
                var errorMsg, response, responseType, statusText, summary;

                logger.debug("Processing validation response from " +
                        thisValidator.logName + " for " + resourceid.uri);

                callbackValidate(
                    thisValidator,
                    resourceid,
                    {state: "received"}
                );

                if (xhr.status !== 200) {
                    // Note:  This can throw in older versions of Firefox
                    // (e.g. when status === 0 from local TCP RST in FF 3.5)
                    try {
                        statusText = xhr.statusText;
                    } catch (ex) {
                        statusText = "";
                    }

                    logger.error(thisValidator.logName +
                        " returned HTTP status " +
                        xhr.status + " (" + statusText + ") validating " +
                        resourceid.uri);
                    errorMsg = locale.format(
                        "validator.errorHttpStatus",
                        validatorName,
                        xhr.status,
                        statusText,
                        resourceid.uri
                    );
                    callbackValidate(
                        thisValidator,
                        resourceid,
                        {
                            message: new ValidatorMessage(errorMsg),
                            state: "done"
                        }
                    );
                    return;
                }

                responseType = xhr.getResponseHeader("Content-Type");
                if (!/^application\/json\b/.test(responseType)) {
                    logger.warn(thisValidator.logName +
                            " returned content type " +
                            responseType + " validating " + resourceid.uri +
                            ", we requested application/json");
                }

                try {
                    response = JSON.parse(xhr.responseText);
                } catch (ex1) {
                    logger.error("Unable to parse response from " +
                        thisValidator.logName + " validating " +
                        resourceid.uri + " as JSON",
                        ex1);
                    errorMsg = locale.format(
                        "validator.errorParseFormat",
                        validatorName,
                        resourceid.uri,
                        "JSON",
                        ex1.message
                    );
                    callbackValidate(
                        thisValidator,
                        resourceid,
                        {
                            message: new ValidatorMessage(errorMsg),
                            state: "done"
                        }
                    );
                    return;
                }

                try {
                    summary = parseResponse(
                        response,
                        resourceid,
                        callbackValidate
                    );
                } catch (ex2) {
                    logger.error("Error processing response from " +
                        thisValidator.logName + " for " + resourceid.uri,
                        ex2);
                    errorMsg = locale.format(
                        "validator.errorProcessing",
                        validatorName,
                        resourceid.uri
                    );
                    callbackValidate(
                        thisValidator,
                        resourceid,
                        {
                            message: new ValidatorMessage(errorMsg),
                            state: "done"
                        }
                    );
                    return;
                }


                callbackValidate(
                    thisValidator,
                    resourceid,
                    {
                        state: "done",
                        summary: summary
                    }
                );

                logger.debug("Done processing validation response from " +
                    thisValidator.logName + " for " + resourceid.uri);
            }

            this.navigate = function (content, mediaType) {
            };

            // TODO:  Consider making this public if we can find a good way
            // to accept non-gzipped async streams
            function validateStream(resourceid, resourceType,
                    resourceStream, callbackValidate) {
                var errorMsg,
                    url,
                    xhr;

                url = validatorURL + "?out=json";

                xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                    .createInstance(Ci.nsIXMLHttpRequest);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        handleResponse(xhr, resourceid, callbackValidate);
                    }
                };

                logger.debug("Sending compressed validation request to " +
                        thisValidator.logName + " for " + resourceid.uri +
                        " with type " + resourceType);

                try {
                    xhr.open("POST", url, true);
                    xhr.setRequestHeader("Accept", "application/json");
                    if (resourceType) {
                        xhr.setRequestHeader("Content-Type", resourceType);
                    }
                    xhr.setRequestHeader("Content-Encoding", "gzip");

                    xhr.send(resourceStream);

                    callbackValidate(
                        thisValidator,
                        resourceid,
                        {state: "sent"}
                    );
                } catch (ex) {
                    logger.error("Error sending validation request to " +
                            url + " for " + thisValidator.logName +
                            " validating " + resourceid.uri,
                        ex);
                    errorMsg = locale.format(
                        "validator.errorSending",
                        validatorName,
                        resourceid.uri,
                        url,
                        ex.message
                    );
                    callbackValidate(
                        thisValidator,
                        resourceid,
                        {
                            message: new ValidatorMessage(errorMsg),
                            state: "done"
                        }
                    );
                    return;
                }
            }

            this.validate = function (resourceid, callbackValidate) {
                var gzipConverter,
                    syncListener;

                /* We can only get the Content-Type (and other headers) once we
                 * have received some channel data, XHR only takes synchronous
                 * streams for POST data, and we want to gzip it, so we wrap a
                 * gzipConverter for status and attach it to a syncListener
                 * which is passed to validateStream iff we receive some data.
                 */

                logger.debug("Compressing validation request to " +
                        thisValidator.logName);

                syncListener = Cc["@mozilla.org/network/sync-stream-listener;1"]
                    .createInstance(Ci.nsISyncStreamListener);
                gzipConverter = Cc["@mozilla.org/streamconv;1?from=uncompressed&to=gzip"]
                    .createInstance(Ci.nsIStreamConverter);
                // Send gzipConverter output to syncListener
                gzipConverter.asyncConvertData(
                    // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=732750
                    "gzip",
                    "gzip",
                    syncListener,
                    null
                );

                cacheutils.openResourceAsync(
                    resourceid,
                    {
                        QueryInterface: function (aIID) {
                            if (aIID.equals(Ci.nsIStreamListener) ||
                                    aIID.equals(Ci.nsIRequestObserver) ||
                                    aIID.equals(Ci.nsISupports)) {
                                return this;
                            }
                            throw Cr.NS_NOINTERFACE;
                        },

                        onDataAvailable: function (request, context, stream,
                                offset, count) {
                            // Data received
                            // Forward this and all subsequent callbacks
                            gzipConverter.onDataAvailable.apply(
                                gzipConverter,
                                arguments
                            );
                            this.onDataAvailable = underscore.bind(
                                gzipConverter.onDataAvailable,
                                gzipConverter
                            );
                            this.onStopRequest = underscore.bind(
                                gzipConverter.onStopRequest,
                                gzipConverter
                            );

                            // Start validation
                            // Note:  Can't call it here without risking
                            // a deadlock as XHR slurps the stream, so we defer
                            underscore.defer(
                                validateStream,
                                resourceid,
                                mediatypeutils.getContentTypeFromChannel(
                                    request
                                ),
                                syncListener.inputStream,
                                callbackValidate
                            );
                        },

                        onStartRequest: underscore.bind(
                            gzipConverter.onStartRequest,
                            gzipConverter
                        ),

                        onStopRequest: function (request, context, statusCode) {
                            var errorMsg;

                            syncListener.onStopRequest.apply(
                                syncListener,
                                arguments
                            );
                            if (statusCode === 0) {
                                // Stream with no data was successfully read
                                logger.error("Received an empty response for " +
                                    resourceid.uri + " by " +
                                    thisValidator.logName);
                                errorMsg = locale.format(
                                    "validator.errorEmptyResource",
                                    validatorName,
                                    resourceid.uri
                                );
                            } else {
                                // Stream reading failed
                                logger.error("Unable to read " +
                                    resourceid.uri + " by " +
                                    thisValidator.logName,
                                    nserrorutils.nsErrorToException(statusCode));
                                errorMsg = locale.format(
                                    "validator.errorGetResource",
                                    validatorName,
                                    nserrorutils.nsErrorGetMessage(statusCode),
                                    resourceid.uri
                                );
                            }

                            // Inform caller we have failed
                            callbackValidate(
                                thisValidator,
                                resourceid,
                                {
                                    message: new ValidatorMessage(errorMsg),
                                    state: "done"
                                }
                            );
                        }
                    }
                );
            };
        }
        ValidatorNuValidator.prototype = new Validator();

        return ValidatorNuValidator;
    }
);

// vi: set sts=4 sw=4 et :
