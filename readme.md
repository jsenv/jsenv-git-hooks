# git-hooks

Declare git hooks in your package.json.

[![github package](https://img.shields.io/github/package-json/v/jsenv/jsenv-git-hooks.svg?logo=github&label=package)](https://github.com/jsenv/jsenv-git-hooks/packages)
[![npm package](https://img.shields.io/npm/v/@jsenv/git-hooks.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/git-hooks)
[![github ci](https://github.com/jsenv/jsenv-git-hooks/workflows/ci/badge.svg)](https://github.com/jsenv/jsenv-git-hooks/actions?workflow=ci)
[![codecov coverage](https://codecov.io/gh/jsenv/jsenv-git-hooks/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/jsenv-git-hooks)

# Table of contents

- [Description](#Description)
- [Installation](#Installation)
  - [Usage](#Usage)
- [Documentation](#Documentation)
  - [installGitHooks](#installGitHooks)
    - [projectDirectoryUrl](#projectDirectoryUrl)
    - [logLevel](#logLevel)
  - [uninstallGitHooks](#uninstallGitHooks)
- [Why](#Why)

# Description

`@jsenv/git-hooks` create a git hook for every scripts your package.json matching `git-hook-*`.

# Installation

```console
npm install @jsenv/git-hooks@1.2.0
```

## Usage

```js
import { installGitHooks } from "@jsenv/git-hooks"

installGitHooks({
  projectDirectoryUrl: "file:///directory",
})
```

If you use node < 13 you can use the commonjs export.

```js
const { installGitHooks } = require("@jsenv/git-hooks")
```

# Documentation

## installGitHooks

`installGitHooks` is an async function writing a hook file for every git hook script declared in a project package.json.

```js
import { installGitHooks } from "@jsenv/git-hooks"

await installGitHooks({
  projectDirectoryUrl: "file:///directory",
  logLevel: "info",
})
```

— source code at [src/installGitHooks.js](./src/installGitHooks.js).

### projectDirectoryUrl

`projectDirectoryUrl` parameter is a string leading to a directory as documented in https://github.com/jsenv/jsenv-util#assertandnormalizedirectoryurl. It is used to locate your package.json and the directory where git hooks will be written.

### logLevel

`logLevel` parameter is a string controlling the verbosity of logs during function exectuion as documented in https://github.com/jsenv/jsenv-logger#logLevel.

## uninstallGitHooks

`uninstallGitHooks` is an async function removing all git hooks installed by installGitHooks.

```js
import { uninstallGitHooks } from "@jsenv/git-hooks"

await uninstallGitHooks({
  projectDirectoryUrl: "file:///directory",
  logLevel: "info",
})
```

— source code at [src/uninstallGitHooks.js](./src/uninstallGitHooks.js).

# Why

I wanted a git precommit hook to run prettier on staged files as documented in https://prettier.io/docs/en/precommit.html.

I wanted to declare my hooks in package.json script to benefit from vscode script explorer feature, see [npm.enableScriptExplorer](https://code.visualstudio.com/docs/getstarted/tips-and-tricks#_run-npm-scripts-as-tasks-from-the-explorer).

After that I discovered husky, https://github.com/typicode/husky, which could do the job but they have deprecated declaring hooks inside scripts field.
