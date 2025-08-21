import { spawn } from 'node:child_process'
import { cp, mkdir, rm, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

function run(cmd, args, opts = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts })
    child.on('close', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${cmd} exited with ${code}`))
    })
  })
}

async function exists(p) {
  try { await stat(p); return true } catch { return false }
}

async function main() {
  // Sync design tokens first so docs use latest variables
  await run('node', ['scripts/prepare-tokens.mjs'])
  await run('jupyter-book', ['build', 'docs'])
  const src = resolve('docs/_build/html')
  const dst = resolve('public/docs')
  if (await exists(dst)) await rm(dst, { recursive: true, force: true })
  await mkdir(dst, { recursive: true })
  await cp(src, dst, { recursive: true })
  console.log(`Copied Jupyter Book → ${dst}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
