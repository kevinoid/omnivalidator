/*jslint indent: 4 */
/*global pref: true */

// Automatic validation preferences
pref("extensions.omnivalidator.autoValidate", "[]");

// Validator preferences
pref("extensions.omnivalidator.validators.0.args.validatorURL",
        "http://localhost:8888");
pref("extensions.omnivalidator.validators.0.auto", false);
pref("extensions.omnivalidator.validators.0.click", true);
pref("extensions.omnivalidator.validators.0.module", "omnivalidator/validatornu");
pref("extensions.omnivalidator.validators.0.name", "Validator.nu");
pref("extensions.omnivalidator.validators.1.args.validatorURL",
        "http://localhost/w3c-markup-validator/check");
pref("extensions.omnivalidator.validators.1.auto", false);
pref("extensions.omnivalidator.validators.1.click", true);
pref("extensions.omnivalidator.validators.1.module", "omnivalidator/w3cmarkup");
pref("extensions.omnivalidator.validators.1.name", "W3C Markup Validator");

// Diagnostic logging preferences
pref("extensions.omnivalidator.log.consoleLevel", 50);
pref("extensions.omnivalidator.log.fileLevel", 20);

// vi: set sts=4 sw=4 et :
