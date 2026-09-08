import type { Configuration } from "lint-staged"

export default {
  "*.md": ["markdownlint-cli2"],
  "*.{ts,tsx,css,json,jsonc}": [
    "oxfmt --no-error-on-unmatched-pattern",
    "oxlint --no-error-on-unmatched-pattern --fix",
  ],
} satisfies Configuration
