import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

async function clean(path) {
  await rm(path, { recursive: true, force: true })
  console.log(`Removed ${path}`)
}

async function main() {
  const targets = [
    resolve('docs/_build'),
    resolve('docs/en/_build'),
    resolve('docs/zh/_build'),
    resolve('public/docs'),
  ]
  for (const t of targets) {
    await clean(t)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

