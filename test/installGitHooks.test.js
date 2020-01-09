import { assert } from "@jsenv/assert"
import { installGitHooks } from "../index.js"
import { resolveUrl, ensureEmptyDirectory, writeFile, readFile } from "@jsenv/util"

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
  const actual = await readFile(preCommitHookFileUrl)
  const expected = `#!/bin/sh
cd "../../"
node ./whatever.js`
  assert({ actual, expected })
  await ensureEmptyDirectory(tempDirectoryUrl)
}
