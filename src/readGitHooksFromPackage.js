import { resolveUrl, readFile } from "@jsenv/util"

export const readGitHooksFromPackage = async ({ logger, projectDirectoryUrl }) => {
  const packageJsonFileUrl = resolveUrl("package.json", projectDirectoryUrl)
  const packageJsonFileString = await readFile(packageJsonFileUrl)
  const packageJsonData = JSON.parse(packageJsonFileString)
  const { scripts } = packageJsonData

  const gitHooks = {}
  Object.keys(scripts).forEach((key) => {
    if (key.startsWith("git-hook-")) {
      const hookName = key.slice("git-hook-".length)
      if (!hookList.includes(hookName)) {
        logger.warn(`unknow hook: ${hookName}`)
        return
      }

      gitHooks[hookName] = scripts[key]
    }
  })
  return gitHooks
}

const hookList = [
  "applypatch-msg",
  "pre-applypatch",
  "post-applypatch",
  "pre-commit",
  "pre-merge-commit",
  "prepare-commit-msg",
  "commit-msg",
  "post-commit",
  "pre-rebase",
  "post-checkout",
  "post-merge",
  "pre-push",
  "pre-receive",
  "update",
  "post-receive",
  "post-update",
  "push-to-checkout",
  "pre-auto-gc",
  "post-rewrite",
  "sendemail-validate",
]
