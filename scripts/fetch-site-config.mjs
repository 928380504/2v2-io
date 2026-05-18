import fs from "fs"
import path from "path"

const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim()
    }
  })
}

const SITE_ID = process.env.SITE_ID
const CONFIG_OWNER = process.env.CONFIG_OWNER
const CONFIG_NAME = process.env.CONFIG_NAME
const CONFIG_BRANCH = process.env.CONFIG_BRANCH || "main"
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

async function main() {
  if (!SITE_ID) throw new Error("Missing SITE_ID")
  if (!CONFIG_OWNER) throw new Error("Missing CONFIG_OWNER")
  if (!CONFIG_NAME) throw new Error("Missing CONFIG_NAME")

  const url = `https://api.github.com/repos/${CONFIG_OWNER}/${CONFIG_NAME}/contents/sites/${SITE_ID}.json?ref=${CONFIG_BRANCH}`

  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  }

  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`
  }

  const res = await fetch(url, {
    headers,
    cache: "no-store"
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to fetch site config: ${text}`)
  }

  const file = await res.json()
  const jsonString = Buffer.from(file.content, "base64").toString("utf-8")
  const config = JSON.parse(jsonString)

  const outputPath = path.join(
    process.cwd(),
    "src",
    "config",
    "site.generated.json"
  )

  fs.mkdirSync(path.dirname(outputPath), {
    recursive: true
  })

  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2))

  console.log(`Site config generated for ${SITE_ID}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})