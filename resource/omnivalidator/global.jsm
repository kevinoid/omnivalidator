/** Stub for the shared global scope of this extension.
 *
 * This file must always be loaded using Components.utils.import, and is
 * necessary in order to create a scope shared across browser windows (using
 * Cu.import).  It will load the script to define the contents of the global
 * scope (possibly in a sandbox/compartment - which can not currently be done
 * with Cu.import).
 *
 * This file is part of the Omnivalidator extension.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true */
/*global Components */

// Note:  EXPORTED_SYMBOLS and any other globals are loaded from global.js

/**
 * @param {Object} global Reference to the global scope (Used as the target
 * object for the exports from this file).
 */
(function (global) {
    "use strict";

    var globalScriptURL = "resource://omnivalidator/omnivalidator/global.js",
        scriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
            .getService(Components.interfaces.mozIJSSubScriptLoader);

    function loadInSandbox(url) {
        var prop,
            sandbox,
            systemPrincipal = Components.classes["@mozilla.org/systemprincipal;1"]
                .createInstance(Components.interfaces.nsIPrincipal);

        sandbox = Components.utils.Sandbox(
            systemPrincipal,
            {
                sandboxName: "Omnivalidator Extension",
                wantXrays: false
            }
        );
        scriptLoader.loadSubScript(url, sandbox);

        // Copy variables from sandbox into this scope
        for (prop in sandbox) {
            if (sandbox.hasOwnProperty(prop)) {
                global[prop] = sandbox[prop];
            }
        }
    }

    if (Components.classes["@mozilla.org/preferences-service;1"]
                .getService(Components.interfaces.nsIPrefBranch)
                .getIntPref("extensions.omnivalidator.debugMemory") > 0) {
        loadInSandbox(globalScriptURL);
    } else {
        scriptLoader.loadSubScript(globalScriptURL);
    }
}(this));

// vi: set sts=4 sw=4 et ft=javascript :
