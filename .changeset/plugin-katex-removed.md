---
"@streamd/plugins": minor
---

`@streamd/plugin-katex` is no longer part of the monorepo. Math
rendering is a component-layer concern — the parser emits
`MathBlock` / `MathInline` tokens with raw TeX as `content`, and
consumers supply a `components.math_block` /
`components.math_inline` override that calls KaTeX directly. See
the math recipe in the docs site for the pattern.
