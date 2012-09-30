/*jslint indent: 4 */
/*global pref: true */

// Allow fetching content for resources which were not cached
pref("extensions.omnivalidator.allowUncached", false);

// Memory debugging (compartment) granularity
pref("extensions.omnivalidator.debugMemory", 0);

// Diagnostic logging preferences
pref("extensions.omnivalidator.log.consoleLevel", 50);
pref("extensions.omnivalidator.log.fileLevel", 40);

// Prompt warning preferences
pref("extensions.omnivalidator.warnAutoPublic", true);
pref("extensions.omnivalidator.warnNoCache", true);

// vi: set sts=4 sw=4 et :
