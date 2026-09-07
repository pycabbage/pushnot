import type { Configuration } from "lint-staged"

export default {
  "*.md": ["markdownlint-cli2"],
  "*.{ts,tsx,css,json,jsonc,md}": ["oxfmt", "oxlint --fix"],
} satisfies Configuration
