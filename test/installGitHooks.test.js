import { assert } from "@jsenv/assert"
import { installGitHooks } from "../index.js"
import {
  resolveUrl,
  ensureEmptyDirectory,
  writeFile,
  readFile,
  readFileSystemNodePermissions,
} from "@jsenv/util"

const tempDirectoryUrl = import.meta.resolve("./temp/")
await ensureEmptyDirectory(tempDirectoryUrl)

{
  const packageJsonFileUrl = resolveUrl("package.json", tempDirectoryUrl)
  const preCommitHookFileUrl = resolveUrl(".git/hooks/pre-commit", tempDirectoryUrl)
  await writeFile(
    packageJsonFileUrl,
    JSON.stringify(
      {
        scripts: {
          "git-hook-pre-commit": "node ./whatever.js",
        },
      },
      null,
      "  ",
    ),
  )

  await installGitHooks({
    projectDirectoryUrl: tempDirectoryUrl,
  })
  const actual = {
    precommitHookFileContent: await readFile(preCommitHookFileUrl),
    precommitHookFilePermissions: await readFileSystemNodePermissions(preCommitHookFileUrl),
  }
  const expected = {
    precommitHookFileContent: `#!/bin/sh
node ./whatever.js`,
    precommitHookFilePermissions: {
      owner: { read: true, write: true, execute: true },
      group: { read: true, write: false, execute: true },
      others: { read: true, write: false, execute: true },
    },
  }
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}
