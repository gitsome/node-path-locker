"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const TEMPLATE_VARIABLE_REGEX = /\$\{([^}]+)\}/g;
const getTemplateVariablesFromString = (pathPartsToScan) => {
    const output = [];
    pathPartsToScan.forEach((pathPart) => {
        let matches = [];
        while (matches) {
            matches = TEMPLATE_VARIABLE_REGEX.exec(pathPart);
            if (matches) {
                output.push(matches[1].trim());
            }
        }
    });
    return output;
};
const pathItemHasRequiredTemplateVariables = (pathItem, templateVariables, validatedPaths) => {
    return pathItem.templateVariableKeys.reduce((stringHasAllTemplateVariables, templateVariable) => {
        return stringHasAllTemplateVariables && ((templateVariables[templateVariable] !== undefined) || (validatedPaths[templateVariable] !== undefined));
    }, true);
};
// templateVariable replacement
const fillTemplate = (templateString, templateVars) => {
    return templateString.replace(TEMPLATE_VARIABLE_REGEX, (substring, ...matchList) => {
        return templateVars[matchList[0]] + '';
    });
};
const validatePathExists = (pathString, pathKey) => {
    if (!fs_extra_1.default.existsSync(pathString)) {
        throw new Error(`node-path-locker.pathDoesNotExistError: pathKey: ${pathKey} path: ${pathString}`);
    }
};
const ensurePathExists = (pathString, pathKey) => {
    try {
        fs_extra_1.default.ensureDirSync(pathString);
    }
    catch (err) {
        throw new Error(`node-path-locker.pathCouldNotBeCreated: pathKey: ${pathKey} path: ${pathString}`);
    }
};
class PathLocker {
    constructor() {
        this.registerdPathItems = [];
        this.pathKeyMap = {};
        this.processPath = (pathItemType, pathKey, allPathParts) => {
            this.pathKeyMap[pathKey] = true;
            this.registerdPathItems.push({
                pathKey: pathKey,
                type: pathItemType,
                pathParts: allPathParts,
                templateVariableKeys: getTemplateVariablesFromString(allPathParts)
            });
        };
        this.exists = (pathKey, ...allPathParts) => {
            this.processPath('exists', pathKey, allPathParts);
        };
        this.willExist = (pathKey, ...allPathParts) => {
            this.processPath('willExist', pathKey, allPathParts);
        };
        this.create = (pathKey, ...allPathParts) => {
            this.processPath('create', pathKey, allPathParts);
        };
        this.get = (templateVariables) => {
            templateVariables = templateVariables || {};
            // fail if any template variables match the pathKeyMap
            Object.keys(templateVariables).forEach((templateVariableKey) => {
                if (this.pathKeyMap[templateVariableKey]) {
                    throw new Error(`node-path-locker.invalidTemplateVariableProvided: ${templateVariableKey} It collides with a registered path key.`);
                }
            });
            const validatedPaths = {};
            // now run through all the paths
            this.registerdPathItems.forEach((pathItem) => {
                // NOTE: this step will ensure that any 'create' paths will fail if a dependent path item has already failed because it won't exist in validatedPaths
                // This helps keep the user's file system clean by not creating paths if a dependent path fails.
                if (pathItemHasRequiredTemplateVariables(pathItem, templateVariables, validatedPaths)) {
                    const filledPathParts = pathItem.pathParts.map((pathPart) => {
                        // pass in provided templateVariables as well as paths already generated and validated
                        return fillTemplate(pathPart, Object.assign({}, templateVariables, validatedPaths));
                    });
                    // fill in any template variable replacements with the provided variables and current list of validated paths
                    const finalPath = path_1.default.resolve(...filledPathParts);
                    // some paths need validation that they already exist or are created immediately
                    if (pathItem.type === 'exists') {
                        validatePathExists(finalPath, pathItem.pathKey);
                    }
                    else if (pathItem.type === 'create') {
                        ensurePathExists(finalPath, pathItem.pathKey);
                    }
                    // everything is looking good so add it to the validated paths
                    validatedPaths[pathItem.pathKey] = finalPath;
                }
            });
            return validatedPaths;
        };
    }
}
module.exports = PathLocker;
