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
    private addAndCreateList;
    pathKeyMap: IPathsKeyMap;
    private processPath;
    add: (pathKey: string, ...allPathParts: string[]) => void;
    create: (pathKey: string, ...allPathParts: string[]) => void;
    get: (templateVariables: ITemplateVariables) => IPathLockerPaths;
}
export = PathLocker;
