---
"@streamd/spec": patch
---

Rebuilt conformance skip list for parser schema 2 (structural refactor ADR 0004).

- Skip set rebuilt from scratch against the new parser output.
- 46 HTML-block fixtures pinned as `documented-limitation` (HtmlBlock removed).
- 16 inline-HTML fixtures pinned as `documented-limitation` (HtmlInline removed).
- 2 soft-line-break fixtures pinned as `documented-limitation` (Softbreak removed).
- Pre-existing divergences (tabs, fenced-code, lists, emphasis, links, etc.) carried forward with original classifications where still failing; removed where now passing.
- Pass rates: CommonMark 283/655 (43.2%), GFM 297/733 (40.5%).
