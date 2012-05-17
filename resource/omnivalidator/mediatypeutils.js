/* Utilities for dealing with media types (MIME types)
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
        "gecko/components/interfaces",
        "log4moz",
        "omnivalidator/cacheutils"
    ],
    function (Ci, log4moz, cacheutils) {
        "use strict";

        var logger = log4moz.repository.getLogger("omnivalidator.mediatypeutils");

        function getContentTypeFromChannel(channel) {
            var contentCharset,
                contentType = null,
                httpChannel;

            try {
                httpChannel = channel.QueryInterface(Ci.nsIHttpChannel);

                contentType = httpChannel.getResponseHeader("Content-Type");
            } catch (ex) {
                try {
                    channel = channel.QueryInterface(Ci.nsIChannel);
                    contentType = channel.contentType;
                    // Does not include any media type parameters
                    // Reconstruct charset parameter, where applicable
                    // Note:  contentCharset is null when not applicable
                    contentCharset = channel.contentCharset;
                    if (contentCharset) {
                        contentType += "; charset=" + contentCharset;
                    }
                } catch (ex2) {
                    // Not HTTP or no Content-Type header
                    logger.debug("Unable to get Content-Type from stream", ex2);
                }
            }

            return contentType;
        }

        // Get the Content-Type from the cached channel
        // FIXME:  This is inefficient.  There must be a better way to do this.
        // Note:  Can't get from channel using async open until data is
        // returned (which is too late for our purposes)
        function getContentType(resourceid) {
            var channel, stream;

            channel = cacheutils.getChannel(resourceid);
            if (channel) {
                stream = channel.open();
                try {
                    return getContentTypeFromChannel(channel);
                } finally {
                    stream.close();
                }
            } else {
                logger.debug("Unable to get cached channel for " +
                        resourceid.uri);
            }

            return null;
        }

        return {
            getContentType: getContentType,
            getContentTypeFromChannel: getContentTypeFromChannel
        };
    }
);

// vi: set sts=4 sw=4 et :
