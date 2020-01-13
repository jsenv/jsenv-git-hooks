import {
  assertAndNormalizeDirectoryUrl,
  resolveUrl,
  writeFile,
  readFile,
  readFileSystemNodeStat,
  urlToFileSystemPath,
  writeFileSystemNodePermissions,
  removeFileSystemNode,
} from "@jsenv/util"
import { createLogger } from "@jsenv/logger"
import { HOOK_NAMES, generateHookFileContent, hookIsGeneratedByUs } from "./internal/hook.js"

const isWindows = process.platform === "win32"

// https://github.com/typicode/husky/blob/master/src/installer/getScript.ts

export const installGitHooks = async ({ logLevel, projectDirectoryUrl, ci = process.env.CI }) => {
  const logger = createLogger({ logLevel })
  if (ci) {
    logger.info(`ci -> skip installGitHooks`)
    return
  }

  projectDirectoryUrl = assertAndNormalizeDirectoryUrl(projectDirectoryUrl)

  const packageJsonFileUrl = resolveUrl("package.json", projectDirectoryUrl)
  const packageJsonFileString = await readFile(packageJsonFileUrl)
  const packageJsonData = JSON.parse(packageJsonFileString)
  const { scripts = {} } = packageJsonData

  await Promise.all(
    HOOK_NAMES.map(async (hookName) => {
      const hookScriptName = `git-hook-${hookName}`
      const hookFileUrl = resolveUrl(`.git/hooks/${hookName}`, projectDirectoryUrl)
      const hookFileStats = await readFileSystemNodeStat(hookFileUrl, {
        nullIfNotFound: true,
      })
      const hookScriptPresence = hookScriptName in scripts
      const hookFilePresence = Boolean(hookFileStats)

      if (hookFilePresence) {
        const hookFileContent = await readFile(hookFileUrl)

        if (!hookIsGeneratedByUs(hookFileContent)) {
          if (hookScriptPresence) {
            logger.info(`
ignore ${hookScriptName} script because there is a git ${hookName} hook file not generated by us.`)
          }
          return
        }

        if (hookScriptPresence) {
          const hookFileContentForScript = generateHookFileContent(scripts[hookScriptName])
          if (hookFileContentForScript === hookFileContent) {
            logger.debug(`
keep existing git ${hookName} hook file.
--- file ---
${urlToFileSystemPath(hookFileUrl)}`)
            return
          }
          logger.info(`
overwrite git ${hookName} hook file.
--- file ---
${urlToFileSystemPath(hookFileUrl)}
--- previous file content ---
${hookFileContent}
--- file content ---
${hookFileContentForScript}`)
          await writeHook(hookFileUrl, hookFileContentForScript)
        } else {
          logger.info(`
remove git ${hookName} hook file.
--- file ---
${urlToFileSystemPath(hookFileUrl)}
--- file content ---
${hookFileContent}`)
          await removeFileSystemNode(hookFileUrl)
        }
      } else if (hookScriptPresence) {
        const hookFileContentForScript = generateHookFileContent(scripts[hookScriptName])
        logger.info(`
write git ${hookName} hook file.
--- file ---
${urlToFileSystemPath(hookFileUrl)}
--- file content ---
${hookFileContentForScript}`)
        await writeHook(hookFileUrl, hookFileContentForScript)
      }
    }),
  )
}

const writeHook = async (hookFileUrl, hookFileContent) => {
  await writeFile(hookFileUrl, hookFileContent)
  if (!isWindows) {
    await writeFileSystemNodePermissions(hookFileUrl, {
      owner: { read: true, write: true, execute: true },
      group: { read: true, write: false, execute: true },
      others: { read: true, write: false, execute: true },
    })
  }
}
