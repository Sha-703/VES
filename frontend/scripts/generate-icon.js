const sharp = require('sharp')
const pngToIco = require('png-to-ico')
const fs = require('fs')
const path = require('path')

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

async function generate() {
  const root = path.join(__dirname, '..')
  const svgPath = path.join(root, 'src', 'assets', 'logo-white.svg')
  const outDir = path.join(root, 'build', 'icons')
  await ensureDir(outDir)

  if (!fs.existsSync(svgPath)) {
    console.error('SVG source not found:', svgPath)
    process.exit(1)
  }

  // Sizes commonly packed into ICO files
  const sizes = [256, 128, 64, 48, 32]
  const pngPaths = []

  for (const size of sizes) {
    const outPng = path.join(outDir, `icon-${size}.png`)
    await sharp(svgPath).resize(size, size, { fit: 'contain' }).png().toFile(outPng)
    pngPaths.push(outPng)
    console.log('Generated', outPng)
  }

  // Convert to ICO
  try {
    const icoBuffer = await pngToIco(pngPaths)
    const icoPath = path.join(outDir, 'icon.ico')
    fs.writeFileSync(icoPath, icoBuffer)
    console.log('Wrote ICO:', icoPath)
  } catch (err) {
    console.error('Failed to convert PNGs to ICO:', err)
    process.exit(1)
  }

  // Optionally remove temporary PNGs
  for (const p of pngPaths) {
    try { fs.unlinkSync(p) } catch (e) { /* ignore */ }
  }
}

generate()
  .then(() => console.log('Icon generation complete'))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
