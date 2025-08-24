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

async function buildOne(lang) {
  const proj = resolve(`docs/${lang}`)
  await run('jupyter-book', ['build', proj])
  const src = resolve(`docs/${lang}/_build/html`)
  const dst = resolve(`public/docs/${lang}`)
  if (await exists(dst)) await rm(dst, { recursive: true, force: true })
  await mkdir(dst, { recursive: true })
  await cp(src, dst, { recursive: true })
  console.log(`Copied ${lang} book → ${dst}`)
}

async function main() {
  // Ensure docs sources are present (auto-clone upstreams if needed)
  try {
    await run('python', ['scripts/sync_all.py'])
  } catch (err) {
    console.warn('Skipping upstream sync (non-fatal):', err?.message || err)
  }
  // Sync design tokens first so docs use latest variables
  await run('node', ['scripts/prepare-tokens.mjs'])
  // Generate _toc.yml for both books so API pages are included
  await run('python', ['scripts/generate_toc.py'])
  await buildOne('en')
  await buildOne('zh')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
