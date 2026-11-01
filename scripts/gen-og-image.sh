#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

FONT_BOLD="${FONT_BOLD:-/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf}"
FONT_REGULAR="${FONT_REGULAR:-/usr/share/fonts/opentype/inter/InterDisplay-Regular.otf}"

PRIMARY="#6331FB"
SECONDARY="#88F9C0"
TEXT="#10101D"

convert -size 1200x630 xc: \
  -sparse-color barycentric "0,0 ${PRIMARY} 1200,630 ${SECONDARY}" \
  \( scripts/og-overlay-bg.png \) \
  -compose Multiply -composite \
  -attenuate 0.075 +noise Gaussian \
  -fill none -stroke white -strokewidth 24 \
  -draw "polygon 564,112 612,208 672,148 732,328 492,328" \
  -stroke none \
  -fill "${TEXT}" -font "${FONT_BOLD}" -pointsize 80 \
  -gravity North -annotate +0+400 "trailscan" \
  -fill "rgba(16,20,40,0.72)" -font "${FONT_REGULAR}" -pointsize 32 \
  -annotate +0+500 "GPX trail feature finder" \
  -strip public/og-image.jpg
