import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

async function main() {
  try {
    const src = 'src/styles/tokens.css'
    const dest = 'docs/_static/mq-variables.css'
    const css = await readFile(src, 'utf8')
    await mkdir(dirname(dest), { recursive: true })
    const header = '/* Auto-synced from src/styles/tokens.css during build. */\n'
    await writeFile(dest, header + css, 'utf8')
    console.log(`Synced design tokens: ${src} -> ${dest}`)
  } catch (err) {
    console.warn('Skipping token sync:', err?.message)
  }
}

main()

