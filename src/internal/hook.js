export const HOOK_NAMES = [
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

export const generateHookFileContent = (hookCommand) => `#!/bin/sh
# Generated by @jsenv/git-hooks
${hookCommand}`

export const hookIsGeneratedByUs = (hookFileContent) => {
  return hookFileContent.includes(`# Generated by @jsenv/git-hooks`)
}
