/* Misc utility functions for dealing with URLs
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
        "gecko/components/classes",
        "gecko/components/interfaces"
    ],
    function (Cc, Ci) {
        "use strict";

        function getURL(url) {
            var uri;

            if (typeof url === "string") {
                uri = Cc["@mozilla.org/network/io-service;1"]
                      .getService(Ci.nsIIOService)
                      .newURI(url, null, null);
            } else {
                uri = url;
            }

            return uri.QueryInterface(Ci.nsIURL);
        }

        function getFilenameForURL(url) {
            return getURL(url).fileName;
        }

        return {
            getFilenameForURL: getFilenameForURL,
            getURL: getURL
        };
    }
);

// vi: set sts=4 sw=4 et :
