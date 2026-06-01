// ROTConnector 네이티브 아이콘/스플래시 소스 생성
// SVG → PNG (sharp). 산출물은 assets/ 에 저장 후 `npx @capacitor/assets generate` 입력으로 사용.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'assets')
mkdirSync(out, { recursive: true })

const NAVY_GRAD = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#25427b"/>
    <stop offset="1" stop-color="#0e1830"/>
  </linearGradient>`

const NAVY_GRAD_DARK = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#16264a"/>
    <stop offset="1" stop-color="#070c18"/>
  </linearGradient>`

// 풀블리드 아이콘 (1024)
const iconOnly = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>${NAVY_GRAD}</defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <g opacity="0.16" stroke="#f0c45a" stroke-width="12" stroke-linecap="round" fill="#f0c45a">
    <line x1="312" y1="772" x2="712" y2="772"/>
    <circle cx="312" cy="772" r="26"/>
    <circle cx="712" cy="772" r="26"/>
  </g>
  <text x="512" y="470" font-family="Arial, Helvetica, sans-serif" font-size="380" font-weight="900"
        text-anchor="middle" dominant-baseline="central" fill="#f0c45a">ROT</text>
</svg>`

// 적응형 전경 (1024, 투명) — 안전영역 ~62%
const iconForeground = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <text x="512" y="512" font-family="Arial, Helvetica, sans-serif" font-size="300" font-weight="900"
        text-anchor="middle" dominant-baseline="central" fill="#f0c45a">ROT</text>
</svg>`

// 적응형 배경 (1024)
const iconBackground = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>${NAVY_GRAD}</defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
</svg>`

// 스플래시 (2732) — 배지 + 워드마크
function splash(grad) {
  return `<svg width="2732" height="2732" viewBox="0 0 2732 2732" xmlns="http://www.w3.org/2000/svg">
  <defs>${grad}</defs>
  <rect width="2732" height="2732" fill="url(#bg)"/>
  <g transform="translate(1366 1216)">
    <rect x="-300" y="-300" width="600" height="600" rx="132" fill="#0e1830" stroke="#f0c45a" stroke-width="6" opacity="0.92"/>
    <text x="0" y="-20" font-family="Arial, Helvetica, sans-serif" font-size="220" font-weight="900"
          text-anchor="middle" dominant-baseline="central" fill="#f0c45a">ROT</text>
  </g>
  <text x="1366" y="1700" font-family="Arial, Helvetica, sans-serif" font-size="150" font-weight="800"
        text-anchor="middle" fill="#ffffff" letter-spacing="6">ROTCONNECTOR</text>
  <text x="1366" y="1820" font-family="Arial, Helvetica, sans-serif" font-size="70" font-weight="500"
        text-anchor="middle" fill="#93b2dd" letter-spacing="10">TRUST · CONNECTION · OS</text>
</svg>`
}

const jobs = [
  ['icon-only.png', iconOnly],
  ['icon-foreground.png', iconForeground],
  ['icon-background.png', iconBackground],
  ['splash.png', splash(NAVY_GRAD)],
  ['splash-dark.png', splash(NAVY_GRAD_DARK)],
]

for (const [name, svg] of jobs) {
  await sharp(Buffer.from(svg)).png().toFile(resolve(out, name))
  console.log('wrote', name)
}
console.log('done →', out)
