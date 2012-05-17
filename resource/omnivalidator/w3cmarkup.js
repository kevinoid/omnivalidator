/* Define Validator subclass for the W3C Validator service
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
        "dom/node",
        "dom/xpathresult",
        "gecko/components/classes",
        "gecko/components/interfaces",
        "gecko/components/results",
        "log4moz",
        "omnivalidator/cacheutils",
        "omnivalidator/domutils",
        "omnivalidator/locale",
        "omnivalidator/mediatypeutils",
        "omnivalidator/multipartformdata",
        "omnivalidator/nserrorutils",
        "omnivalidator/validator",
        "omnivalidator/validatormessage",
        "underscore"
    ],
    function (Node, XPathResult, Cc, Ci, Cr, log4moz, cacheutils, domutils,
            locale, mediatypeutils, MultipartFormData, nserrorutils, Validator,
            ValidatorMessage, underscore) {
        "use strict";

        var SOAP_ENV_NS = "http://www.w3.org/2003/05/soap-envelope",
            VAL_NS = "http://www.w3.org/2005/10/markup-validator",
            logger = log4moz.repository.getLogger("omnivalidator.validatornu");

        function W3CValidator(vid, validatorName, validatorArgs) {
            var thisValidator = this,
                validatorURL;

            validatorName = String(validatorName || "");
            Validator.call(this, vid, validatorName);

            if (!validatorArgs || !validatorArgs.validatorURL) {
                throw new Error("W3CValidator requires a validatorURL argument");
            }
            validatorURL = validatorArgs.validatorURL;

            // Convert the content of the source node to something useful
            // The source node contains HTML for displaying the context of
            // the error to the user.  We remove the HTML markup (which only
            // highlights the error) and use it to get the column at which
            // the error occurred (which is where the highlighting starts).
            function parseSource(source) {
                var column,
                    doc,
                    firstNode,
                    parser;

                parser = Cc["@mozilla.org/xmlextras/domparser;1"]
                    .createInstance(Ci.nsIDOMParser);

                try {
                    doc = parser.parseFromString(
                        // Wrap fragment in fake root element
                        "<root>" + source + "</root>",
                        "application/xml"
                    );
                } catch (ex) {
                    logger.warn("Unable to parse source line from validator",
                        ex);
                    return null;
                }

                firstNode = doc.documentElement.firstChild;
                if (firstNode.nodeType === Node.TEXT_NODE) {
                    if (firstNode.nextSibling) {
                        // Highlighting begins at end of this text
                        column = firstNode.nodeValue.length;
                    } else {
                        // No highlighting, don't know where error was
                        column = null;
                    }
                } else {
                    // Highlighting begins at the start of source
                    column = 0;
                }

                return {
                    columnNumber: column,
                    sourceLine: doc.documentElement.textContent
                };
            }

            /** Parse error or warning element */
            function parseMessage(msgNode, resourceid) {
                var
                    // category is somewhat arbitrary
                    // use one displayed in the Web Console for convenience
                    category = "malformed-xml",
                    childText,
                    columnNumber = null,
                    level,
                    lineNumber = null,
                    messageText,
                    node,
                    source,
                    sourceLine = null,
                    sourceName = resourceid.uri,
                    val;

                /*jslint bitwise: true */
                switch (msgNode.localName) {
                case "error":
                    level = ValidatorMessage.ERROR;
                    break;

                case "warning":
                    level = ValidatorMessage.WARNING;
                    break;

                default:
                    logger.debug("Unexpected element " + msgNode.localName +
                           " not error/warning");
                    level = ValidatorMessage.INFO;
                    break;
                }
                /*jscript bitwise: false */

                for (node = msgNode.firstChild; node; node = node.nextSibling) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        if (/\S/.test(node.nodeValue)) {
                            logger.debug("Skipping text in validator message: " +
                                    node.nodeValue);
                        }
                        continue;
                    }

                    if (node.nodeType !== Node.ELEMENT_NODE) {
                        logger.debug("Skipping non-text, non-element node: " +
                                node.nodeName);
                        continue;
                    }

                    if (node.namespaceURI !== VAL_NS) {
                        logger.debug("Skipping non-validation node " +
                                node.localName + " from namespace " +
                                node.namespaceURI + " in validator message");
                        continue;
                    }

                    childText = domutils.childTextContent(node);
                    if (!childText) {
                        logger.debug("Skipping validator message node " +
                                node.localName + " with no child text");
                        continue;
                    }

                    switch (node.localName) {
                    /* Not used.
                     * Web Console only uses the column to place an indicator
                     * of the error in the source line (not when opening the
                     * external editor).  Since the W3C validator only provides
                     * part of a line in "source" and "col" is relative to the
                     * original line, this is often incorrect.
                    case "col":
                        val = parseInt(childText, 10);
                        if (!isNaN(val)) {
                            columnNumber = val;
                        } else {
                            logger.warn("Unable to parse column number from validator response: " +
                                childText);
                        }
                        break;
                    */

                    case "line":
                        val = parseInt(childText, 10);
                        if (!isNaN(val)) {
                            lineNumber = val;
                        } else {
                            logger.warn("Unable to parse line number from validator response: " +
                                childText);
                        }
                        break;

                    case "message":
                        messageText = childText;
                        break;

                    case "source":
                        source = parseSource(childText);
                        columnNumber = source.columnNumber;
                        sourceLine = source.sourceLine;
                        break;
                    }
                }

                return new ValidatorMessage({
                    message: messageText,
                    sourceName: sourceName,
                    sourceLine: sourceLine,
                    lineNumber: lineNumber,
                    columnNumber: columnNumber,
                    level: level,
                    category: category
                });
            }

            function handleResponseDoc(valResponseDoc, resourceid,
                    callbackValidate) {
                var errorCount,
                    intVal,
                    msgNode,
                    mvrCount,
                    warnCount,
                    xpathItr;

                function namespaceResolver(prefix) {
                    var namespaces = {
                            env: SOAP_ENV_NS,
                            m: VAL_NS
                        };

                    return namespaces[prefix] || null;
                }

                mvrCount = valResponseDoc.evaluate(
                    "count(/env:Envelope/env:Body/m:markupvalidationresponse)",
                    valResponseDoc.documentElement,
                    namespaceResolver,
                    XPathResult.NUMBER_TYPE,
                    null
                ).numberValue;

                if (mvrCount === 0) {
                    throw new Error("XML did not contain a" +
                        " markup validation response in SOAP");
                }

                errorCount = valResponseDoc.evaluate(
                    "/env:Envelope/env:Body/m:markupvalidationresponse" +
                        "/m:errors/m:errorcount/text()",
                    valResponseDoc.documentElement,
                    namespaceResolver,
                    XPathResult.STRING_TYPE,
                    null
                ).stringValue;
                if (errorCount) {
                    intVal = parseInt(errorCount, 10);
                    if (!isNaN(intVal)) {
                        errorCount = intVal;
                    } else {
                        logger.warn("Unable to parse errorcount content " +
                            '"' + errorCount + '"' +
                            " as an integer for " +
                            validatorName + " for " + resourceid.uri);
                        errorCount = "";
                    }
                }
                if (errorCount === "") {
                    // Count error elements as a fallback
                    errorCount = valResponseDoc.evaluate(
                        "count(/env:Envelope/env:Body/m:markupvalidationresponse" +
                            "/m:errors/m:errorlist/m:error)",
                        valResponseDoc.documentElement,
                        namespaceResolver,
                        XPathResult.NUMBER_TYPE,
                        null
                    ).numberValue;
                }

                warnCount = valResponseDoc.evaluate(
                    "/env:Envelope/env:Body/m:markupvalidationresponse" +
                        "/m:warnings/m:warningcount/text()",
                    valResponseDoc.documentElement,
                    namespaceResolver,
                    XPathResult.STRING_TYPE,
                    null
                ).stringValue;
                if (warnCount) {
                    intVal = parseInt(warnCount, 10);
                    if (!isNaN(intVal)) {
                        warnCount = intVal;
                    } else {
                        logger.warn("Unable to parse warningcount content " +
                            '"' + warnCount + '"' +
                            " as an integer for " +
                            validatorName + " for " + resourceid.uri);
                        warnCount = "";
                    }
                }
                if (warnCount === "") {
                    // Count warning elements as a fallback
                    warnCount = valResponseDoc.evaluate(
                        "count(/env:Envelope/env:Body/m:markupvalidationresponse" +
                            "/m:warnings/m:warninglist/m:warning)",
                        valResponseDoc.documentElement,
                        namespaceResolver,
                        XPathResult.NUMBER_TYPE,
                        null
                    ).numberValue;
                }

                xpathItr = valResponseDoc.evaluate(
                    "/env:Envelope/env:Body/m:markupvalidationresponse" +
                        "/m:errors/m:errorlist/m:error" +
                        "|" +
                        "/env:Envelope/env:Body/m:markupvalidationresponse" +
                        "/m:warnings/m:warninglist/m:warning",
                    valResponseDoc.documentElement,
                    namespaceResolver,
                    XPathResult.ORDERED_NODE_ITERATOR_TYPE,
                    null
                );

                for (msgNode = xpathItr.iterateNext();
                        msgNode;
                        msgNode = xpathItr.iterateNext()) {
                    callbackValidate(
                        thisValidator,
                        resourceid,
                        {message: parseMessage(msgNode, resourceid)}
                    );
                }

                return {
                    errorCount: errorCount,
                    warnCount: warnCount
                };
            }

            function handleResponse(xhr, resourceid, callbackValidate) {
                var errorMsg, responseType, statusText, summary;

                logger.debug("Processing validation response from " +
                        validatorName + " for " + resourceid.uri);

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

                    logger.error(validatorName + " returned HTTP status " +
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
                if (!/^application\/soap\+xml\b/.test(responseType)) {
                    logger.warn(validatorName + " returned content type " +
                            responseType + " for " + resourceid.uri +
                            ", we requested application/soap+xml");
                }

                if (!xhr.responseXML) {
                    logger.error("Unable to parse response from " +
                        validatorName + " validating " + resourceid.uri +
                        " as XML");
                    errorMsg = locale.format(
                        "validator.errorParseFormat",
                        validatorName,
                        resourceid.uri,
                        "XML",
                        ""
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
                    summary = handleResponseDoc(
                        xhr.responseXML,
                        resourceid,
                        callbackValidate
                    );
                } catch (ex) {
                    logger.error("Error processing response from " +
                        validatorName + " for " + resourceid.uri,
                        ex);
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

                logger.debug("Summary information from " +
                        validatorName + " for " + resourceid.uri +
                        ": " +
                        summary.errorCount + " errors, " +
                        summary.warnCount + " warnings");
                callbackValidate(
                    thisValidator,
                    resourceid,
                    {
                        state: "done",
                        summary: summary
                    }
                );

                logger.debug("Done processing validation response from " +
                    validatorName + " for " + resourceid.uri);
            }

            this.navigate = function (content, mediaType) {
            };

            // TODO:  Consider making this public if the differences with
            // validatornu (gzipped stream) can be addressed well.
            function validateStream(resourceid, resourceType,
                    resourceStream, callbackValidate) {
                var contentHeaders,
                    errorMsg,
                    filename,
                    formData,
                    formDataStream,
                    url,
                    xhr;

                // Note:  Filename only used by validator internally
                try {
                    url = Cc["@mozilla.org/network/io-service;1"]
                        .getService(Ci.nsIIOService)
                        .newURI(resourceid.uri, null, null)
                        .QueryInterface(Ci.nsIURL);
                    filename = (url.fileBaseName || "index") +
                        "." + (url.fileExtension || "htm");
                } catch (ex) {
                    filename = "index.htm";
                }

                contentHeaders = {};
                if (resourceType) {
                    contentHeaders["Content-Type"] = resourceType;
                }

                formData = new MultipartFormData();
                formData.append(
                    {
                        name: "uploaded_file",
                        filename: filename
                    },
                    resourceStream,
                    contentHeaders
                );
                formData.append("output", "soap12");

                formDataStream = formData.getEncoded();

                xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                    .createInstance(Ci.nsIXMLHttpRequest);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        handleResponse(xhr, resourceid, callbackValidate);
                    }
                };

                logger.debug("Sending validation request to " + validatorName);

                try {
                    xhr.open("POST", validatorURL, true);
                    xhr.setRequestHeader("Accept", "application/soap+xml");
                    xhr.setRequestHeader(
                        "Content-Type",
                        "multipart/form-data; boundary=" + formData.getBoundary()
                    );
                    // Note:  Content-Length set from formDataStream.available()
                    // in XMLHttpRequest.send()
                    // FIXME:  Do we need to close formDataStream?  When?
                    xhr.send(formDataStream);

                    callbackValidate(
                        thisValidator,
                        resourceid,
                        {state: "sent"}
                    );
                } catch (ex2) {
                    logger.error("Error sending validation request to " +
                            validatorURL + " for " + validatorName +
                            " validating " + resourceid.uri,
                        ex2);
                    errorMsg = locale.format(
                        "validator.errorSending",
                        validatorName,
                        resourceid.uri,
                        url,
                        ex2.message
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

            function logStream(stream) {
                var mstream = Cc["@mozilla.org/io/multiplex-input-stream;1"]
                    .createInstance(Ci.nsIMultiplexInputStream);
                mstream.appendStream(stream);
                var sstream = Cc["@mozilla.org/io/string-input-stream;1"]
                    .createInstance(Ci.nsIStringInputStream);
                sstream.setData("After resource", 14);
                mstream.appendStream(sstream);
                var stream = Cc["@mozilla.org/scriptableinputstream;1"]  
                     .createInstance(Ci.nsIScriptableInputStream);
                stream.init(mstream);
                logger.error("Stream contains the following content:\n" +
                    stream.read(stream.available()));
            }

            this.validate = function (resourceid, callbackValidate) {
                var syncListener;

                /* We can only get the Content-Type (and other headers) once we
                 * have received some channel data and XHR only takes synchronous
                 * streams for POST data, so we wrap a syncListener and only
                 * call validateStream once we have received some data.
                 */
                syncListener = Cc["@mozilla.org/network/sync-stream-listener;1"]
                    .createInstance(Ci.nsISyncStreamListener);
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
                            syncListener.onDataAvailable.apply(
                                syncListener,
                                arguments
                            );
                            this.onDataAvailable = underscore.bind(
                                syncListener.onDataAvailable,
                                syncListener
                            );
                            this.onStopRequest = underscore.bind(
                                syncListener.onStopRequest,
                                syncListener
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
                            syncListener.onStartRequest,
                            syncListener
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
                                    resourceid.uri + " by " + validatorName);
                                errorMsg = locale.format(
                                    "validator.errorEmptyResource",
                                    validatorName,
                                    resourceid.uri
                                );
                            } else {
                                // Stream reading failed
                                logger.error("Unable to read " +
                                    resourceid.uri + " by " + validatorName,
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
        W3CValidator.prototype = new Validator();

        return W3CValidator;
    }
);

// vi: set sts=4 sw=4 et :
