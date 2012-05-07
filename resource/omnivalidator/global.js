/* Global variables and initialization for the extension
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
        globaldefs = {
            CSS_PREFIX: "omnivalidator-",
            EXT_ID: "omnivalidator@kevinlocke.name",
            // Should match em:name in install.rdf
            EXT_NAME: "Omnivalidator",
            EXT_PREF_PREFIX: "extensions.omnivalidator.",
            EXT_PROF_DIR: "omnivalidator",
            // Should match em:version in install.rdf
            // Note:  Could read it from install.rdf, rather than defining it
            // here, but only async, which introduces issues.
            EXT_VERSION: "0.1",
            // Note:  Avoid .log extension as type not always displayed inline
            // in the browser
            LOG_FILE_NAME: "omnivalidator-log.txt",
            XHTML_NS: "http://www.w3.org/1999/xhtml",
            XUL_NS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
        },
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
            // Note:  Logging framework not always initialized at this point
            Components.utils.reportError(globaldefs.EXT_NAME +
                    ": Failed to load requested module " + url + "\n" + ex);
        }

        context.completeLoad(moduleName);
    };

    require.config({
        baseUrl:    baseURL
    });

    // Shared global definitions
    define("omnivalidator/globaldefs", globaldefs);

    // Provide access to DOM globals through RequireJS
    // FIXME:  How are these set in the window context?  Is this the best way?
    define("dom/node", Components.interfaces.nsIDOMNode);
    define("dom/xpathresult", Components.interfaces.nsIDOMXPathResult);

    // Provide access to Gecko globals through RequireJS
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

    // Extend the target object with properties from the source object
    // FIXME:  Overlap with underscore.extend, but can't require that here
    function extendProperties(target, source, props) {
        var i, prop;

        for (i = 0; i < props.length; ++i) {
            prop = props[i];
            if (source.hasOwnProperty(prop)) {
                target[prop] = source[prop];
            }
        }

        return target;
    }

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

    // Provide a RequireJS definition for non-AMD files
    function defineFile(loadFile, moduleName, moduleURL, props, namespace,
            optional) {
        define(moduleName, function () {
            moduleURL = moduleURL || baseURL + "/" + moduleName + ".js";
            namespace = namespace || {};

            // Run the script in its own namespace namespace
            try {
                loadFile(moduleURL, namespace);
            } catch (ex) {
                // Note:  Logging framework not always initialized at this point
                if (optional) {
                    Components.classes["@mozilla.org/consoleservice;1"]
                        .getService(Components.interfaces.nsIConsoleService)
                        .logStringMessage(globaldefs.EXT_NAME + ": " +
                            "Failed to load optional module " + moduleURL +
                            " for " + moduleName + "\n" +
                            ex);
                } else {
                    Components.utils.reportError(globaldefs.EXT_NAME + ": " +
                        "Failed to load module " + moduleURL +
                        " for " + moduleName + "\n" +
                        ex);
                }
            }

            if (props) {
                namespace = extendProperties({}, namespace, props);
            }

            return unwrapSingleProp(namespace);
        });
    }

    function defineJSM(/*args*/) {
        // TODO:  Replace with Function.bind when only supporting FF 4+
        var args = Array.prototype.slice.call(arguments, 0);
        args.unshift(Components.utils["import"]);
        return defineFile.apply(null, args);
    }

    function definePlain(/*args*/) {
        // TODO:  Replace with Function.bind when only supporting FF 4+
        var args = Array.prototype.slice.call(arguments, 0);
        args.unshift(scriptLoader.loadSubScript);
        return defineFile.apply(null, args);
    }

    defineJSM(
        "addonmanager",
        "resource://gre/modules/AddonManager.jsm",
        [ "AddonManager" ],
        null,
        true
    );
    defineJSM("log4moz", baseURL + "/log4moz.jsm");
    defineJSM("pluralform", "resource://gre/modules/PluralForm.jsm");
    definePlain("underscore");
    definePlain(
        "chrome/global/contentareautils",
        "chrome://global/content/contentAreaUtils.js",
        null,
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
            var consoleAppender,
                consoleFormatter,
                consoleLevel,
                extProfDir,
                fileAppender,
                fileFormatter,
                fileLevel,
                logFile,
                prefs,
                rootLogger;

            prefs = Cc["@mozilla.org/preferences-service;1"]
                .getService(Ci.nsIPrefService)
                .getBranch(globaldefs.EXT_PREF_PREFIX);

            rootLogger = log4moz.repository.rootLogger;
            consoleLevel = prefs.getIntPref("log.consoleLevel");
            fileLevel = prefs.getIntPref("log.fileLevel");
            rootLogger.level = Math.max(consoleLevel, fileLevel);

            consoleFormatter = {
                format: function (msg) {
                    return globaldefs.EXT_NAME + " (" + msg.levelDesc + "): " +
                        msg.message +
                        (msg.error ? ":\n" + msg.error : "");
                }
            };
            consoleAppender = new log4moz.ConsoleAppender(consoleFormatter);
            consoleAppender.level = consoleLevel;
            rootLogger.addAppender(consoleAppender);

            try {
                extProfDir = Cc["@mozilla.org/file/directory_service;1"]
                    .getService(Ci.nsIProperties)
                    .get("ProfD", Ci.nsIFile);
                extProfDir.append(globaldefs.EXT_PROF_DIR);

                if (!extProfDir.exists() || !extProfDir.isDirectory()) {
                    extProfDir.create(
                        Ci.nsIFile.DIRECTORY_TYPE,
                        // Note:  Octal literals forbidden in strict mode
                        parseInt("0774", 8)
                    );
                }

                logFile = extProfDir.clone();
                logFile.append(globaldefs.LOG_FILE_NAME);
                if (logFile.exists()) {
                    logFile.remove(true);
                }

                fileFormatter = new log4moz.BasicFormatter();
                fileAppender = new log4moz.FileAppender(logFile, fileFormatter);
                // Send a test message to confirm file stream works
                fileAppender.doAppend(globaldefs.EXT_NAME + " Log\n");

                rootLogger.debug("Logging messages to " + logFile.path);
                rootLogger.addAppender(fileAppender);
            } catch (ex) {
                rootLogger.error("Unable to open log file", ex);
            }

            rootLogger.trace("Logging setup complete");
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
