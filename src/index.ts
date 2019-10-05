import fs from 'fs-extra';
import path from 'path';

type PathItemType = 'add' | 'create';

export interface IProcessPathItem {
  pathKey: string;
  type: PathItemType;
  value: string;
  templateVariableKeys: string[];
}

export interface IPathsMap {
  [key: string]: string;
}

export interface IPathsKeyMap {
  [key: string]: boolean;
}

export interface ITemplateVariables {
  [key: string]: number | string;
}

export interface IPathLockerPaths {
  [key: string]: string;
}

const TEMPLATE_VARIABLE_REGEX = /\$\{([^}]+)\}/g;
const getTemplateVariablesFromString = (stringToScan: string): string[] => {
  const output = [];
  let matches: any[] | null = [];
  while (matches) {
    matches = TEMPLATE_VARIABLE_REGEX.exec(stringToScan);
    if (matches) {
      output.push(matches[1].trim());
    }
  }
  return output;
};

const pathItemHasRequiredTemplateVariables = (pathItem: IProcessPathItem, templateVariables: ITemplateVariables, validatedPaths: IPathLockerPaths): boolean => {

  return pathItem.templateVariableKeys.reduce((stringHasAllTemplateVariables: boolean, templateVariable: string) => {
    return stringHasAllTemplateVariables && ((templateVariables[templateVariable] !== undefined) || (validatedPaths[templateVariable] !== undefined));
  }, true);
};

// nice function that does template variable replacement
const fillTemplate = (templateString: string, templateVars: ITemplateVariables): string => {
  return new Function('return `'+templateString +'`;').call(templateVars);
};

const validatePathExists = (pathString: string) => {
  if (!fs.existsSync(pathString)) {
    throw new Error(`node-path-locker.pathDoesNotExistError: ${pathString}`);
  }
};

const ensurePathExists = (pathString: string) => {
  try {
    fs.ensureDirSync(pathString);
  } catch (err) {
    throw new Error(`node-path-locker.pathCouldNotBeCreated: ${pathString}`);
  }
};

export default class PathLocker {

  private addAndCreateList: IProcessPathItem[] = [];

  public pathKeyMap: IPathsKeyMap = {};

  private resolvePath = (pathString: string, allOthers: string[]): string => {
    // if they pass in multiple strings, assume they want us to resolve it
    // this pattern allows them not to have to use the path module if they don't want to
    if (allOthers !== undefined) {
      return path.resolve(pathString, ...allOthers);
    }
    // otherwise it's already a resolved path so just return it
    return pathString;
  };

  private processPath = (pathItemType: PathItemType, pathKey: string, pathString: string, allOthers: string[]) => {

    const rawPath = this.resolvePath(pathString, allOthers);

    this.pathKeyMap[pathKey] = true;

    this.addAndCreateList.push({
      pathKey: pathKey,
      type: pathItemType,
      value: rawPath,
      templateVariableKeys: getTemplateVariablesFromString(rawPath)
    });
  };

  public add = (pathKey: string, pathString: string, ...allOthers: string[]) => {
    this.processPath('add', pathKey, pathString, allOthers);
  };

  public create = (pathKey: string, pathString: string, ...allOthers: string[]) => {
    this.processPath('create', pathKey, pathString, allOthers);
  };

  public get = (templateVariables: ITemplateVariables): IPathLockerPaths => {

    // TODO fail if any template variables match the pathKeyMap
    Object.keys(templateVariables).forEach((templateVariableKey) => {
      if (this.pathKeyMap[templateVariableKey]) {
        throw new Error(`node-path-locker.invalidTemplateVariableProvided: ${templateVariableKey} It collides with a registered path key.`);
      }
    });

    const validatedPaths: IPathLockerPaths = {};

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
        } else if (pathItem.type === 'create') {
          ensurePathExists(finalPath);
        }
      }
    });

    return validatedPaths;
  };
}