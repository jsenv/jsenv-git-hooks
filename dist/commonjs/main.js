'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var url = require('url');
var fs = require('fs');
require('crypto');
var path = require('path');
var util = require('util');

const ensureUrlTrailingSlash = url => {
  return url.endsWith("/") ? url : `${url}/`;
};

const isFileSystemPath = value => {
  if (typeof value !== "string") {
    throw new TypeError(`isFileSystemPath first arg must be a string, got ${value}`);
  }

  if (value[0] === "/") return true;
  return startsWithWindowsDriveLetter(value);
};

const startsWithWindowsDriveLetter = string => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  const secondChar = string[1];
  if (secondChar !== ":") return false;
  return true;
};

const fileSystemPathToUrl = value => {
  if (!isFileSystemPath(value)) {
    throw new Error(`received an invalid value for fileSystemPath: ${value}`);
  }

  return String(url.pathToFileURL(value));
};

const assertAndNormalizeDirectoryUrl = value => {
  let urlString;

  if (value instanceof URL) {
    urlString = value.href;
  } else if (typeof value === "string") {
    if (isFileSystemPath(value)) {
      urlString = fileSystemPathToUrl(value);
    } else {
      try {
        urlString = String(new URL(value));
      } catch (e) {
        throw new TypeError(`directoryUrl must be a valid url, received ${value}`);
      }
    }
  } else {
    throw new TypeError(`directoryUrl must be a string or an url, received ${value}`);
  }

  if (!urlString.startsWith("file://")) {
    throw new Error(`directoryUrl must starts with file://, received ${value}`);
  }

  return ensureUrlTrailingSlash(urlString);
};

const assertAndNormalizeFileUrl = (value, baseUrl) => {
  let urlString;

  if (value instanceof URL) {
    urlString = value.href;
  } else if (typeof value === "string") {
    if (isFileSystemPath(value)) {
      urlString = fileSystemPathToUrl(value);
    } else {
      try {
        urlString = String(new URL(value, baseUrl));
      } catch (e) {
        throw new TypeError(`fileUrl must be a valid url, received ${value}`);
      }
    }
  } else {
    throw new TypeError(`fileUrl must be a string or an url, received ${value}`);
  }

  if (!urlString.startsWith("file://")) {
    throw new Error(`fileUrl must starts with file://, received ${value}`);
  }

  return urlString;
};

const statsToType = stats => {
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  if (stats.isSymbolicLink()) return "symbolic-link";
  if (stats.isFIFO()) return "fifo";
  if (stats.isSocket()) return "socket";
  if (stats.isCharacterDevice()) return "character-device";
  if (stats.isBlockDevice()) return "block-device";
  return undefined;
};

const urlToFileSystemPath = fileUrl => {
  if (fileUrl[fileUrl.length - 1] === "/") {
    // remove trailing / so that nodejs path becomes predictable otherwise it logs
    // the trailing slash on linux but does not on windows
    fileUrl = fileUrl.slice(0, -1);
  }

  const fileSystemPath = url.fileURLToPath(fileUrl);
  return fileSystemPath;
};

// https://github.com/coderaiser/cloudcmd/issues/63#issuecomment-195478143
// https://nodejs.org/api/fs.html#fs_file_modes
// https://github.com/TooTallNate/stat-mode
// cannot get from fs.constants because they are not available on windows
const S_IRUSR = 256;
/* 0000400 read permission, owner */

const S_IWUSR = 128;
/* 0000200 write permission, owner */

const S_IXUSR = 64;
/* 0000100 execute/search permission, owner */

const S_IRGRP = 32;
/* 0000040 read permission, group */

const S_IWGRP = 16;
/* 0000020 write permission, group */

const S_IXGRP = 8;
/* 0000010 execute/search permission, group */

const S_IROTH = 4;
/* 0000004 read permission, others */

const S_IWOTH = 2;
/* 0000002 write permission, others */

