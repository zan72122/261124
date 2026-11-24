#!/usr/bin/env bash
# Stability "Stable Image Core" text-to-image (3 credits/call). Auth is injected by the session proxy.
# usage: tools/sd.sh "<prompt>" out.png [aspect=1:1] [style_preset=photographic] [negative_prompt] [seed]
set -euo pipefail
prompt="$1"; out="$2"; aspect="${3:-1:1}"; style="${4:-photographic}"; neg="${5:-}"; seed="${6:-0}"
args=(--form-string "prompt=$prompt" --form-string "output_format=png" --form-string "aspect_ratio=$aspect" --form-string "seed=$seed")
[ -n "$style" ] && [ "$style" != "none" ] && args+=(--form-string "style_preset=$style")
[ -n "$neg" ] && args+=(--form-string "negative_prompt=$neg")
code=$(curl -sS -m 180 -X POST https://api.stability.ai/v2beta/stable-image/generate/core \
  -H "Authorization: Bearer dummy" -H "Accept: image/*" "${args[@]}" -o "$out" -w "%{http_code}")
if [ "$code" != "200" ]; then echo "HTTP $code"; head -c 400 "$out"; echo; rm -f "$out"; exit 1; fi
echo "ok $out"
