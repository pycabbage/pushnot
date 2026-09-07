import type { Configuration } from "lint-staged"

export default {
  "*.{ts,tsx,css,json,jsonc,md}": ["oxfmt", "oxlint --fix"],
} satisfies Configuration