const S_IXOTH = 1;
const permissionsToBinaryFlags = ({
  owner,
  group,
  others
}) => {
  let binaryFlags = 0;
  if (owner.read) binaryFlags |= S_IRUSR;
  if (owner.write) binaryFlags |= S_IWUSR;
  if (owner.execute) binaryFlags |= S_IXUSR;
  if (group.read) binaryFlags |= S_IRGRP;
  if (group.write) binaryFlags |= S_IWGRP;
  if (group.execute) binaryFlags |= S_IXGRP;
  if (others.read) binaryFlags |= S_IROTH;
  if (others.write) binaryFlags |= S_IWOTH;
  if (others.execute) binaryFlags |= S_IXOTH;
  return binaryFlags;
};

const writeFileSystemNodePermissions = async (source, permissions) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);
  const sourcePath = urlToFileSystemPath(sourceUrl);
  let binaryFlags;

  if (typeof permissions === "object") {
    permissions = {
      owner: {
        read: getPermissionOrComputeDefault("read", "owner", permissions),
        write: getPermissionOrComputeDefault("write", "owner", permissions),
        execute: getPermissionOrComputeDefault("execute", "owner", permissions)
      },
      group: {
        read: getPermissionOrComputeDefault("read", "group", permissions),
        write: getPermissionOrComputeDefault("write", "group", permissions),
        execute: getPermissionOrComputeDefault("execute", "group", permissions)
      },
      others: {
        read: getPermissionOrComputeDefault("read", "others", permissions),
        write: getPermissionOrComputeDefault("write", "others", permissions),
        execute: getPermissionOrComputeDefault("execute", "others", permissions)
      }
    };
    binaryFlags = permissionsToBinaryFlags(permissions);
  } else {
    binaryFlags = permissions;
  }

  return chmodNaive(sourcePath, binaryFlags);
};

