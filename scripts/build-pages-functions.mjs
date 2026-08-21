import { spawnSync } from "child_process"
import fs from "fs"
import path from "path"

const projectRoot = process.cwd()
const wranglerCli = path.join(
  projectRoot,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js"
)
const bundleDirectory = path.join(
  projectRoot,
  ".wrangler",
  "pages-functions"
)
const bundledWorker = path.join(bundleDirectory, "index.js")
const outputDirectory = path.join(projectRoot, "out")
const outputWorker = path.join(outputDirectory, "_worker.js")
const outputRoutes = path.join(outputDirectory, "_routes.json")

if (!fs.existsSync(wranglerCli)) {
  throw new Error(
    "Wrangler is not installed. Run npm install before building the site."
  )
}

fs.mkdirSync(bundleDirectory, { recursive: true })
fs.mkdirSync(outputDirectory, { recursive: true })

const result = spawnSync(process.execPath, [
  wranglerCli,
  "pages",
  "functions",
  "build",
  "functions",
  `--outdir=${bundleDirectory}`,
  `--output-routes-path=${outputRoutes}`
], {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit"
})

if (result.error) throw result.error
if (result.status !== 0) {
  throw new Error(`Pages Functions build failed with exit code ${result.status}.`)
}
if (!fs.existsSync(bundledWorker)) {
  throw new Error("Wrangler did not produce the expected Worker module.")
}

fs.copyFileSync(bundledWorker, outputWorker)
console.log("Pages Functions generated at out/_worker.js")
