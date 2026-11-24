#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
FAIL=0
check() {
  local pattern="$1" label="$2"
  if grep -RinE "$pattern" fe/src --include='*.tsx' --include='*.css' | head -10; then
    echo "FAIL: $label"
    FAIL=1
  fi
}
check 'from-purple-[0-9]|to-blue-[0-9]|linear-gradient\(' 'Generic marketing gradients'
check 'backdrop-blur|glassmorph|animate-bounce|hover:scale-10' 'Generic AI decoration'
check 'Supercharge|Unlock your potential|Revolutionize your workflow' 'Empty marketing copy'
check 'rounded-3xl|rounded-2xl|shadow-2xl' 'Oversized radius or shadow soup'
if grep -qE '^enum ' be/prisma/schema.prisma;then echo 'FAIL: Prisma enum detected';FAIL=1;fi
if [ "$FAIL" -ne 0 ];then exit 1;fi
echo 'PASS: Basic anti-slop source checks (visual review still required)'
