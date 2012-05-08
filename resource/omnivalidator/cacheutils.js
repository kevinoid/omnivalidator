/* Utility functions for dealing with Firefox caches
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
        "gecko/components/interfaces",
        "log4moz",
        "omnivalidator/cacheid"
    ],
    function (Cc, Ci, log4moz, CacheID) {
        "use strict";

        var logger = log4moz.repository.getLogger("omnivalidator.cacheutils");

        function getDocumentCacheKey(doc) {
            var docWin, pageDescriptor;

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

            return pageDescriptor.QueryInterface(Ci.nsISHEntry).cacheKey;
        }

        function getChannel(cacheid) {
            var cacheChannel, channel, ios;

            ios = Cc["@mozilla.org/network/io-service;1"]
                .getService(Ci.nsIIOService);

            channel = ios.newChannel(cacheid.uri, null, null);
            /*jslint bitwise: true */
            channel.loadFlags |= Ci.nsIRequest.VALIDATE_NEVER;
            channel.loadFlags |= Ci.nsIRequest.LOAD_FROM_CACHE;
            channel.loadFlags |= Ci.nsICachingChannel.LOAD_ONLY_FROM_CACHE;
            /*jslint bitwise: false */

            try {
                cacheChannel = channel.QueryInterface(Ci.nsICachingChannel);
                if (cacheid.cacheToken) {
                    cacheChannel.cacheToken = cacheid.cacheToken;
                } else if (cacheid.cacheKey) {
                    cacheChannel.cacheKey = cacheid.cacheKey;
                }
            } catch (ex) {
                throw new Error("Unable to retrieve resource:  Protocol does not support caching");
            }

            return channel;
        }

        function getDocumentChannel(doc) {
            return getChannel(CacheID.fromDocument(doc));
        }

        return {
            getChannel: getChannel,
            getDocumentCacheKey: getDocumentCacheKey,
            getDocumentChannel: getDocumentChannel
        };
    }
);

// vi: set sts=4 sw=4 et :
