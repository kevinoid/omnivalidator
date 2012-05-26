/* Utility functions for dealing with Gecko errors
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
        "gecko/components/results"
    ],
    function (Cc, Ci, Cr) {
        "use strict";

        /*jslint bitwise: true */
        function nsErrorGetCode(err) { return err & 0xffff; }
        function nsErrorGetModule(err) { return ((err >> 16) - 0x45) & 0x1fff; }
        function nsErrorGetSeverity(err) { return (err >> 31) & 0x1; }
        /*jslint bitwise: false */

        function nsErrorGetLocaleMessage(err) {
            var errorService, stringBundle, stringBundleKey, stringBundleURI;

            // This does not work.  See
            // https://bugzilla.mozilla.org/show_bug.cgi?id=637307
            errorService = Cc["@mozilla.org/xpcom/error-service;1"]
                .getService(Ci.nsIErrorService);

            stringBundleURI = errorService.getErrorStringBundle(
                nsErrorGetModule(err)
            );

            stringBundleKey = errorService.getErrorStringBundleKey(
                nsErrorGetCode(err)
            );

            stringBundle = Cc["@mozilla.org/intl/stringbundle;1"]
                .getService(Ci.nsIStringBundleService)
                .createBundle(stringBundleURI);

            return stringBundle.GetStringFromName(stringBundleKey);
        }

        // Lots of overlap with XPCThrower::BuildAndThrowException
        function nsErrorToException(err) {
            var ex;

            ex = Cc["@mozilla.org/js/xpc/Exception;1"]
                .createInstance(Ci.nsIXPCException);
            ex.initialize(
                null,   // Non-localized message from xpc.msg found using
                        // nsXPCException::NameAndFormatForNSResult.
                        // Filled automatically for .toString, not .message
                        // Can construct, parse toString, reconstruct if needed
                err,    // nsresult
                null,   // name (from nsresult if null)
                null,   // location (from stack if null)
                null,   // data
                null    // inner
            );

            return ex;
        }

        function nsErrorGetMessage(err) {
            var ex;

            ex = nsErrorToException(err);

            // FIXME: This is such an ugly hack.
            return /^\[Exception... "(.*)"  nsresult: "0x[0-9a-fA-F]* \((.*)\)"  location: ".*"  data: .*\]$/.exec(ex.toString())[1];
        }

        return {
            nsErrorGetMessage: nsErrorGetMessage,
            nsErrorToException: nsErrorToException
        };
    }
);

// vi: set sts=4 sw=4 et :
