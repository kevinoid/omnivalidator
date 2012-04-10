/* Global variables and initialization for Omnivalidator
 *
 * This file is part of the Omnivalidator extension for Firefox.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint es5: true, indent: 4, plusplus: true */
/*global Components, JSON, define, require */

var EXPORTED_SYMBOLS = ["requirejs", "require", "define"];

(function () {
    "use strict";

    var baseURL = "resource://omnivalidator",
        scriptLoader =
            Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                .getService(Components.interfaces.mozIJSSubScriptLoader);

    // Defines require, requirejs, and define in current global namespace
    scriptLoader.loadSubScript("resource://omnivalidator/require.js");

    // Override the attach function to use mozIJSSubScriptLoader
    require.attach = function (url, context, moduleName, callback, type, fetchOnlyFunction) {

        try {
            scriptLoader.loadSubScript(url);
        } catch (ex) {
            // Add additional logging to print the failed URL
            // Note:  Logging framework not always initialized at this point
            Components.utils.reportError("Failed to load requested module " + url + "\n" + ex);
            throw ex;
        }

        context.completeLoad(moduleName);
    };

    require.config({
        baseUrl:    baseURL
    });

    // Shared global definitions
    define("omnivalidator/globaldefs", {
        CSS_PREFIX: "omnivalidator-",
        EXT_PREF_PREFIX: "extensions.omnivalidator",
        VERSION: "0.1",
        XHTML_NS: "http://www.w3.org/1999/xhtml",
        XUL_NS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
    });

    // Provide access to global objects through RequireJS
    define("gecko/components/classes", Components.classes);
    define("gecko/components/interfaces", Components.interfaces);
    define("gecko/components/results", Components.results);
    define("gecko/components/utils", Components.utils);

    // Provide access to JSON through RequireJS
    if (typeof JSON === "undefined") {
        // Should only happen in Gecko 1.9
        Components.utils["import"]("resource://gre/modules/JSON.jsm");
    }
    define("json", JSON);

    // If object contains only one property, return the value of that property
    // Otherwise return the object
    function unwrapSingleProp(obj) {
        var firstprop,
            prop,
            propcount = 0;

        // Check if the module has 0, 1, or 2+ properties
        for (prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                ++propcount;
                if (propcount === 1) {
                    firstprop = prop;
                } else {
                    break;
                }
            }
        }

        if (propcount === 1) {
            return obj[firstprop];
        } else {
            return obj;
        }
    }

    // Provide RequireJS wrappers for JavaScript Modules (JSMs)
    function defineJSM(moduleName, moduleURL) {
        define(moduleName, function () {
            var module = {};

            moduleURL = moduleURL || baseURL + "/" + moduleName + ".jsm";

            Components.utils["import"](moduleURL, module);

            return unwrapSingleProp(module);
        });
    }

    // Provide RequireJS wrappers for non-AMD files
    function definePlain(moduleName, moduleURL, namespace) {
        define(moduleName, function () {
            moduleURL = moduleURL || baseURL + "/" + moduleName + ".js";
            namespace = namespace || {};

            // Run the script in its own module namespace
            scriptLoader.loadSubScript(moduleURL, namespace);

            return unwrapSingleProp(namespace);
        });
    }

    defineJSM("log4moz");
    defineJSM("pluralform", "resource://gre/modules/PluralForm.jsm");
    definePlain("underscore");
    definePlain(
        "chrome/global/contentareautils",
        "chrome://global/content/contentAreaUtils.js",
        // Note:  contentAreaUtils uses navigator.appVersion
        // FIXME:  Is there a better way to get a navigator (or appVersion)?
        {
            navigator:
                Components.classes["@mozilla.org/appshell/window-mediator;1"]
                    .getService(Components.interfaces.nsIWindowMediator)
                    .getMostRecentWindow(null)
                    .navigator
        }
    );
    definePlain(
        "chrome/global/viewsourceutils",
        "chrome://global/content/viewSourceUtils.js"
    );

    // Initialize the logging framework
    // Note:  Avoid depending on preferences to allow the preferences module
    //        to use the logging module without creating a circular dependency
    require(
        [
            "gecko/components/classes",
            "gecko/components/interfaces",
            "log4moz",
            "omnivalidator/globaldefs"
        ],
        function (Cc, Ci, log4moz, globaldefs) {
            var appender, formatter, logLevel, prefs, rootLogger;

            prefs = Cc["@mozilla.org/preferences-service;1"]
                .getService(Ci.nsIPrefService)
                .getBranch(globaldefs.EXT_PREF_PREFIX + ".");

            rootLogger = log4moz.repository.rootLogger;
            logLevel = prefs.getIntPref("logLevel");
            rootLogger.level = logLevel;

            formatter = {
                format: function (msg) {
                    return "Omnivalidator (" + msg.levelDesc + "): " +
                        msg.message +
                        (msg.error ? ":\n" + msg.error : "");
                }
            };
            appender = new log4moz.ConsoleAppender(formatter);
            appender.level = logLevel;
            rootLogger.addAppender(appender);
        }
    );

    // Run the version checking upgrade/downgrade stuff
    require(
        [
            "omnivalidator/versionchange"
        ],
        function (versionchange) {
            versionchange.checkForVersionChange();
        }
    );
}());

// vi: set sts=4 sw=4 et ft=javascript :