const chmodNaive = (fileSystemPath, binaryFlags) => {
  return new Promise((resolve, reject) => {
    fs.chmod(fileSystemPath, binaryFlags, error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

const actionLevels = {
  read: 0,
  write: 1,
  execute: 2
};
const subjectLevels = {
  others: 0,
  group: 1,
  owner: 2
};

const getPermissionOrComputeDefault = (action, subject, permissions) => {
  if (subject in permissions) {
    const subjectPermissions = permissions[subject];

    if (action in subjectPermissions) {
      return subjectPermissions[action];
    }

    const actionLevel = actionLevels[action];
    const actionFallback = Object.keys(actionLevels).find(actionFallbackCandidate => actionLevels[actionFallbackCandidate] > actionLevel && actionFallbackCandidate in subjectPermissions);

    if (actionFallback) {
      return subjectPermissions[actionFallback];
    }
  }

  const subjectLevel = subjectLevels[subject]; // do we have a subject with a stronger level (group or owner)
  // where we could read the action permission ?

  const subjectFallback = Object.keys(subjectLevels).find(subjectFallbackCandidate => subjectLevels[subjectFallbackCandidate] > subjectLevel && subjectFallbackCandidate in permissions);

  if (subjectFallback) {
    const subjectPermissions = permissions[subjectFallback];
    return action in subjectPermissions ? subjectPermissions[action] : getPermissionOrComputeDefault(action, subjectFallback, permissions);
  }

  return false;
};

const isWindows = process.platform === "win32";
const readFileSystemNodeStat = async (source, {
  nullIfNotFound = false,
  followLink = true
} = {}) => {
  if (source.endsWith("/")) source = source.slice(0, -1);
  const sourceUrl = assertAndNormalizeFileUrl(source);
  const sourcePath = urlToFileSystemPath(sourceUrl);
  const handleNotFoundOption = nullIfNotFound ? {
    handleNotFoundError: () => null
  } : {};
  return readStat(sourcePath, {
    followLink,
    ...handleNotFoundOption,
    ...(isWindows ? {
      // Windows can EPERM on stat
      handlePermissionDeniedError: async error => {
        // unfortunately it means we mutate the permissions
        // without being able to restore them to the previous value
        // (because reading current permission would also throw)
        try {
          await writeFileSystemNodePermissions(sourceUrl, 0o666);
          const stats = await readStat(sourcePath, {
            followLink,
            ...handleNotFoundOption,
            // could not fix the permission error, give up and throw original error
            handlePermissionDeniedError: () => {
              throw error;
            }
          });
          return stats;
        } catch (e) {
          // failed to write permission or readState, throw original error as well
          throw error;
        }
      }
    } : {})
  });
};

const readStat = (sourcePath, {
  followLink,
  handleNotFoundError = null,
  handlePermissionDeniedError = null
} = {}) => {
  const nodeMethod = followLink ? fs.stat : fs.lstat;
  return new Promise((resolve, reject) => {
    nodeMethod(sourcePath, (error, statsObject) => {
      if (error) {
        if (handlePermissionDeniedError && (error.code === "EPERM" || error.code === "EACCES")) {
          resolve(handlePermissionDeniedError(error));
        } else if (handleNotFoundError && error.code === "ENOENT") {
          resolve(handleNotFoundError(error));
        } else {
          reject(error);
        }
      } else {
        resolve(statsObject);
      }
    });
  });
};

const {
  mkdir
} = fs.promises;
const writeDirectory = async (destination, {
  recursive = true,
  allowUseless = false
} = {}) => {
  const destinationUrl = assertAndNormalizeDirectoryUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);
  const destinationStats = await readFileSystemNodeStat(destinationUrl, {
    nullIfNotFound: true,
    followLink: false
  });

  if (destinationStats) {
    if (destinationStats.isDirectory()) {
      if (allowUseless) {
        return;
      }

      throw new Error(`directory already exists at ${destinationPath}`);
    }

    const destinationType = statsToType(destinationStats);
    throw new Error(`cannot write directory at ${destinationPath} because there is a ${destinationType}`);
  }

  try {
    await mkdir(destinationPath, {
      recursive
    });
  } catch (error) {
    if (allowUseless && error.code === "EEXIST") {
      return;
    }

    throw error;
  }
};

const resolveUrl = (specifier, baseUrl) => {
  if (typeof baseUrl === "undefined") {
    throw new TypeError(`baseUrl missing to resolve ${specifier}`);
  }

  return String(new URL(specifier, baseUrl));
};

const isWindows$1 = process.platform === "win32";
const baseUrlFallback = fileSystemPathToUrl(process.cwd());

const ensureParentDirectories = async destination => {
  const destinationUrl = assertAndNormalizeFileUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);
  const destinationParentPath = path.dirname(destinationPath);
  return writeDirectory(destinationParentPath, {
    recursive: true,
    allowUseless: true
  });
};

const isWindows$2 = process.platform === "win32";

const readFilePromisified = util.promisify(fs.readFile);
const readFile = async value => {
  const fileUrl = assertAndNormalizeFileUrl(value);
  const filePath = urlToFileSystemPath(fileUrl);
  const buffer = await readFilePromisified(filePath);
  return buffer.toString();
};

const {
  writeFile: writeFileNode
} = fs.promises;
const writeFile = async (destination, content = "") => {
  const destinationUrl = assertAndNormalizeFileUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);

  try {
    await writeFileNode(destinationPath, content);
  } catch (error) {
    if (error.code === "ENOENT") {
      await ensureParentDirectories(destinationUrl);
      await writeFileNode(destinationPath, content);
      return;
    }

    throw error;
  }
};

const LOG_LEVEL_OFF = "off";
const LOG_LEVEL_DEBUG = "debug";
const LOG_LEVEL_INFO = "info";
const LOG_LEVEL_WARN = "warn";
const LOG_LEVEL_ERROR = "error";

const createLogger = ({
  logLevel = LOG_LEVEL_INFO
} = {}) => {
  if (logLevel === LOG_LEVEL_DEBUG) {
    return {
      debug,
      info,
      warn,
      error
    };
  }

  if (logLevel === LOG_LEVEL_INFO) {
    return {
      debug: debugDisabled,
      info,
      warn,
      error
    };
  }

  if (logLevel === LOG_LEVEL_WARN) {
    return {
      debug: debugDisabled,
      info: infoDisabled,
      warn,
      error
    };
  }

  if (logLevel === LOG_LEVEL_ERROR) {
    return {
      debug: debugDisabled,
      info: infoDisabled,
      warn: warnDisabled,
      error
    };
  }

  if (logLevel === LOG_LEVEL_OFF) {
    return {
      debug: debugDisabled,
      info: infoDisabled,
      warn: warnDisabled,
      error: errorDisabled
    };
  }

  throw new Error(`unexpected logLevel.
--- logLevel ---
${logLevel}
--- allowed log levels ---
${LOG_LEVEL_OFF}
${LOG_LEVEL_ERROR}
${LOG_LEVEL_WARN}
${LOG_LEVEL_INFO}
${LOG_LEVEL_DEBUG}`);
};
const debug = console.debug;

const debugDisabled = () => {};

const info = console.info;

const infoDisabled = () => {};

const warn = console.warn;

const warnDisabled = () => {};

const error = console.error;

const errorDisabled = () => {};

const readGitHooksFromPackage = async ({
  logger,
  projectDirectoryUrl
}) => {
  const packageJsonFileUrl = resolveUrl("package.json", projectDirectoryUrl);
  const packageJsonFileString = await readFile(packageJsonFileUrl);
  const packageJsonData = JSON.parse(packageJsonFileString);
  const {
    scripts
  } = packageJsonData;
  const gitHooks = {};
  Object.keys(scripts).forEach(key => {
    if (key.startsWith("git-hook-")) {
      const hookName = key.slice("git-hook-".length);

      if (!hookList.includes(hookName)) {
        logger.warn(`
unknow hook: ${hookName}
--- available hooks ---
${hookList.join(`
`)}
`);
        return;
      }

      gitHooks[hookName] = scripts[key];
    }
  });
  return gitHooks;
};
const hookList = ["applypatch-msg", "pre-applypatch", "post-applypatch", "pre-commit", "pre-merge-commit", "prepare-commit-msg", "commit-msg", "post-commit", "pre-rebase", "post-checkout", "post-merge", "pre-push", "pre-receive", "update", "post-receive", "post-update", "push-to-checkout", "pre-auto-gc", "post-rewrite", "sendemail-validate"];

const isWindows$3 = process.platform === "win32"; // https://github.com/typicode/husky/blob/master/src/installer/getScript.ts

const installGitHooks = async ({
  logLevel = "debug",
  projectDirectoryUrl,
  ci = process.env.CI
}) => {
  const logger = createLogger({
    logLevel
  });

  if (ci) {
    logger.debug(`ci -> skip installGitHooks`);
    return;
  }

  projectDirectoryUrl = assertAndNormalizeDirectoryUrl(projectDirectoryUrl);
  const gitHooks = await readGitHooksFromPackage({
    logger,
    projectDirectoryUrl
  });
  const gitHookNames = Object.keys(gitHooks);

  if (gitHookNames.length === 0) {
    logger.debug(`no git hooks in package.json scripts`);
    return;
  }

  await Promise.all(gitHookNames.map(async hookName => {
    const hookCommand = gitHooks[hookName];
    const gitHookFileUrl = resolveUrl(`.git/hooks/${hookName}`, projectDirectoryUrl);
    const gitHookFileContent = `#!/bin/sh
${hookCommand}`; // should we add exit 0 ?

    const gitHookFileStats = await readFileSystemNodeStat(gitHookFileUrl, {
      nullIfNotFound: true
    });

    if (gitHookFileStats) {
      const gitHookFilePreviousContent = await readFile(gitHookFileUrl);

      if (gitHookFilePreviousContent === gitHookFileContent) {
        logger.debug(`already installed git ${hookName} hook`);
        return;
      }

      logger.debug(`
update git ${hookName} hook
--- previous file content ---
${gitHookFilePreviousContent}
--- file content ---
${gitHookFileContent}
--- file ---
${urlToFileSystemPath(gitHookFileUrl)}`);
    } else {
      logger.debug(`
write git ${hookName} hook
--- file content ---
${gitHookFileContent}
--- file ---
${urlToFileSystemPath(gitHookFileUrl)}`);
    }

    await writeFile(gitHookFileUrl, gitHookFileContent);

    if (!isWindows$3) {
      await writeFileSystemNodePermissions(gitHookFileUrl, {
        owner: {
          read: true,
          write: true,
          execute: true
        },
        group: {
          read: true,
          write: false,
          execute: true
        },
        others: {
          read: true,
          write: false,
          execute: true
        }
      });
    }
  }));
};

const uninstallGitHooks = () => {};

exports.installGitHooks = installGitHooks;
exports.readGitHooksFromPackage = readGitHooksFromPackage;
exports.uninstallGitHooks = uninstallGitHooks;
//# sourceMappingURL=main.js.map
