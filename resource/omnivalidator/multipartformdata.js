/* Implementation of MultipartFormData class to encode multipart/form-data
 *
 * This file is part of the Omnivalidator extension for Firefox.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 *
 * Based on information from:
 * http://footle.org/2007/07/31/binary-multipart-posts-in-javascript/
 * https://gist.github.com/1223431#file_multipart_binary_posts.js
 * https://github.com/igstan/ajax-file-upload/blob/master/simple/uploader.js
 */
/*jslint indent: 4, plusplus: true, unparam: true */
/*global define */

define(
    [
        "gecko/components/classes",
        "gecko/components/interfaces",
        "omnivalidator/moremath"
    ],
    function (Cc, Ci, moremath) {
        "use strict";

        function MultipartFormData() {
            // Invariant: dataParts consists of only objects and strings
            // Invariant: dataParts, headerParts, paramParts have equal length
            var boundary,
                dataParts = [],
                headerParts = [],
                paramParts = [];

            // Join adjacent strings in an array, ignore non-strings
            function joinAdjacentStrings(arr) {
                var end,
                    joined = [],
                    start = 0;

                while (start < arr.length) {
                    while (start < arr.length &&
                            typeof arr[start] !== "string") {
                        joined.push(arr[start]);
                        ++start;
                    }

                    end = start;
                    while (end < arr.length &&
                            typeof arr[end] === "string") {
                        ++end;
                    }

                    if (start < end - 1) {
                        joined.push(arr.slice(start, end).join(""));
                        start = end;
                    } else if (start < arr.length) {
                        joined.push(arr[start]);
                        ++start;
                    }
                }

                return joined;
            }

            /* Technique from
             * http://footle.org/2007/07/31/binary-multipart-posts-in-javascript/
             * https://gist.github.com/1223431#file_multipart_binary_posts.js
             */
            function multiplexInputs(inputs) {
                var i,
                    input,
                    mstream,
                    stream,
                    streams = [];

                for (i = 0; i < inputs.length; ++i) {
                    input = inputs[i];
                    if (typeof input === "string") {
                        stream = Cc["@mozilla.org/io/string-input-stream;1"]
                            .createInstance(Ci.nsIStringInputStream);
                        stream.setData(input, input.length);
                        streams.push(stream);
                    } else if (typeof input.QueryInterface === "function") {
                        streams.push(input.QueryInterface(Ci.nsIInputStream));
                    } else {
                        throw new Error("Object data does not have QueryInterface property");
                    }
                }

                mstream = Cc["@mozilla.org/io/multiplex-input-stream;1"]
                    .createInstance(Ci.nsIMultiplexInputStream);
                for (i = 0; i < streams.length; ++i) {
                    mstream.appendStream(streams[i]);
                }

                return mstream;
            }

            // Note:  Boundary can be anything unlikely to be in content
            //        Used leading "---" to make it clearly visible to users
            //        Randomize suffix rather than time to better support
            //        boundaries in nested multipart messages and make attacks
            //        harder.
            function generateBoundary() {
                var charCode,
                    charCodes = new Array(20),
                    i;

                for (i = 0; i < charCodes.length; ++i) {
                    // Generate code for character in [0-9A-Za-z]
                    charCode = moremath.randInt(0, 61);
                    if (charCode < 10) {
                        // Map 0-9 to "0"-"9"
                        charCode += "0".charCodeAt(0);
                    } else if (charCode < 36) {
                        // Map 10-35 to "A"-"Z"
                        charCode -= 10;
                        charCode += "A".charCodeAt(0);
                    } else {
                        // Map 36-61 to "a"-"z"
                        charCode -= 36;
                        charCode += "a".charCodeAt(0);
                    }

                    charCodes[i] = charCode;
                }

                return "-------------------multipart-boundary-" +
                    String.fromCharCode.apply(String, charCodes);
            }

            function encodeRFC2184(str) {
                var ind,
                    part,
                    parts = [],
                    split = 0;

                // encodeURIComponent gets everything except [-_.!~*'()]
                // [-_.!~] should be safe, but probably safer to encode
                str = encodeURIComponent(str).replace(/[\-_.!~*'()]/g,
                    function (c) {
                        return "%" + c.charCodeAt(0).toString(16);
                    });

                str = "utf-8''" + str;

                while (split < str.length) {
                    part = str.slice(split, 78);

                    // Careful not to split any extended octets
                    // If % is in last 2 characters, leave for next split
                    ind = part.slice(-2).indexOf("%");
                    if (ind >= 0) {
                        part = part.slice(0, -2 + ind);
                    }

                    parts.push(part);
                    split += part.length;
                }

                return parts;
            }

            function quoteString(str) {
                return '"' + str.replace(/["\\\r]/g, "\\$&") + '"';
            }

            function makeParam(name, val) {
                var i,
                    param,
                    parts;

                // According to RFC 2183 Section 2:
                // Long (> 78 characters) or non-ASCII must be RFC 2184-encoded
                // Values with spaces and/or tspecials
                // Short (<= 78 characters) values should be tokens
                // Short values with tspecials should be quoted strings
                // Others should be encoded as per RFC 2184
                //
                // However, all browsers appear to quote all parameter values
                // and send unencoded UTF-8 regardless of the value length.
                // So that's what we do here.
                /*
                if (val.length <= 78 && !/[^\u0000-\u007e]/.test(val)) {
                    if (/[\u0000-\u0020()<>@,;:\\"/[\]?=]/.test(val)) {
                        param = name + "=" + quoteString(val);
                    } else {
                        param = name + "=" + val;
                    }
                } else {
                    parts = encodeRFC2184(val);

                    param = name + "*1*=" + parts[0];
                    for (i = 1; i < parts.length; ++i) {
                        param += "\r\n" + name + "*" + (i + 1) + "*=" + parts[i];
                    }
                }
                */

                return name + "=" + quoteString(val);
            }

            function makeHeader(headerName, value, params) {
                var header = headerName,
                    param;

                header += ": ";
                header += String(value);

                if (params) {
                    for (param in params) {
                        if (params.hasOwnProperty(param)) {
                            header += "; " + makeParam(param, params[param]);
                        }
                    }

                }

                return header;
            }

            this.append = function (nameOrParams, value, headers) {
                if (typeof nameOrParams !== "object") {
                    nameOrParams = {name: String(nameOrParams)};
                }

                if (typeof value !== "object") {
                    value = String(value);
                }

                dataParts.push(value);
                headerParts.push(headers || {});
                paramParts.push(nameOrParams);
            };

            this.getBoundary = function () {
                if (!boundary) {
                    boundary = generateBoundary();
                }
                return boundary;
            };

            this.getEncoded = function () {
                var body = [],
                    headerName,
                    headerPart,
                    i;

                if (!boundary) {
                    boundary = generateBoundary();
                }

                for (i = 0; i < dataParts.length; ++i) {
                    body.push("--");
                    body.push(boundary);
                    body.push("\r\n");

                    body.push(makeHeader(
                        "Content-Disposition",
                        "form-data",
                        paramParts[i]
                    ));
                    body.push("\r\n");

                    headerPart = headerParts[i];
                    for (headerName in headerPart) {
                        if (headerPart.hasOwnProperty(headerName)) {
                            body.push(makeHeader(
                                headerName,
                                headerPart[headerName]
                            ));
                            body.push("\r\n");
                        }
                    }

                    body.push("\r\n");
                    body.push(dataParts[i]);
                    body.push("\r\n");
                }

                body.push("--");
                body.push(boundary);
                body.push("--\r\n");

                body = joinAdjacentStrings(body);
                if (body.length === 1) {
                    // Everything is a string, just return it as it is.
                    return body[0];
                }

                // At least one data part was a stream
                return multiplexInputs(body);
            };
        }

        return MultipartFormData;
    }
);

// vi: set sts=4 sw=4 et :
