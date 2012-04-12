/* Utility functions for dealing with Addon information
 * Note:  This is mostly papering over 3.5/4.0 differences, can remove when
 * dropping support for pre-4.0.
 *
 * This file is part of the Omnivalidator extension for Firefox.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true */
/*global define */

define(
    [
        "gecko/components/classes",
        "gecko/components/interfaces",
        "addonmanager",
        "log4moz"
    ],
    function (Cc, Ci, AddonManager, log4moz) {
        "use strict";

        var logger = log4moz.repository.getLogger("omnivalidator.addonutils");

        function getAddonByID3(addonid, callbackGABI) {
            callbackGABI(
                Cc["@mozilla.org/extensions/manager;1"]
                    .getService(Ci.nsIExtensionManager)
                    .getItemForID(addonid)
            );
        }

        function getAddonByID4(addonid, callbackGABI) {
            return AddonManager.getAddonByID(addonid, callbackGABI);
        }

        function getResourceURI3(addon, resource) {
            var file;

            file = Cc["@mozilla.org/extensions/manager;1"]
                .getService(Ci.nsIExtensionManager)
                .getInstallLocation(addon.id)
                .getItemFile(addon.id, resource);

            return Cc["@mozilla.org/network/io-service;1"]
                .getService(Ci.nsIIOService)
                .newFileURI(file);
        }

        function getResourceURI4(addon, resource) {
            return addon.getResourceURI(resource);
        }

        if (AddonManager) {
            return {
                getAddonByID: getAddonByID4,
                getResourceURI: getResourceURI4
            };
        } else {
            return {
                getAddonByID: getAddonByID3,
                getResourceURI: getResourceURI3
            };
        }
    }
);

// vi: set sts=4 sw=4 et :
