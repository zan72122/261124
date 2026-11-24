#!/usr/bin/env bash
# Remaining Stability credits.
curl -sS -m 30 -H "Authorization: Bearer dummy" -H "Accept: application/json" https://api.stability.ai/v1/user/balance; echo
