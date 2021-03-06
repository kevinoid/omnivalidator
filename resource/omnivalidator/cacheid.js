/* Define the CacheID class to uniquely identify a resource using its URI and
 * either its cacheKey or cacheToken.
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
        "gecko/components/interfaces",
        "log4moz"
    ],
    function (Ci, log4moz) {
        "use strict";

        var logger = log4moz.repository.getLogger("omnivalidator.cacheid");

        function CacheID(uri, cacheKey, cacheToken, postData, referrerURI) {
            this.uri = uri;
            this.cacheKey = cacheKey;
            this.cacheToken = cacheToken;
            this.postData = postData;
            this.referrerURI = referrerURI;
        }

        CacheID.prototype.equals = function (other) {
            if (!other ||
                    this.uri !== other.uri ||
                    (this.cacheKey && !other.cacheKey) ||
                    (!this.cacheKey && other.cacheKey) ||
                    (this.cacheToken && !other.cacheToken) ||
                    (!this.cacheToken && other.cacheToken) ||
                    (this.postData && !other.postData) ||
                    (!this.postData && other.postData) ||
                    (this.referrerURI && !other.referrerURI) ||
                    (!this.referrerURI && other.referrerURI)) {
                return false;
            }

            if (this.cacheKey && !this.cacheKey.equals(other.cacheKey)) {
                return false;
            }

            if (this.cacheToken && !this.cacheToken.equals(other.cacheToken)) {
                return false;
            }

            if (this.postData && !this.postData.equals(other.postData)) {
                return false;
            }

            if (this.referrerURI && !this.referrerURI.equals(other.referrerURI)) {
                return false;
            }

            return true;
        };

        CacheID.prototype.toString = function () {
            var cacheKey;

            if (this.cacheKey) {
                try {
                    cacheKey = this.cacheKey
                        .QueryInterface(Ci.nsISupportsCString)
                        .toString();
                } catch (ex) {
                    cacheKey = String(this.cacheKey);
                }
            } else if (this.cacheToken) {
                try {
                    cacheKey = this.cacheToken
                        .QueryInterface(Ci.nsICacheEntryInfo)
                        .key;
                } catch (ex2) {
                    cacheKey = String(this.cacheToken);
                }
            }

            return String(this.uri) +
                (cacheKey ? " (cacheKey: " + cacheKey + ")" : "");
        };

        CacheID.fromDocument = function (doc) {
            var docWin, pageDescriptor, shEntry;

            docWin = doc.defaultView;
            if (!docWin) {
                logger.error("getDocumentCacheKey:  document has no window");
                return null;
            }

            pageDescriptor = docWin
                .QueryInterface(Ci.nsIInterfaceRequestor)
                .getInterface(Ci.nsIWebNavigation)
                .QueryInterface(Ci.nsIWebPageDescriptor)
                .currentDescriptor;
            if (!pageDescriptor) {
                logger.error("getDocumentCacheKey:  window has no currentDescriptor");
                return null;
            }

            shEntry = pageDescriptor.QueryInterface(Ci.nsISHEntry);

            return new CacheID(
                doc.documentURI,
                shEntry.cacheKey,
                null,
                shEntry.postData,
                shEntry.referrerURI
            );
        };

        return CacheID;
    }
);

// vi: set sts=4 sw=4 et :
