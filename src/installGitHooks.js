import {
  assertAndNormalizeDirectoryUrl,
  resolveUrl,
  writeFile,
  readFile,
  readFileSystemNodeStat,
  urlToFileSystemPath,
  writeFileSystemNodePermissions,
} from "@jsenv/util"
import { createLogger } from "@jsenv/logger"
import { readGitHooksFromPackage } from "./readGitHooksFromPackage.js"

// https://github.com/typicode/husky/blob/master/src/installer/getScript.ts

export const installGitHooks = async ({ logLevel, projectDirectoryUrl }) => {
  const logger = createLogger({ logLevel })
  if (process.env.CI) {
    logger.debug(`process.env.CI -> skip installGitHooks`)
    return
  }

  projectDirectoryUrl = assertAndNormalizeDirectoryUrl(projectDirectoryUrl)
  const gitHooks = await readGitHooksFromPackage({
    logger,
    projectDirectoryUrl,
  })

  const gitHookNames = Object.keys(gitHooks)
  if (gitHookNames.length === 0) {
    logger.debug(`no git hooks in package.json scripts`)
    return
  }

  await Promise.all(
    gitHookNames.map(async (hookName) => {
      const hookCommand = gitHooks[hookName]
      const gitHookFileUrl = resolveUrl(`.git/hooks/${hookName}`, projectDirectoryUrl)
      const gitHookFileContent = `#!/bin/sh
${hookCommand}`
      // should we add exit 0 ?

      const gitHookFileStats = await readFileSystemNodeStat(gitHookFileUrl, {
        nullIfNotFound: true,
      })
      if (gitHookFileStats) {
        const gitHookFilePreviousContent = await readFile(gitHookFileUrl)
        if (gitHookFilePreviousContent === gitHookFileContent) {
          logger.debug(`already installed git ${hookName} hook`)
          return
        }
        logger.debug(`
update git ${hookName} hook
--- previous file content ---
${gitHookFilePreviousContent}
--- file content ---
${gitHookFileContent}
--- file ---
${urlToFileSystemPath(gitHookFileUrl)}`)
      } else {
        logger.debug(`
write git ${hookName} hook
--- file content ---
${gitHookFileContent}
--- file ---
${urlToFileSystemPath(gitHookFileUrl)}`)
      }

      await writeFile(gitHookFileUrl, gitHookFileContent)
      await writeFileSystemNodePermissions(gitHookFileUrl, {
        owner: { read: true, write: true, execute: true },
        group: { read: true, write: false, execute: true },
        others: { read: true, write: false, execute: true },
      })
    }),
  )
}
