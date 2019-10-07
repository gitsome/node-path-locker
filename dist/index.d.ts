interface IPathsKeyMap {
    [key: string]: boolean;
}
interface ITemplateVariables {
    [key: string]: number | string;
}
interface IPathLockerPaths {
    [key: string]: string;
}
declare class PathLocker {
    private registerdPathItems;
    pathKeyMap: IPathsKeyMap;
    private processPath;
    exists: (pathKey: string, ...allPathParts: string[]) => void;
    willExist: (pathKey: string, ...allPathParts: string[]) => void;
    create: (pathKey: string, ...allPathParts: string[]) => void;
    get: (templateVariables: ITemplateVariables) => IPathLockerPaths;
}
export = PathLocker;
