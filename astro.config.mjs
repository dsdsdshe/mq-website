import { defineConfig } from 'astro/config'

// Allow setting base dynamically for GitHub Pages project sites
const base = process.env.ASTRO_BASE || '/'
const site = process.env.SITE_URL || undefined

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'ignore'
})

