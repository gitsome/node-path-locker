import fs from 'fs-extra';
import path from 'path';

type PathItemType = 'add' | 'create';

interface IProcessPathItem {
  pathKey: string;
  type: PathItemType;
  value: string;
  templateVariableKeys: string[];
}

interface IPathsMap {
  [key: string]: string;
}

interface IPathsKeyMap {
  [key: string]: boolean;
}

interface ITemplateVariables {
  [key: string]: number | string;
}

interface IPathLockerPaths {
  [key: string]: string;
}

const TEMPLATE_VARIABLE_REGEX = /\$\{([^}]+)\}/g;

const resolvePath = (pathString: string, allOthers: string[]): string => {
  // if they pass in multiple strings, assume they want us to resolve it
  // this pattern allows them not to have to use the path module if they don't want to
  if (allOthers.length) {
    return path.resolve(pathString, ...allOthers);
  }
  // otherwise it's already a resolved path so just return it
  return pathString;
};

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

// templateVariable replacement
const fillTemplate = (templateString: string, templateVars: ITemplateVariables): string => {
  return templateString.replace(TEMPLATE_VARIABLE_REGEX, (substring: string, ...matchList: any[]): string => {
    return templateVars[matchList[0]] + '';
  });
};

const validatePathExists = (pathString: string, pathKey: string) => {
  if (!fs.existsSync(pathString)) {
    throw new Error(`node-path-locker.pathDoesNotExistError: pathKey: ${pathKey} path: ${pathString}`);
  }
};

const ensurePathExists = (pathString: string, pathKey: string) => {
  try {
    fs.ensureDirSync(pathString);
  } catch (err) {
    throw new Error(`node-path-locker.pathCouldNotBeCreated: pathKey: ${pathKey} path: ${pathString}`);
  }
};

class PathLocker {

  private addAndCreateList: IProcessPathItem[] = [];

  public pathKeyMap: IPathsKeyMap = {};

  private processPath = (pathItemType: PathItemType, pathKey: string, pathString: string, allOthers: string[]) => {

    const rawPath = resolvePath(pathString, allOthers);

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

    templateVariables = templateVariables || {};

    // fail if any template variables match the pathKeyMap
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
      if (pathItemHasRequiredTemplateVariables(pathItem, templateVariables, validatedPaths)) {

        // fill in any template variable replacements with the provided variables and current list of validated paths
        const finalPath = fillTemplate(pathItem.value, Object.assign({}, templateVariables, validatedPaths));

        if (pathItem.type === 'add') {
          validatePathExists(finalPath, pathItem.pathKey);
        } else if (pathItem.type === 'create') {
          ensurePathExists(finalPath, pathItem.pathKey);
        }

        // everything is looking good so add it to the validated paths
        validatedPaths[pathItem.pathKey] = finalPath;
      }
    });

    return validatedPaths;
  };
}

export = PathLocker;