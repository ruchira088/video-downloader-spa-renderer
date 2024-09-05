const { readFile, writeFile } = require("fs")
const readLine = require("readline")
const { promisify } = require("util")
const path = require("path")
const SimpleGit = require("simple-git")

const PROD_BRANCH = "main"
const DEV_BRANCH = "dev"

const SNAPSHOT = "SNAPSHOT"

const packageJsonPath = path.resolve(__dirname, "../", "package.json")

const askQuestion = (text, cli) => new Promise((resolve) => cli.question(text, resolve))

const retrievePackageJson = () => promisify(readFile)(packageJsonPath, "utf8").then(JSON.parse)

const updatePackageJson = (json) =>
  retrievePackageJson()
    .then((packageJson) => ({ ...packageJson, ...json }))
    .then((packageJson) => promisify(writeFile)(packageJsonPath, JSON.stringify(packageJson, null, 2)))

const createProductionVersion = (appVersion) => appVersion.replace(`-${SNAPSHOT}`, "")

const incrementVersion = (appVersion) => {
  const [major, minor, patch] = appVersion.split(".").map((value) => parseInt(value, 10))

  return [major, minor, patch + 1].join(".")
}

const createSnapshotVersion = (appVersion) => (appVersion.endsWith(SNAPSHOT) ? appVersion : `${appVersion}-${SNAPSHOT}`)

const createVersion = (git, cli) =>
  git
    .branch()
    .then((branch) => {
      if (branch.current === DEV_BRANCH) {
        return Promise.resolve()
      } else {
        return Promise.reject(`Current branch is not ${DEV_BRANCH}`)
      }
    })
    .then(() => retrievePackageJson())
    .then((json) =>
      askQuestion(`Release version [${createProductionVersion(json.version)}]? `, cli).then(
        (inputVersion) => inputVersion.trim() || createProductionVersion(json.version)
      )
    )
    .then((version) =>
      updatePackageJson({ version })
        .then(() => git.add(packageJsonPath))
        .then(() => console.log(`Updated version to ${version}`))
        .then(() => git.commit(`Creating version ${version}`))
        .then(() => git.checkout(PROD_BRANCH))
        .then(() => git.raw("pull"))
        .then(() => git.raw("rebase", DEV_BRANCH))
        .then(() => git.raw("push"))
        .then(() => git.addTag(version))
        .then(() => git.pushTags())
        .then(() => git.checkout(DEV_BRANCH))
    )
    .then(() => retrievePackageJson())
    .then((json) =>
      askQuestion(`Next version [${createSnapshotVersion(incrementVersion(json.version))}]? `, cli).then(
        (nextVersion) => nextVersion.trim() || createSnapshotVersion(incrementVersion(json.version))
      )
    )
    .then((version) =>
      updatePackageJson({ version })
        .then(() => git.add(packageJsonPath))
        .then(() => git.commit(`Incrementing version to ${version}`))
        .then(() => git.push())
        .then(() => version)
    )

const cli = readLine.createInterface({ input: process.stdin, output: process.stdout })
const simpleGit = new SimpleGit()

createVersion(simpleGit, cli)
  .then(console.log)
  .then(() => process.exit(0))
