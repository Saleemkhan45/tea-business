// Build first. Measures entry HTML's static JS graph and entry CSS, not route latency.
import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const html = await readFile(resolve(root, 'dist/index.html'), 'utf8')
const references = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)].map(match => match[1])
const assets = await Promise.all([...new Set(references)].map(async file => {
  const content = await readFile(resolve(root, 'dist', file.slice(1)))
  return { file, bytes: content.length, gzipBytes: gzipSync(content).length }
}))
const result = {
  scope: 'Entry HTML scripts, module preloads and stylesheets; excludes dynamically loaded route features',
  assets,
  javascriptBytes: assets.filter(asset => asset.file.endsWith('.js')).reduce((sum, asset) => sum + asset.bytes, 0),
  javascriptGzipBytes: assets.filter(asset => asset.file.endsWith('.js')).reduce((sum, asset) => sum + asset.gzipBytes, 0),
  cssBytes: assets.filter(asset => asset.file.endsWith('.css')).reduce((sum, asset) => sum + asset.bytes, 0),
}
await writeFile(resolve(root, '../docs/dashboard-bundle-results.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
