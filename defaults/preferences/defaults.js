/*jslint indent: 4 */
/*global pref: true */

// Automatic validation preferences
pref("extensions.omnivalidator.autoValidate", "[]");

// Validator preferences
pref("extensions.omnivalidator.validators.v7625.args.validatorURL",
        "http://localhost:8888");
pref("extensions.omnivalidator.validators.v7625.type", "omnivalidator/validatornu");
pref("extensions.omnivalidator.validators.v7625.name", "Validator.nu");
pref("extensions.omnivalidator.validators.v8812.args.validatorURL",
        "http://localhost/w3c-markup-validator/check");
pref("extensions.omnivalidator.validators.v8812.type", "omnivalidator/w3cmarkup");
pref("extensions.omnivalidator.validators.v8812.name", "W3C Markup Validator");

// Diagnostic logging preferences
pref("extensions.omnivalidator.log.consoleLevel", 50);
pref("extensions.omnivalidator.log.fileLevel", 20);

// vi: set sts=4 sw=4 et :
