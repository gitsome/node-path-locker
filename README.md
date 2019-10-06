# 🗄️ node-path-locker 🗄️
Utility for centralizing paths in a NodeJS project. It's best use case is managing paths for complex build processes that require dependable build path management. If your build processes are looking for or need to create paths based on environment variables, then this library is a must.

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
6. export the `get` method on your `PathLocker` instance

```javascript
// getPaths.js

const PathLocker = require('node-path-locker');

const pathLocker = new PathLocker();

/*====== PATHS THAT EXIST IN THE SOURCE CODE  ======*/

// the last N parameters are combined using path.resolve
pathLocker.add('PACKAGE_ONE', __dirname, '../../package-one');
pathLocker.add('PACKAGE_TWO', __dirname, '../../package-two');
pathLocker.add('SOURCE_FILES', '${PACKAGE_ONE}', 'src'));
pathLocker.add('BUILD_DIRECTORY_ROOT', '${PACKAGE_TWO}');

/*====== SOURCE PATHS THAT DEPEND ON VARIABLES ======*/

// you can also pass in a single absolute url yourself using the path module
pathLocker.add('ENV_VARS_FILE', path.resolve(__dirname, '../../.env.${environment}'));

/*====== BUILD PATHS ======*/

// at the point another module calls the get method, these path swill be created recursively
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

## Additional Details

### Order Matters

PathLocker runs through the paths for validation and creation in the order you register them. You can interchange `add` and `create` paths, but if they depend on each other, then dependent paths must go first.

### With or Without the `path` Module

PathLocker ultimately generates absolute paths so that no matter where you use them, the paths work without tweaks. PathLocker uses `path.resolve` under the hood to ensure all paths are absolute, but there is flexibility in how you deliver the path to the library.

Check out this example:

```javascript
const path = require('path');
const PathLocker = require('node-path-locker');
const pathLocker = new PathLocker();

pathLocker.add('EXAMPLE_ONE', __dirname, 'example-one-directory');
pathLocker.add('EXAMPLE_TWO', path.resolve(__dirname, 'example-two-directory'));
```
This example shows that you can avoid using the `path` library all together if you want. If PathLocker sees you have multiple path parameters, it will use `path.resolve` for you. A small but helpful simplification.

If you pass in a single path parameter as in EXAMPLE_TWO, PathLocker will use that as the absolute url.


### Automatic Path Validation & Creation

Every time you use the `PathLocker` `get` method, it will validate all paths. This means that when you move things around in your project, you'll know if a build related path is busted.

Paths registered using the `add` method should already exist in the source so PathLocker will throw an error if any of these paths do not exists.

Paths registered using the `create` method will automatically be created recursively... BUT, if the path uses a template variable that references a previously registered path, it will throw an error if that dependent path does not exist.

This means it's best to add the root build path where new build directories are created and reference it as a template variable while constructing the new build directory paths.

Here is an example:

```javascript
const PathLocker = require('node-path-locker');
const pathLocker = new PathLocker();

// register the BUILD_ROOT, this is where dynamic artifacts will be created
pathLocker.add('BUILD_ROOT', __dirname, 'package-one');

// register a path to create. This path will not be created if 'BUILD_ROOT' doesn't exists
pathLocker.create('BUILD_ARTIFACTS', '${BUILD_ROOT}', 'build');

module.exports = pathLocker.get;
```

The `BUILD_ARTIFACTS` path will not be created and an error will be thrown if the `BUILD_ROOT` path does not exist.
