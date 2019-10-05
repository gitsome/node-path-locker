"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const TEMPLATE_VARIABLE_REGEX = /\$\{([^}]+)\}/g;
const getTemplateVariablesFromString = (stringToScan) => {
    const output = [];
    let matches = [];
    while (matches) {
        matches = TEMPLATE_VARIABLE_REGEX.exec(stringToScan);
        if (matches) {
            output.push(matches[1].trim());
        }
    }
    return output;
};
const pathItemHasRequiredTemplateVariables = (pathItem, templateVariables, validatedPaths) => {
    return pathItem.templateVariableKeys.reduce((stringHasAllTemplateVariables, templateVariable) => {
        return stringHasAllTemplateVariables && ((templateVariables[templateVariable] !== undefined) || (validatedPaths[templateVariable] !== undefined));
    }, true);
};
// nice function that does template variable replacement
const fillTemplate = (templateString, templateVars) => {
    return new Function('return `' + templateString + '`;').call(templateVars);
};
const validatePathExists = (pathString) => {
    if (!fs_extra_1.default.existsSync(pathString)) {
        throw new Error(`node-path-locker.pathDoesNotExistError: ${pathString}`);
    }
};
const ensurePathExists = (pathString) => {
    try {
        fs_extra_1.default.ensureDirSync(pathString);
    }
    catch (err) {
        throw new Error(`node-path-locker.pathCouldNotBeCreated: ${pathString}`);
    }
};
class PathLocker {
    constructor() {
        this.addAndCreateList = [];
        this.pathKeyMap = {};
        this.resolvePath = (pathString, allOthers) => {
            // if they pass in multiple strings, assume they want us to resolve it
            // this pattern allows them not to have to use the path module if they don't want to
            if (allOthers !== undefined) {
                return path_1.default.resolve(pathString, ...allOthers);
            }
            // otherwise it's already a resolved path so just return it
            return pathString;
        };
        this.processPath = (pathItemType, pathKey, pathString, allOthers) => {
            const rawPath = this.resolvePath(pathString, allOthers);
            this.pathKeyMap[pathKey] = true;
            this.addAndCreateList.push({
                pathKey: pathKey,
                type: pathItemType,
                value: rawPath,
                templateVariableKeys: getTemplateVariablesFromString(rawPath)
            });
        };
        this.add = (pathKey, pathString, ...allOthers) => {
            this.processPath('add', pathKey, pathString, allOthers);
        };
        this.create = (pathKey, pathString, ...allOthers) => {
            this.processPath('create', pathKey, pathString, allOthers);
        };
        this.get = (templateVariables) => {
            // TODO fail if any template variables match the pathKeyMap
            Object.keys(templateVariables).forEach((templateVariableKey) => {
                if (this.pathKeyMap[templateVariableKey]) {
                    throw new Error(`node-path-locker.invalidTemplateVariableProvided: ${templateVariableKey} It collides with a registered path key.`);
                }
            });
            const validatedPaths = {};
            // now run through all the paths
            this.addAndCreateList.forEach((pathItem) => {
                // NOTE: this step will ensure that any 'create' paths will fail if a dependent path item has already failed because it won't exist in validatedPaths
                // This helps keep the user's file system clean by not creating paths if a dependent path fails.
                // TODO: So the documentation should encourage the use of dependent base paths for paths that will be created.
                if (pathItemHasRequiredTemplateVariables(pathItem, templateVariables, validatedPaths)) {
                    // fill in any template variable replacements with the provided variables and current list of validated paths
                    const finalPath = fillTemplate(pathItem.value, Object.assign({}, templateVariables, validatedPaths));
                    if (pathItem.type === 'add') {
                        validatePathExists(finalPath);
                    }
                    else if (pathItem.type === 'create') {
                        ensurePathExists(finalPath);
                    }
                }
            });
            return validatedPaths;
        };
    }
}
exports.default = PathLocker;
