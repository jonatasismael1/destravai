import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const svgBuffer = readFileSync(join(root, 'public', 'favicon.svg'))

const sizes = [192, 512]

for (const size of sizes) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(join(root, 'public', `icon-${size}.png`))
  console.log(`✓ icon-${size}.png gerado`)
}

// Apple touch icon (180x180)
await sharp(svgBuffer)
  .resize(180, 180)
  .png()
  .toFile(join(root, 'public', 'apple-touch-icon.png'))
console.log('✓ apple-touch-icon.png gerado')
