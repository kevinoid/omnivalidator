/* Global variables and initialization for the extension
 *
 * This file is part of the Omnivalidator extension.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint es5: true, indent: 4, plusplus: true, unparam: true */
/*global Components, JSON, define, require */

var EXPORTED_SYMBOLS = ["requirejs", "require", "define"];

/**
 * @param {Object} global Reference to the global scope (Used as the target
 * object for the exports from this file).
 */
(function (global) {
    "use strict";

    var baseURL = "resource://omnivalidator",
        // Reference to the global scope
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
            EXT_VERSION: "0.1.0",
            // Note:  Avoid .log extension as type not always displayed inline
            // in the browser
            LOG_FILE_NAME: "omnivalidator-log.txt",
            XHTML_NS: "http://www.w3.org/1999/xhtml",
            XUL_NS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
        },
        logError,
        logInfo,
        moduleImport,
        moduleLoad,
        scriptLoader =
            Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                .getService(Components.interfaces.mozIJSSubScriptLoader),
        systemPrincipal = Components.classes["@mozilla.org/systemprincipal;1"]
            .createInstance(Components.interfaces.nsIPrincipal);

    // Extend the target object with properties from the source objects
    // FIXME:  Overlap with underscore.extend, but can't require that here
    function extend(target) {
        var i, prop, source;

        for (i = 1; i < arguments.length; ++i) {
            source = arguments[i];
            for (prop in source) {
                if (source.hasOwnProperty(prop)) {
                    target[prop] = source[prop];
                }
            }
        }

        return target;
    }

    // Extend the target object with given properties from the source object
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

    /** Error logging function usable before logging framework is loaded.
     *
     * Note: This function is replaced when the logging framework is loaded.
     */
    logError = function (message, error) {
        // Note:  Should match the console formatter defined below
        Components.utils.reportError(
            globaldefs.EXT_NAME + " (ERROR): " + message +
                (error ? ":\n" + error : "")
        );
    };

    /** Information logging function usable before logging framework is loaded.
     *
     * Note: This function is replaced when the logging framework is loaded.
     */
    logInfo = function (message, error) {
        // Note:  Should match the console formatter defined below
        Components.classes["@mozilla.org/consoleservice;1"]
            .getService(Components.interfaces.nsIConsoleService)
            .logStringMessage(
                globaldefs.EXT_NAME + " (INFO): " + message +
                    (error ? ":\n" + error : "")
            );
    };

    function makeSandbox(name, addToSandbox) {
        var prop, sandbox;

        sandbox = Components.utils.Sandbox(
            systemPrincipal,
            {
                sandboxName: globaldefs.EXT_NAME + " " + name,
                wantXrays: false
            }
        );

        if (addToSandbox) {
            for (prop in addToSandbox) {
                if (addToSandbox.hasOwnProperty(prop)) {
                    sandbox[prop] = addToSandbox[prop];
                }
            }
        }

        return sandbox;
    }

    /** Behaves like Components.utils.import, with two important differences:
     * It does not cache the import (so it is run each time it is imported).
     * It runs the import in the provided scope, rather than importing from
     * its own scope.
     *
     * This is useful for importing into sandboxes, which can not be
     * accomplished with Components.utils.import.
     *
     * @param {String} url URL of the JSM file to import
     * @param {Object} scope The object to use as the global scope object for
     * the script being executed.  Defaults to the global object of the caller.
     * @param {Object} targetObj The object into which the exported symbols of
     * the JSM should be imported.  Default import nothing.
     */
    function sandboxImport(url, scope, targetObj) {
        var exported, i;

        // Default scope is the global object
        scope = scope || global;

        scriptLoader.loadSubScript(url, scope);

        if (targetObj) {
            exported = scope.EXPORTED_SYMBOLS;
            for (i = 0; i < exported.length; ++i) {
                targetObj[exported[i]] = scope[exported[i]];
            }
        }
    }

    function moduleImportMemDebug(name, url) {
        var sandbox, target = {};

        sandbox = makeSandbox(name);
        sandboxImport(url, sandbox, target);

        return target;
    }

    function moduleImportNoDebug(name, url) {
        var target = {};

        Components.utils["import"](url, target);

        return target;
    }

    function moduleLoadMemDebug(name, url, scopeImports) {
        var sandbox;

        sandbox = makeSandbox(name, scopeImports);
        scriptLoader.loadSubScript(url, sandbox);

        return sandbox;
    }

    function moduleLoadNoDebug(name, url, scopeImports) {
        var target = {};

        extend(target, scopeImports);
        scriptLoader.loadSubScript(url, target);

        return target;
    }

    // Set the method to import/load modules based on requested memory debugging
    if (Components.classes["@mozilla.org/preferences-service;1"]
                .getService(Components.interfaces.nsIPrefBranch)
                .getIntPref(globaldefs.EXT_PREF_PREFIX + "debugMemory") >= 2) {
        moduleImport = moduleImportMemDebug;
        moduleLoad = moduleLoadMemDebug;
    } else {
        moduleImport = moduleImportNoDebug;
        moduleLoad = moduleLoadNoDebug;
    }

    // Import require, requirejs, and define into the current global namespace
    extend(
        global,
        moduleLoad("requirejs", "resource://omnivalidator/require.js")
    );

    // Override the load function to use mozIJSSubScriptLoader
    require.load = function (context, moduleName, url) {

        try {
            moduleLoad(moduleName, url, {define: define});
        } catch (ex) {
            logError("Failed to load requested module " + url, ex);
            // FIXME: Should call hasPathFallback and (internal) onError as
            // onScriptError does, but don't have access to them...
        }

        context.completeLoad(moduleName);
    };

    require.config({
        baseUrl:    baseURL,
        paths: {
            "omnivalidator/platform": "omnivalidator/xulrunner"
        }
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
    function defineFile(moduleLoader, moduleName, moduleURL, moduleImports,
            scopeImports, optional) {
        define(moduleName, function () {
            var module;
            moduleURL = moduleURL || baseURL + "/" + moduleName + ".js";

            try {
                module = moduleLoader(moduleName, moduleURL, scopeImports);
            } catch (ex) {
                // Note:  Logging framework not always initialized at this point
                if (optional) {
                    logInfo(
                        "Failed to load optional module " + moduleURL +
                            " for " + moduleName,
                        ex
                    );
                } else {
                    logError(
                        "Failed to load module " + moduleURL +
                            " for " + moduleName,
                        ex
                    );
                }

                return undefined;
            }

            if (moduleImports) {
                module = extendProperties({}, module, moduleImports);
            }

            return unwrapSingleProp(module);
        });
    }

    function defineJSM(/*args*/) {
        // TODO:  Replace with Function.bind when only supporting ES5
        var args = Array.prototype.slice.call(arguments, 0);
        args.unshift(moduleImport);
        return defineFile.apply(null, args);
    }

    /** Define a JSM which is likely to be used outside of this extension.
     *
     * If the module is likely to be used outside of this extension, there
     * is no need to prevent caching and global code sharing of the JSM in
     * order to load it into a compartment and count its memory with this
     * extension.  Always load it using Cu.import.
     */
    function defineJSMShared(/*args*/) {
        // TODO:  Replace with Function.bind when only supporting ES5
        var args = Array.prototype.slice.call(arguments, 0);
        args.unshift(moduleImportNoDebug);
        return defineFile.apply(null, args);
    }

    function definePlain(/*args*/) {
        // TODO:  Replace with Function.bind when only supporting ES5
        var args = Array.prototype.slice.call(arguments, 0);
        args.unshift(moduleLoad);
        return defineFile.apply(null, args);
    }

    // Provide access to JSON through RequireJS
    if (typeof JSON === "undefined") {
        // Should only happen in Gecko 1.9
        defineJSMShared("json", "resource://gre/modules/JSON.jsm");
    } else {
        define("json", JSON);
    }

    defineJSMShared(
        "addonmanager",
        "resource://gre/modules/AddonManager.jsm",
        [ "AddonManager" ],
        null,
        true
    );
    definePlain("log4moz", null, [ "Log4Moz" ]);
    defineJSMShared("pluralform", "resource://gre/modules/PluralForm.jsm");

    definePlain(
        "underscore",
        null,
        [ "_" ],
        // Some underscore functions rely on setTimeout
        // So we implement it using nsITimer
        (function () {
            // Note:  Must hold reference to nsITimer to prevent GC
            var timers = [];

            function removeTimer(timer) {
                var ind = timers.indexOf(timer);
                if (ind !== -1) {
                    timers.splice(ind, 1);
                }
            }

            return {
                clearTimeout: function (timer) {
                    timer.cancel();
                    removeTimer(timer);
                },

                setTimeout: function (code, delay) {
                    var timer = Components.classes["@mozilla.org/timer;1"]
                        .createInstance(Components.interfaces.nsITimer);
                    timer.init({
                        QueryInterface: function (aIID) {
                            if (aIID.equals(Components.interfaces.nsIObserver) ||
                                    aIID.equals(Components.interfaces.nsISupports)) {
                                return this;
                            }
                            throw Components.results.NS_NOINTERFACE;
                        },

                        observe: function (subject, topic, data) {
                            removeTimer(timer);
                            code();
                        }
                    }, delay, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
                    timers.push(timer);
                    return timer;
                }
            };
        }())
    );
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
                extProfDir,
                fileAppender,
                fileFormatter,
                logFile,
                rootBranch,
                rootLogger = log4moz.repository.rootLogger;

            consoleFormatter = {
                format: function (msg) {
                    return globaldefs.EXT_NAME + " (" + msg.levelDesc + "): " +
                        msg.message +
                        (msg.error ? ":\n" + msg.error : "");
                }
            };
            consoleAppender = new log4moz.ConsoleAppender(consoleFormatter);
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

                rootLogger.addAppender(fileAppender);
            } catch (ex) {
                rootLogger.error("Unable to open log file", ex);
            }

            function setLogLevel(branch) {
                var consoleLevel, fileLevel;

                try {
                    branch = branch.QueryInterface(Ci.nsIPrefBranch2);
                } catch (ex) {
                    rootLogger.warn("Unable to change log level", ex);
                    return;
                }

                consoleLevel = branch.getIntPref(
                    globaldefs.EXT_PREF_PREFIX + "log.consoleLevel"
                );
                consoleAppender.level = consoleLevel;

                fileLevel = branch.getIntPref(
                    globaldefs.EXT_PREF_PREFIX + "log.fileLevel"
                );
                if (fileAppender) {
                    fileAppender.level = fileLevel;
                }

                rootLogger.level = Math.min(consoleLevel, fileLevel);

                rootLogger.debug("Set log level." +
                    " consoleLevel: " + consoleLevel +
                    " fileLevel: " + fileLevel);
            }

            rootBranch = Cc["@mozilla.org/preferences-service;1"]
                .getService(Ci.nsIPrefBranch2);
            setLogLevel(rootBranch);
            rootBranch.addObserver(
                globaldefs.EXT_PREF_PREFIX + "log.consoleLevel",
                { observe: setLogLevel },
                false
            );
            rootBranch.addObserver(
                globaldefs.EXT_PREF_PREFIX + "log.fileLevel",
                { observe: setLogLevel },
                false
            );

            if (logFile) {
                rootLogger.debug("Logging messages to " + logFile.path);
            }

            rootLogger.trace("Logging setup complete");

            // Replace the global stub logging functions
            // TODO:  Replace with Function.bind when only supporting ES5
            logError =
                function () { rootLogger.error.apply(rootLogger, arguments); };
            logInfo =
                function () { rootLogger.info.apply(rootLogger, arguments); };
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
}(this));

// vi: set sts=4 sw=4 et ft=javascript :
