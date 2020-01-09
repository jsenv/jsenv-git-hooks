import {
  assertAndNormalizeDirectoryUrl,
  resolveUrl,
  writeFile,
  readFile,
  readFileSystemNodeStat,
  urlToFileSystemPath,
  urlToRelativeUrl,
  writeFileSystemNodePermissions,
} from "@jsenv/util"
import { createLogger } from "@jsenv/logger"
import { readGitHooksFromPackage } from "./readGitHooksFromPackage.js"

// https://github.com/typicode/husky/blob/master/src/installer/getScript.ts

export const installGitHooks = async ({ logLevel, projectDirectoryUrl }) => {
  if (process.env.CI) {
    logger.debug(`process.env.CI -> skip installGitHooks`)
    return
  }

  projectDirectoryUrl = assertAndNormalizeDirectoryUrl(projectDirectoryUrl)

  const logger = createLogger({ logLevel })
  const gitHooks = await readGitHooksFromPackage({
    logger,
    projectDirectoryUrl,
  })

  await Promise.all(
    Object.keys(gitHooks).map(async (hookName) => {
      const hookCommand = gitHooks[hookName]
      const gitHookFileUrl = resolveUrl(`.git/hooks/${hookName}`, projectDirectoryUrl)
      const projectDirectoryRelativeUrl = urlToRelativeUrl(projectDirectoryUrl, gitHookFileUrl)
      const gitHookFileContent = `#!/bin/sh
cd "${projectDirectoryRelativeUrl}"
${hookCommand}`
      // should we add exit 0 ?

      const gitHookFileStats = await readFileSystemNodeStat(gitHookFileUrl, {
        nullIfNotFound: true,
      })
      if (gitHookFileStats) {
        const gitHookFilePreviousContent = await readFile(gitHookFileUrl)
        if (gitHookFilePreviousContent === gitHookFileContent) {
          return
        }
        logger.debug(`
update git ${hookName} hook
--- current command ---
${gitHookFileContent}
--- new command ---
${gitHookFileContent}
--- file ---
${urlToFileSystemPath(gitHookFileUrl)}`)
      } else {
        logger.debug(`
write git ${hookName} hook
--- command ---
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
