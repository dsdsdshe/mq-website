import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

async function clean(path) {
  await rm(path, { recursive: true, force: true })
  console.log(`Removed ${path}`)
}

async function main() {
  const targets = [
    resolve('docs/_build'),
    resolve('public/docs'),
    resolve('docs/api-en/api_python_en'),
    resolve('docs/api-zh/api_python'),
    resolve('docs/en/src'),
    resolve('docs/zh/src'),
  ]
  for (const t of targets) {
    await clean(t)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

