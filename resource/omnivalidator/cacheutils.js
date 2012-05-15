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
        "omnivalidator/cacheid",
        "omnivalidator/globaldefs",
        "omnivalidator/preferences"
    ],
    function (Cc, Ci, log4moz, CacheID, globaldefs, Preferences) {
        "use strict";

        var logger = log4moz.repository.getLogger("omnivalidator.cacheutils"),
            observingRequests = false,
            requestObserver;

        requestObserver = {
            observe: function (subject, topic, data) {
                var channel, loadContext, loadFlags, reqWin;

                // Important:  This happens on every request, keep it fast!

                // Note:  If caching is made conditional or only enabled
                // for windows in which Omnivalidator is enabled, see
                // http://stackoverflow.com/questions/6484823/finding-the-tab-associated-with-a-dom-window/6489272#6489272
                // for one rather ugly way of finding the browser window

                try {
                    channel = subject.QueryInterface(Ci.nsIChannel);
                } catch (ex) {
                    // Not an nsIChannel, don't need to cache it
                    return;
                }

                // https://developer.mozilla.org/en/Updating_extensions_for_Firefox_3.5#Getting_a_load_context_from_a_request
                try {
                    loadContext = channel.notificationCallbacks
                        .getInterface(Ci.nsILoadContext);
                } catch (ex2) {
                    try {
                        loadContext = channel.loadGroup.notificationCallbacks
                            .getInterface(Ci.nsILoadContext);
                    } catch (ex3) {
                        // No loadContext associated with the request
                        return;
                    }
                }

                loadFlags = channel.loadFlags;
                /*jslint bitwise: true */
                if (!(loadFlags & Ci.nsIChannel.LOAD_DOCUMENT_URI)) {
                    // Not a document
                    /* Don't log in production for performance reasons
                    logger.debug("Request to " + channel.URI.spec + " (" +
                            loadFlags.toString(16) +
                            ") does not have LOAD_DOCUMENT_URI (" +
                            Ci.nsIChannel.LOAD_DOCUMENT_URI.toString(16) +
                            ") set");
                    */
                    return;
                }
                /*jslint bitwise: false */

                reqWin = loadContext.associatedWindow;
                if (!reqWin || reqWin !== reqWin.top) {
                    // Window is not the top window
                    /* Don't log in production for performance reasons
                    logger.debug(reqWin + " is not the top window for " + channel.URI.spec);
                    */
                    return;
                }

                // Remove the INHIBIT_CACHING flag
                // If INHIBIT_CACHING is set, replace it with
                // INHIBIT_PERSISTENT_CACHING since the only caching we need
                // is memory caching.
                /*jslint bitwise: true */
                if (loadFlags & Ci.nsIRequest.INHIBIT_CACHING) {
                    channel.loadFlags =
                        (loadFlags & ~Ci.nsIRequest.INHIBIT_CACHING)
                            | Ci.nsIRequest.INHIBIT_PERSISTENT_CACHING;
                    /* Don't log in production for performance reasons
                    logger.trace("Removed INHIBIT_CACHING flag on request to " +
                        channel.URI.spec);
                    */
                } else {
                    // INHIBIT_CACHING not present
                    /* Don't log in production for performance reasons
                    logger.error("Request to " + channel.URI.spec + " (" +
                            loadFlags.toString(16) +
                            ") does not have INHIBIT_CACHING (" +
                            Ci.nsIRequest.INHIBIT_CACHING.toString(16) +
                            ") set");
                    */
                }
                /*jslint bitwise: false */
            }
        };

        /* Note:  This function is not currently used, as I have not found a
         * case where INHIBIT_CACHING is set on a request we care about.
         * If such a case is discovered, it may be called from global.js
         * as part of the extension setup.
         */
        function deinhibitCaching(deinhibit) {
            var observerService;

            logger.debug((deinhibit ? "Deinhibiting" : "Not deinhibiting") +
                " in-memory caching of document requests for top-level windows");

            observerService = Cc["@mozilla.org/observer-service;1"]
                .getService(Ci.nsIObserverService);

            if (arguments.length === 0 || deinhibit) {
                if (!observingRequests) {
                    logger.debug("Adding request observer to deinhibit " +
                        "in-memory caching of document requests for top-level windows");
                    observerService.addObserver(
                        requestObserver,
                        "http-on-modify-request",
                        false
                    );
                    observingRequests = true;
                }
            } else {
                if (observingRequests) {
                    logger.debug("Removing request observer which will " +
                        "allow requests with inhibited-caching.");
                    observerService.removeObserver(
                        requestObserver,
                        "http-on-modify-request",
                        false
                    );
                    observingRequests = false;
                }
            }
        }

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

            logger.trace("Getting channel for " + cacheid);

            ios = Cc["@mozilla.org/network/io-service;1"]
                .getService(Ci.nsIIOService);

            channel = ios.newChannel(cacheid.uri, null, null);
            /*jslint bitwise: true */
            channel.loadFlags |= Ci.nsIRequest.VALIDATE_NEVER;
            channel.loadFlags |= Ci.nsIRequest.LOAD_FROM_CACHE;
            if (!Preferences.getValue(globaldefs.EXT_PREF_PREFIX + "allowUncached")) {
                channel.loadFlags |= Ci.nsICachingChannel.LOAD_ONLY_FROM_CACHE;
            }
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
            deinhibitCaching: deinhibitCaching,
            getChannel: getChannel,
            getDocumentCacheKey: getDocumentCacheKey,
            getDocumentChannel: getDocumentChannel
        };
    }
);

// vi: set sts=4 sw=4 et :
