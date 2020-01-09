const { exec } = require("child_process")

const runCommand = (cmd) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        // sometimes (e.g. eslint) we have a meaningful stdout along with the stderr
        reject(stdout ? `${stdout}\n\n${stderr}` : stderr)
      } else {
        resolve(stdout)
      }
    })
  })
}

runCommand("git diff --staged --name-only --diff-filter=AM").then((files) => {
  console.log("staged files", files)
})

// code above will move to prettier-check
// and prettierCheck will check for process.execArgv.includes('--precommit')
// and in that case will write file instead of checking them
// https://git-scm.com/docs/git-diff`
// later we will use git diff --cached --name-only --diff-filter=AM
// AM because we don't care for deleted files
// to get the list of files to run prettier on
