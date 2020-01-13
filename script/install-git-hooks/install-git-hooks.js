// const { installGitHooks } = require("@jsenv/git-hooks")
const { installGitHooks } = require("../../dist/commonjs/main.js")
const jsenvConfig = require("../../jsenv.config.js")

installGitHooks({
  ...jsenvConfig,
})
