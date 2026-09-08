import type { Configuration } from "lint-staged"

export default {
  "*.md": ["markdownlint-cli2"],
  "*.{ts,tsx,css,json,jsonc}": ["oxfmt", "oxlint --fix"],
} satisfies Configuration
