/* Misc utility functions for dealing with DOM manipulations
 *
 * This file is part of the Omnivalidator extension.
 * It is licensed under the terms of the MIT License.
 * The complete text of the license is available in the project documentation.
 *
 * Copyright 2012 Kevin Locke <kevin@kevinlocke.name>
 */
/*jslint indent: 4, plusplus: true, unparam: true */
/*global define */

define(
    [
        "dom/node"
    ],
    function (Node) {
        "use strict";

        // Same function as .textContent but only includes children instead of
        // all descendants
        function childTextContent(node) {
            var text = [];

            switch (node.nodeType) {
            case Node.TEXT_NODE:
            case Node.CDATA_SECTION_NODE:
            case Node.PROCESSING_INSTRUCTION_NODE:
            case Node.COMMENT_NODE:
                return node.nodeValue;

            case Node.DOCUMENT_NODE:
            case Node.DOCUMENT_TYPE_NODE:
            case Node.DOCUMENT_FRAGMENT_NODE:
                return null;
            }

            for (node = node.firstChild; node; node = node.nextSibling) {
                if (node.nodeType === Node.TEXT_NODE ||
                        node.nodeType === Node.CDATA_SECTION_NODE) {
                    text.push(node.nodeValue);
                }
            }

            return text.join("");
        }

        return {
            childTextContent: childTextContent
        };
    }
);

// vi: set sts=4 sw=4 et :
