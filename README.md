# 🗄️ node-path-locker 🗄️
Utility for managing **source** and **build** paths in a NodeJS project.

Good use cases:
- Your build processes require dependable and flexible build path management
- Your build processes need to access or create environment dependent paths
- Your team is constantly refactoring where things are
- You like a single module that describes your SOURCE and BUILD paths
- You like it when your BUILD paths are created for you

It has the following benefits:

1. Provides a great place to store all your absolute paths
2. Validates paths that should exist in your source code
3. Validates and creates build paths
4. Paths can be `${templatized}` so you can modify paths based on ENV variables


## Usage

1. Install `node-path-locker`

```bash
yarn install node-path-locker
```

2. Setup a module that houses all your paths.
3. Import the `node-path-locker` module
4. Create a new `PathLocker` instance
5. Add all the paths you need
6. Export the `get` method on your `PathLocker` instance

```javascript
// getPaths.js

const PathLocker = require('node-path-locker');

const pathLocker = new PathLocker();

/*====== PATHS THAT EXIST IN THE SOURCE CODE  ======*/

// the last N parameters are combined using path.resolve
pathLocker.exists('PACKAGE_ONE', __dirname, '../../package-one');
pathLocker.exists('PACKAGE_TWO', __dirname, '../../package-two');
pathLocker.exists('SOURCE_FILES', '${PACKAGE_ONE}', 'src'));
pathLocker.exists('BUILD_DIRECTORY_ROOT', '${PACKAGE_TWO}');

/*====== SOURCE PATHS THAT DEPEND ON VARIABLES ======*/

// you can also pass in a single absolute url yourself using the path module
pathLocker.willExist('ENV_VARS_FILE', path.resolve(__dirname, '../../.env.${environment}'));

/*====== BUILD PATHS ======*/

// when another module calls the pathLocker.get method, these paths will be created recursively
pathLocker.create('BUILD_DIRECTORY_ONE', '${BUILD_DIRECTORY_ROOT}', 'build/lambdas', '${environment}');
pathLocker.create('BUILD_DIRECTORY_TWO', path.join('${BUILD_DIRECTORY_ROOT}', 'build/css'));

module.exports = pathLocker.get;
```

7. Import this module where ever it is needed

```javascript
// someOtherModule.js

const fs = require('fs-extra');

// some build script that needs environment variables stored in a file and a build path
const buildProject = require('../buildProject');

// pull in the getPaths module we created
const getPaths = require('../../getPaths.js');

const { ENV_VARS_FILE, BUILD_DIRECTORY_ONE } = getPaths({environment: 'dev'});

const envVars = JSON.parse(fs.readFileSync(ENV_VARS_FILE, 'utf8'));

buildProject(envVars, BUILD_DIRECTORY_ONE);
```

## Order Matters

PathLocker runs through the paths for validation and creation in the order you register them. You can interchange `exists`, `willExist`, `create` paths, but if they depend on each other, then dependent paths must go first.

## With or Without the `path` Module

PathLocker ultimately generates absolute paths so that no matter where you use them, the paths work without tweaks. PathLocker uses `path.resolve` under the hood to ensure all paths are absolute, but there is flexibility in how you deliver the path to the library.

Check out this example:

```javascript
const path = require('path');
const PathLocker = require('node-path-locker');
const pathLocker = new PathLocker();

pathLocker.exists('EXAMPLE_ONE', __dirname, 'example-one-directory');
pathLocker.exists('EXAMPLE_TWO', path.resolve(__dirname, 'example-two-directory'));
```
This example shows that you can avoid using the `path` library all together if you want. If PathLocker sees you have multiple path parameters, it will use `path.resolve` for you. A small but helpful simplification.

If you pass in a single path parameter as in EXAMPLE_TWO, PathLocker will use that as the absolute url.


## Automatic Path Validation & Creation

Every time you use the `PathLocker` `get` method, it will validate all paths. This means that when you move things around in your project, you'll know if a build related path is busted.

- Paths registered using the `exists` method should already exist in the source so PathLocker will throw an error if any of these paths do not exists.

- Paths registered using the `willExist` method will require all templateVariables to be resolved, but the file does not have to exist.

- Paths registered using the `create` method will automatically be created recursively... BUT, if the path uses a template variable that references a previously registered path, it will throw an error if that dependent path does not exist.

This means it's best to add the root build path where new build directories are created and reference it as a template variable while constructing the new build directory paths.

Here is an example:

```javascript
const PathLocker = require('node-path-locker');
const pathLocker = new PathLocker();

// register the BUILD_ROOT, this is where dynamic artifacts will be created
// NOTE: this path should already exist in the source code
pathLocker.exists('BUILD_ROOT', __dirname, 'package-one');

// register an environment variable file that will be created during our build process
// NOTE: this path is created later, so we use willExist
pathLocker.willExist('BUILD_ENV_FILE', '${BUILD_ROOT}/.env.{environment}');

// register a path to create. This path will not be created if 'BUILD_ROOT' doesn't exist
pathLocker.create('BUILD_ARTIFACTS', '${BUILD_ROOT}', 'build');

module.exports = pathLocker.get;
```

The `BUILD_ARTIFACTS` path will not be created and an error will be thrown if the `BUILD_ROOT` path does not exist.

## Variable Dependent Paths

In previous examples you have seen paths that depend on template variables like this one:

```javascript
pathLocker.exists('ENV_VARS_FILE', path.resolve(__dirname, '../../.env.${environment}'));
```

This path depends on a dynamic template variable `${environment}`. This path will not be generated if it is not supplied to the `pathLocker.get` method.

```javascript
// get called with no variables
const { ENV_VARS_FILE } = pathLocker.get();
```

In the example above, `ENV_VARS_FILE` will be `undefined` because not all of it's dependent template variables were provided.

This is great, because you can still access all paths that do not have dependencies on variables you don't have access to.