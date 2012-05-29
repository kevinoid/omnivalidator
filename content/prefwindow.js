/* Attach JavaScript functionality for the preferences window
 *
 * This file is part of the Omnivalidator extension for Firefox.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true, unparam: true */
/*global Components, document, gBrowser, window */

(function () {
    "use strict";

    // Map exports from the extension global namespace into this variable
    var omnivalidator = {};

    Components.utils["import"](
        "resource://omnivalidator/omnivalidator/global.jsm",
        omnivalidator
    );

    omnivalidator.require(
        [
            "gecko/components/classes",
            "gecko/components/interfaces",
            "log4moz",
            "omnivalidator/globaldefs",
            "omnivalidator/locale",
            "omnivalidator/prefavlistbox",
            "omnivalidator/preferences",
            "omnivalidator/validatorregistry",
            "omnivalidator/xulprefbranch",
            "omnivalidator/xulutils",
            "underscore"
        ],
        function (Cc, Ci, log4moz, globaldefs, locale, PrefAVListbox,
                Preferences, vregistry, XULPrefBranch, xulutils, underscore) {
            var logger = log4moz.repository.getLogger("omnivalidator.prefwindow"),
                autoValListbox,
                windowPrefs;

            function getPrompter() {
                if (Cc.hasOwnProperty("@mozilla.org/prompter;1")) {
                    // New (post-bug 563274) way to get prompter
                    return Cc["@mozilla.org/prompter;1"]
                        .getService(Ci.nsIPromptFactory)
                        .getPrompt(window, Ci.nsIPrompt);
                } else {
                    // Old (pre-bug 563274) way to get prompter
                    return Cc["@mozilla.org/embedcomp/window-watcher;1"]
                        .getService(Ci.nsIWindowWatcher)
                        .getNewPrompter(window);
                }
            }

            function isHostPublic(host) {
                if (!host) {
                    return false;
                }

                // Note:  We could use nsIDNSService to check if the
                // validator host is an RFC 1918 or 4193 address, but
                // the DNS checking can be very expensive (and we must run
                // it before returning) and the risk of unnecessary warnings
                // is high.  So, for now, we only warn about known public
                // hosts.  Re-evaluate if there are complaints of abuse.
                return host.slice(-6) === "w3.org" ||
                    host.slice(-12) === "validator.nu";
            }

            function hasAutoPublic() {
                var autoVIDs,
                    host,
                    i,
                    ioService,
                    url;

                function getValidatorURL(vid) {
                    return windowPrefs.getValue(
                        globaldefs.EXT_PREF_PREFIX + "validators." + vid +
                            ".args.validatorURL"
                    );
                }

                // Get validators which are performing automatic validation
                autoVIDs = underscore.keys(
                    autoValListbox.getAutoURLsByVID()
                );

                ioService = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService);
                for (i = 0; i < autoVIDs.length; ++i) {
                    url = getValidatorURL(autoVIDs[i]);

                    try {
                        host = ioService.newURI(url, null, null).host;
                        if (isHostPublic(host)) {
                            return true;
                        }
                    } catch (ex) {
                        logger.debug(
                            "Unable to parse validator URL to check if public",
                            ex
                        );
                    }
                }

                return false;
            }

            /** Confirm that automatic validation using a publicly hosted
             * validator is desired.
             */
            function confirmAutoPublic() {
                var btnPress,
                    dontWarn = {},
                    prompter;

                if (!Preferences.getValue(
                            globaldefs.EXT_PREF_PREFIX + "warnAutoPublic"
                        )) {
                    logger.debug(
                        "Not checking for automatic public validators, " +
                            "user has asked not to be warned."
                    );
                    return true;
                }

                if (hasAutoPublic()) {
                    prompter = getPrompter();

                    btnPress = prompter.confirmEx(
                        null,                                   // title
                        locale.get("prompt.confirmAutoPublic"),    // message
                        Ci.nsIPrompt.STD_OK_CANCEL_BUTTONS,     // flags
                        null,                                   // btn 0 lbl
                        null,                                   // btn 1 lbl
                        null,                                   // btn 2 lbl
                        locale.get("prompt.dontWarnAgain"),     // check msg
                        dontWarn                                // check state
                    );

                    if (dontWarn.value) {
                        Preferences.set(
                            globaldefs.EXT_PREF_PREFIX + "warnAutoPublic",
                            false
                        );
                    }

                    if (btnPress !== 0) {
                        // User has canceled
                        return false;
                    }
                }

                return true;
            }

            /** Confirm that the user is aware that not allowing validation of
             * uncached resources when caching is disabled is desired.
             */
            function confirmUncached() {
                var allowUncached,
                    browserCache,
                    btnPress,
                    dontWarn = {},
                    prefElem,
                    prompter;

                if (!Preferences.getValue(
                            globaldefs.EXT_PREF_PREFIX + "warnNoCache"
                        )) {
                    logger.debug(
                        "Not checking for disabled caching and cache " +
                            "checking, user has asked not to be warned."
                    );
                    return true;
                }

                prefElem =
                    document.getElementById("preference-allow-uncached");
                allowUncached = prefElem.value;
                if (allowUncached === undefined) {
                    allowUncached = prefElem.defaultValue;
                }

                browserCache =
                    Preferences.getValue("browser.cache.memory.enable") &&
                    Preferences.getValue("network.http.use-cache");

                if (!browserCache && !allowUncached) {
                    prompter = getPrompter();

                    btnPress = prompter.confirmEx(
                        null,                                   // title
                        locale.get("prompt.confirmNoCache"),    // message
                        Ci.nsIPrompt.STD_OK_CANCEL_BUTTONS,     // flags
                        null,                                   // btn 0 lbl
                        null,                                   // btn 1 lbl
                        null,                                   // btn 2 lbl
                        locale.get("prompt.dontWarnAgain"),     // check msg
                        dontWarn                                // check state
                    );

                    if (dontWarn.value) {
                        Preferences.set(
                            globaldefs.EXT_PREF_PREFIX + "warnNoCache",
                            false
                        );
                    }

                    if (btnPress !== 0) {
                        // User has canceled
                        return false;
                    }
                }

                return true;
            }

            // Check for any potential mis-configurations and confirm that
            // the user wants to leave the preferences in this state
            function confirmClose() {
                return confirmUncached() && confirmAutoPublic();
            }

            // Return a wrapper around the function which will catch and log
            // any exceptions
            // Used as workaround for bug 503244
            function logUncaught(fun) {
                return function () {
                    try {
                        fun.apply(this, arguments);
                    } catch (ex) {
                        logger.error("Uncaught exception", ex);
                    }
                };
            }

            function setupAutoAddButton(button) {
                button.addEventListener("click", function () {
                    var url,
                        valItem;

                    url = document.getElementById("auto-validate-url").value;
                    valItem =
                        document.getElementById("auto-validate-validator")
                            .selectedItem;

                    autoValListbox.add(url, valItem.value, valItem.label);
                    if (document.documentElement.instantApply) {
                        autoValListbox.save();
                    }
                }, false);
            }

            function setupAutoClearButton(button) {
                button.addEventListener(
                    "click",
                    function () {
                        autoValListbox.clear();
                        if (document.documentElement.instantApply) {
                            autoValListbox.save();
                        }
                    },
                    false
                );
            }

            function setupAutoRemoveButton(button) {
                var listbox;

                listbox = document.getElementById("auto-validate-listbox");

                // Disable/enable the button based on listbox selection
                listbox.addEventListener("select", function (evt) {
                    button.disabled = evt.target.selectedIndex === -1;
                }, false);
                button.disabled = listbox.selectedIndex === -1;

                button.addEventListener("click", function () {
                    autoValListbox.removeSelected();
                    if (document.documentElement.instantApply) {
                        autoValListbox.save();
                    }
                }, false);
            }

            function setupAutoValList(listbox) {
                autoValListbox = new PrefAVListbox(listbox);

                // Note: Saving for non-instantApply is setup in
                // setupCloseListeners
            }

            function setupCloseListeners() {
                var canClose = true,
                    firstCall = true,
                    onAcceptOrBefore;

                if (document.documentElement.instantApply) {
                    // On systems where accept is not needed, cancel will fire
                    // for both the close button and when the window is closed
                    // by the WM.  Accept (and beforeaccept) will never fire.
                    document.documentElement.addEventListener(
                        "dialogcancel",
                        logUncaught(function (evt) {
                            canClose = confirmClose();

                            if (!canClose) {
                                evt.preventDefault();
                            }
                            return canClose;
                        }),
                        false
                    );
                } else {
                    // Note: beforeaccept is triggered from dialogaccept
                    // So we can't guarantee whether our beforeaccept
                    // listener will be called before or after our dialogaccept
                    // listener.
                    // Also due to bug 474527 we can't prevent the window from
                    // closing in beforeaccept, so we must listen for
                    // dialogaccept as well

                    // FIXME:  This code assumes beforeaccept and dialogaccept
                    // are each called exactly once for each dialogaccept event.
                    // Is there a better way to detect event order and
                    // uniqueness?
                    onAcceptOrBefore = logUncaught(function (evt) {
                        if (firstCall) {
                            canClose = confirmClose();
                        }

                        firstCall = !firstCall;

                        if (canClose) {
                            autoValListbox.save();
                        } else {
                            evt.preventDefault();
                        }
                        return canClose;
                    });
                    document.documentElement.addEventListener(
                        "beforeaccept",
                        onAcceptOrBefore,
                        false
                    );
                    document.documentElement.addEventListener(
                        "dialogaccept",
                        onAcceptOrBefore,
                        false
                    );
                }
            }

            function fillValidatorList(listNode, validatorNames, tagName) {
                var oldValue;

                // Preserve the value, when possible
                oldValue = listNode.value;

                while (listNode.lastChild) {
                    listNode.removeChild(listNode.lastChild);
                }

                listNode.appendChild(
                    xulutils.listToXul(
                        validatorNames,
                        tagName,
                        document.createDocumentFragment(),
                        function (a, b) {
                            return validatorNames[a].localeCompare(validatorNames[b]);
                        }
                    )
                );

                listNode.value = oldValue;
            }

            function fillValidatorLists() {
                var autoValList,
                    validatorNames;

                validatorNames = vregistry.getNames(
                    windowPrefs.getBranch(
                        globaldefs.EXT_PREF_PREFIX + "validators."
                    )
                );

                // List on validators pane
                fillValidatorList(
                    document.getElementById("validators-list-listbox"),
                    validatorNames,
                    "listitem"
                );

                // List on automatic validation pane
                autoValList =
                    document.getElementById("auto-validate-validator");
                fillValidatorList(
                    autoValList.getElementsByTagNameNS(
                        globaldefs.XUL_NS,
                        "menupopup"
                    )[0],
                    validatorNames,
                    "menuitem"
                );
                if (autoValList.itemCount > 0) {
                    autoValList.selectedIndex = 0;
                }

                document.getElementById("validators-list-clear").disabled =
                    underscore.isEmpty(validatorNames);
            }

            function setupValAddButton(button) {
                button.addEventListener("click", function () {
                    document.documentElement.openSubDialog(
                        "chrome://omnivalidator/content/prefwindow-validator.xul",
                        "",
                        vregistry.getNewValidatorID()
                    );

                    fillValidatorLists();
                }, false);
            }

            function setupValClearButton(button) {
                button.addEventListener("click", function () {
                    // FIXME:  Overlap with vregistry.removeAll
                    windowPrefs.deleteBranch(
                        globaldefs.EXT_PREF_PREFIX + "validators."
                    );

                    fillValidatorLists();
                }, false);
            }

            function setupValEditButton(button) {
                var listbox;

                listbox = document.getElementById("validators-list-listbox");

                // Disable/enable the button based on listbox selection
                listbox.addEventListener("select", function (evt) {
                    button.disabled = evt.target.selectedIndex === -1;
                }, false);
                button.disabled = listbox.selectedIndex === -1;

                button.addEventListener("click", function () {
                    if (!listbox.selectedItem) {
                        logger.warn("Edit clicked without a validator selected");
                        return;
                    }

                    document.documentElement.openSubDialog(
                        "chrome://omnivalidator/content/prefwindow-validator.xul",
                        "",
                        listbox.selectedItem.value
                    );

                    fillValidatorLists();
                }, false);
            }

            function setupValRemoveButton(button) {
                var listbox;

                listbox = document.getElementById("validators-list-listbox");

                // Disable/enable the button based on listbox selection
                listbox.addEventListener("select", function (evt) {
                    button.disabled = evt.target.selectedIndex === -1;
                }, false);
                button.disabled = listbox.selectedIndex === -1;

                button.addEventListener("click", function () {
                    if (!listbox.selectedItem) {
                        logger.warn("Remove clicked without a validator selected");
                        return;
                    }

                    // FIXME:  Overlap with vregistry.remove(vid)
                    windowPrefs.deleteBranch(
                        globaldefs.EXT_PREF_PREFIX + "validators." +
                            listbox.selectedItem.value
                    );

                    fillValidatorLists();
                }, false);
            }

            document.addEventListener("DOMContentLoaded", function () {
                logger.trace("Prefwindow loaded");

                if (document.documentElement.instantApply) {
                    windowPrefs = Preferences;
                } else {
                    windowPrefs = new Preferences(
                        new XULPrefBranch(
                            document.getElementById("validator-preferences")
                        )
                    );
                }

                setupAutoAddButton(
                    document.getElementById("auto-validate-add")
                );

                setupAutoClearButton(
                    document.getElementById("auto-validate-clear")
                );

                setupAutoRemoveButton(
                    document.getElementById("auto-validate-remove")
                );

                setupAutoValList(
                    document.getElementById("auto-validate-listbox")
                );

                setupValAddButton(
                    document.getElementById("validators-list-add")
                );

                setupValClearButton(
                    document.getElementById("validators-list-clear")
                );

                setupValEditButton(
                    document.getElementById("validators-list-edit")
                );

                setupValRemoveButton(
                    document.getElementById("validators-list-remove")
                );

                fillValidatorLists();

                setupCloseListeners();

            }, false);
        }
    );
}());

// vi: set sts=4 sw=4 et :
