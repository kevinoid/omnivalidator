/* Utility functions for dealing with Firefox caches
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
        "gecko/components/classes",
        "gecko/components/interfaces",
        "gecko/components/results",
        "log4moz",
        "omnivalidator/cacheid",
        "omnivalidator/globaldefs",
        "omnivalidator/locale",
        "omnivalidator/nserrorutils",
        "omnivalidator/preferences",
        "underscore"
    ],
    function (Cc, Ci, Cr, log4moz, CacheID, globaldefs, locale, nserrorutils,
            Preferences, underscore) {
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

        /* Since we can only detect failure once nsIStreamListener.onStopRequest
         * is called, we need to buffer calls to the caller's nsIStreamListener
         * and only forward calls once we have success.
         */
        function streamListenOrFail(streamListener, onFail) {
            var startArgs;

            return {
                QueryInterface: function (aIID) {
                    if (aIID.equals(Ci.nsIStreamListener) ||
                            aIID.equals(Ci.nsIRequestObserver) ||
                            aIID.equals(Ci.nsISupports)) {
                        return this;
                    }
                    throw Cr.NS_NOINTERFACE;
                },

                onDataAvailable: function (request, context, stream, offset, count) {
                    // Data received
                    // Forward startRequest, this, and all subsequent callbacks
                    if (startArgs) {
                        streamListener.onStartRequest.apply(
                            streamListener,
                            startArgs
                        );
                    }
                    streamListener.onDataAvailable.apply(
                        streamListener,
                        arguments
                    );
                    this.onDataAvailable = underscore.bind(
                        streamListener.onDataAvailable,
                        streamListener
                    );
                    this.onStartRequest = underscore.bind(
                        streamListener.onStartRequest,
                        streamListener
                    );
                    this.onStopRequest = underscore.bind(
                        streamListener.onStopRequest,
                        streamListener
                    );
                },

                onStartRequest: function (request, context) {
                    // Do not forward until we know stream is viable
                    startArgs = arguments;
                },

                onStopRequest: function (request, context, statusCode) {
                    if (statusCode === 0) {
                        // Stream with no data was successfully read
                        if (startArgs) {
                            streamListener.onStartRequest.apply(
                                streamListener,
                                startArgs
                            );
                        }
                        streamListener.onStopRequest.apply(
                            streamListener,
                            arguments
                        );
                    } else if (onFail) {
                        // Reading the stream failed, don't forward any calls
                        // Signal the caller that stream reading has failed
                        onFail(nserrorutils.nsErrorToException(statusCode));
                    }
                }
            };
        }

        // Almost exact duplicate of nsDocShell::ConfirmRepost, but with
        // slightly different prompt text
        function confirmRepost() {
            var appStrBundle, btnPress, promptMsg, prompter, resendStr;

            if (Cc.hasOwnProperty("@mozilla.org/prompter;1")) {
                // New (post-bug 563274) way to get prompter
                prompter = Cc["@mozilla.org/prompter;1"]
                    .getService(Ci.nsIPromptFactory)
                    .getPrompt(null, Ci.nsIPrompt);
            } else {
                // Old (pre-bug 563274) way to get prompter
                prompter = Cc["@mozilla.org/network/default-prompt;1"]
                    .getService(Ci.nsIPrompt);
            }

            promptMsg = locale.get("prompt.confirmRepost");

            appStrBundle = Cc["@mozilla.org/intl/stringbundle;1"]
                .getService(Ci.nsIStringBundleService)
                .createBundle("chrome://global/locale/appstrings.properties");
            resendStr = appStrBundle.GetStringFromName("resendButton.label");

            btnPress = prompter.confirmEx(
                null,       // title
                promptMsg,  // message
                (Ci.nsIPrompt.BUTTON_POS_0 * Ci.nsIPrompt.BUTTON_TITLE_IS_STRING) +
                    (Ci.nsIPrompt.BUTTON_POS_1 * Ci.nsIPrompt.BUTTON_TITLE_CANCEL),
                resendStr,  // button 0 title
                null,       // button 1 title
                null,       // button 2 title
                null,       // check message
                {}          // check state
            );

            return btnPress === 0;
        }

        function setReferrer(channel, cacheid) {
            var httpChannel;

            if (cacheid.referrerURI) {
                try {
                    httpChannel = channel.QueryInterface(Ci.nsIHttpChannel);
                    httpChannel.referrer = cacheid.referrerURI;
                } catch (ex) {
                    logger.debug("Unable to set referrer on request", ex);
                    return false;
                }
            }

            return true;
        }

        function openUncachedResourceAsync(cacheid, streamListener, context) {
            var channel,
                seekableStream,
                uploadChannel;

            logger.trace("Getting uncached resource for " + cacheid);

            channel = Cc["@mozilla.org/network/io-service;1"]
                .getService(Ci.nsIIOService)
                .newChannel(cacheid.uri, null, null);

            /*jslint bitwise: true */
            channel.loadFlags |=
                Ci.nsICachingChannel.LOAD_BYPASS_LOCAL_CACHE;
            /*jslint bitwise: false */

            // FIXME:  Is there any point in setting cacheKey/cacheToken when
            // bypassing the local cache?

            // Set the referrer, we want the request to be as close as
            // possible to the original
            setReferrer(channel, cacheid);

            if (cacheid.postData) {
                if (!confirmRepost()) {
                    logger.info("Loading of " + cacheid + " aborted by user");
                    // Force the load to fail by preventing network I/O
                    /*jslint bitwise: true */
                    channel.loadFlags |=
                        Ci.nsICachingChannel.LOAD_NO_NETWORK_IO;
                    /*jslint bitwise: false */
                }

                // Try to reset the post data stream, in case it is being used
                // multiple times
                try {
                    seekableStream =
                        cacheid.postData.QueryInterface(Ci.nsISeekableStream);
                    seekableStream.seek(Ci.nsISeekableStream.NS_SEEK_SET, 0);
                } catch (ex3) {
                    logger.debug("Unable to rewind POST data stream", ex3);
                }

                try {
                    uploadChannel =
                        channel.QueryInterface(Ci.nsIUploadChannel);
                    uploadChannel.setUploadStream(
                        cacheid.postData,
                        "",
                        -1
                    );
                } catch (ex2) {
                    logger.warn("Unable to set post data on channel, " +
                        "forcing load to fail",
                        ex2);
                    // Force the load to fail by preventing network I/O
                    /*jslint bitwise: true */
                    channel.loadFlags |=
                        Ci.nsICachingChannel.LOAD_NO_NETWORK_IO;
                    /*jslint bitwise: false */
                }
            }

            channel.asyncOpen(streamListener, context);
        }

        function openResourceAsync(cacheid, streamListener, context) {
            var allowUncached,
                cacheCanMiss,
                cacheChannel,
                cacheKeyInt,
                channel;

            allowUncached = Preferences.getValue(
                globaldefs.EXT_PREF_PREFIX + "allowUncached"
            );

            // If we are getting a resource which is identified by a
            // cacheKey or cacheToken, we can't allow the resource to be
            // fetched if the cache misses, since it would fetch the resource
            // using only the URI (e.g. ignoring any POST data).
            // We don't want to set the POST data without warning the
            // user, and we don't want to warn the user unless we need
            // to send the POST data, so for resources identified by
            // more than just the URI, the first try must load from
            // the cache or fail.
            try {
                // Note: For nsHttpChannel cacheKeys wrapping 0 are safe to
                // miss in the cache (0 == no POST data)
                cacheKeyInt = cacheid.cacheKey
                    .QueryInterface(Ci.nsISupportsPRUint32).data;
            } catch (ex2) {}
            cacheCanMiss = !(cacheid.cacheToken || cacheKeyInt);

            logger.trace("Getting resource for " + cacheid);

            channel = Cc["@mozilla.org/network/io-service;1"]
                .getService(Ci.nsIIOService)
                .newChannel(cacheid.uri, null, null);

            /*jslint bitwise: true */
            // On the first attempt, try to load from the cache, if possible
            channel.loadFlags |= Ci.nsIRequest.VALIDATE_NEVER;
            channel.loadFlags |= Ci.nsIRequest.LOAD_FROM_CACHE;

            if (!allowUncached || !cacheCanMiss) {
                channel.loadFlags |=
                    Ci.nsICachingChannel.LOAD_ONLY_FROM_CACHE;
            }

            if (cacheid.cacheKey || cacheid.cacheToken) {
                // Set the cache information on the channel
                try {
                    cacheChannel =
                        channel.QueryInterface(Ci.nsICachingChannel);
                    if (cacheid.cacheKey) {
                        cacheChannel.cacheKey = cacheid.cacheKey;
                    }
                    if (cacheid.cacheToken) {
                        cacheChannel.cacheToken = cacheid.cacheToken;
                    }
                } catch (ex) {
                    logger.debug(
                        "Unable to set caching information on channel",
                        ex
                    );
                    if (allowUncached && cacheid.postData) {
                        // If we must cache or POST, abandon and try POSTing
                        openUncachedResourceAsync(
                            cacheid,
                            streamListener,
                            context
                        );
                        return;
                    } else if (!cacheCanMiss) {
                        // We must hit the cache, but we can't set all of the
                        // caching information... force the load to fail
                        channel.loadFlags =
                            Ci.nsICachingChannel.LOAD_NO_NETWORK_IO |
                            Ci.nsICachingChannel.LOAD_BYPASS_LOCAL_CACHE;
                    }
                }
            }

            // Set the referrer for the case we miss the cache, we want the
            // request to be as close as possible to the original
            setReferrer(channel, cacheid);

            if (allowUncached && cacheid.postData) {
                // If uncached responses are allowed and we have POST data,
                // catch load failures and retry with the POST data
                channel.asyncOpen(
                    streamListenOrFail(
                        streamListener,
                        function (error) {
                            logger.debug("Attempt to retrieve " + cacheid +
                                " from cache failed.  Retrying without cache.",
                                error);
                            openUncachedResourceAsync(
                                cacheid,
                                streamListener,
                                context
                            );
                        }
                    ),
                    context
                );
            } else {
                channel.asyncOpen(streamListener, context);
            }
        }

        return {
            deinhibitCaching: deinhibitCaching,
            openResourceAsync: openResourceAsync
        };
    }
);

// vi: set sts=4 sw=4 et :
