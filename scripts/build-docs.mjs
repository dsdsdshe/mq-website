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

async function buildBook(lang) {
  const proj = resolve(`docs/${lang}`)
  const outRoot = resolve(`docs/_build/books/${lang}`)
  const dst = resolve(`public/docs/${lang}`)
  // Build into a per-language folder under docs/_build/books
  await run('jupyter-book', ['build', proj, '--path-output', outRoot])
  // Jupyter Book writes to <path-output>/_build/html
  const src = resolve(outRoot, '_build/html')
  // Fallback to legacy location if needed
  const fallback = resolve(`docs/${lang}/_build/html`)
  const finalSrc = (await exists(src)) ? src : fallback
  if (!(await exists(finalSrc))) {
    throw new Error(`Could not locate Jupyter Book HTML output for ${lang}. Tried: \n- ${src}\n- ${fallback}`)
  }
  if (await exists(dst)) await rm(dst, { recursive: true, force: true })
  await mkdir(dst, { recursive: true })
  await cp(finalSrc, dst, { recursive: true })
  console.log(`Copied ${lang} book → ${dst}`)
}

async function buildSphinx(api, lang) {
  const proj = resolve(`docs/${api}`) // api-en or api-zh
  const out = resolve(`docs/_build/api/${lang}`)
  const dst = resolve(`public/docs/api/${lang}`)
  await run('sphinx-build', ['-b', 'html', proj, out])
  if (await exists(dst)) await rm(dst, { recursive: true, force: true })
  await mkdir(dst, { recursive: true })
  await cp(out, dst, { recursive: true })
  console.log(`Copied ${api} → ${dst}`)
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
  // Generate _toc.yml for both books (tutorials only)
  await run('python', ['scripts/generate_toc.py'])
  await buildBook('en')
  await buildBook('zh')
  // Build API (Sphinx) and place under /docs/api/{en,zh}
  await buildSphinx('api-en', 'en')
  await buildSphinx('api-zh', 'zh')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
