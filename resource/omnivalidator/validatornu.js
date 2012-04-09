/* Define Validator subclass for the validator.nu service
 *
 * This file is part of the Omnivalidator extension for Firefox.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint continue: true, indent: 4, plusplus: true */
/*global define */

define(
    [
        "gecko/components/classes",
        "gecko/components/interfaces",
        "json",
        "log4moz",
        "omnivalidator/cacheutils",
        "omnivalidator/mediatypeutils",
        "omnivalidator/validator",
        "omnivalidator/validatormessage"
    ],
    function (Cc, Ci, JSON, log4moz, cacheutils, mediatypeutils,
            Validator, ValidatorMessage) {
        "use strict";

        var logger = log4moz.repository.getLogger("omnivalidator.validatornu");

        function ValidatorNuValidator(validatorName, validatorArgs) {
            var thisValidator = this,
                validatorURL = validatorArgs.validatorURL;

            Validator.call(this, validatorName);

            // Private members
            function convertMessage(vmessage, resourceid) {
                var
                    // category is somewhat arbitrary
                    // use one displayed in the Web Console for convenience
                    category = "malformed-xml",
                    cmessage,
                    columnNumber = null,
                    lineNumber = null,
                    level,
                    messageText,
                    sourceLine = null,
                    sourceName = null;

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

                logger.trace(validatorName + " validating " + resourceid.uri +
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
                var errorcount = 0,
                    i,
                    message,
                    messages,
                    warnCount = 0;

                messages = response.messages;
                if (!messages) {
                    logger.warn("No messages in response from " +
                            validatorName + " validating " + resourceid.uri);
                    messages = [];
                }

                for (i = 0; i < messages.length; ++i) {
                    message = messages[i];
                    if (!message || !message.message) {
                        logger.warn("Incomplete message in response from " +
                            validatorName + " validating " + resourceid.uri);
                        continue;
                    }

                    if (message.type === "error") {
                        ++errorcount;
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
                        validatorName + " for " + resourceid.uri +
                        ": " +
                        errorcount + " errors, " +
                        warnCount + " warnings");
                callbackValidate(
                    thisValidator,
                    resourceid,
                    {
                        summary: {
                            errorCount: errorcount,
                            warnCount: warnCount
                        }
                    }
                );
            }

            function handleResponse(xhr, resourceid, callbackValidate) {
                var errorMsg, response, responseType, result, summary;

                logger.debug("Processing validation response from " +
                        validatorName + " for " + resourceid.uri);

                if (xhr.status !== 200) {
                    errorMsg = validatorName + " returned HTTP status " +
                        xhr.statusText + "(" + xhr.status + ") validating " +
                        resourceid.uri;
                    logger.error(errorMsg);
                    callbackValidate(
                        thisValidator,
                        resourceid,
                        {message: new ValidatorMessage(errorMsg)}
                    );
                    return;
                }

                responseType = xhr.getResponseHeader("Content-Type");
                if (!/^application\/json\b/.test(responseType)) {
                    logger.warn(validatorName + " returned content type " +
                            responseType + " validating " + resourceid.uri +
                            ", we requested application/json");
                }

                try {
                    response = JSON.parse(xhr.responseText);
                } catch (ex1) {
                    errorMsg = "Unable to parse response from " +
                        validatorName + " validating " + resourceid.uri +
                        " as JSON";
                    logger.error(errorMsg, ex1);
                    callbackValidate(
                        thisValidator,
                        resourceid,
                        {message: new ValidatorMessage(errorMsg)}
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
                    errorMsg = "Error processing response from " +
                            validatorName + " for " + resourceid.uri;
                    logger.error(errorMsg, ex2);
                    callbackValidate(
                        thisValidator,
                        resourceid,
                        {message: new ValidatorMessage(errorMsg + ": " + ex2)}
                    );
                    return;
                }


                callbackValidate(
                    thisValidator,
                    resourceid,
                    {summary: summary}
                );

                logger.debug("Done processing validation response from " +
                    validatorName + " for " + resourceid.uri);
            }

            this.navigate = function (content, mediaType) {
            };

            this.validate = function (resourceid, callbackValidate) {
                var channel,
                    contentType,
                    gzipConverter,
                    gzipListener,
                    url,
                    xhr;

                contentType = mediatypeutils.getContentType(resourceid);

                logger.debug("Compressing validation request to " +
                        validatorName);

                gzipConverter = Cc["@mozilla.org/streamconv;1?from=uncompressed&to=gzip"]
                    .createInstance(Ci.nsIStreamConverter);
                // Note:  nsDeflateConverter (implements nsIStreamConverter)
                // doesn't implement synchronous convert, so we need to
                // adapt the async api to an input stream
                gzipListener = Cc["@mozilla.org/network/sync-stream-listener;1"]
                    .createInstance(Ci.nsISyncStreamListener);
                gzipConverter.asyncConvertData(
                    // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=732750
                    "gzip",
                    "gzip",
                    gzipListener,
                    null
                );
                channel = cacheutils.getChannel(resourceid);
                channel.asyncOpen(gzipConverter, null);

                url = validatorURL + "?out=json";

                xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                    .createInstance(Ci.nsIXMLHttpRequest);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        handleResponse(xhr, resourceid, callbackValidate);
                    }
                };

                logger.debug("Sending validation request to " + validatorName +
                        " for " + resourceid.uri + " with type " + contentType);

                xhr.open("POST", url, true);
                xhr.setRequestHeader("Accept", "application/json");
                if (contentType) {
                    xhr.setRequestHeader("Content-Type", contentType);
                }
                xhr.setRequestHeader("Content-Encoding", "gzip");

                xhr.send(gzipListener.inputStream);
            };
        }
        ValidatorNuValidator.prototype = new Validator();

        return ValidatorNuValidator;
    }
);

// vi: set sts=4 sw=4 et :
