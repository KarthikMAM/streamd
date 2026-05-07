# streamd demo

A **streaming-first** markdown parser with renderers for HTML, React, and React Native.

## Features

- CommonMark 0.31.2 support
- GFM extensions: tables, strikethrough, task lists, autolinks
- Zero-dependency, incremental parsing
- Framework-agnostic token tree

## Example code

```ts
import { parse } from "@streamd/parser";
import { renderHtml } from "@streamd/html";

const result = parse("# hello **world**");
console.log(renderHtml(result.tokens));
```

## Inline styles

You can use *italic*, **bold**, ~~strikethrough~~, and `inline code`. Math works with `$e = mc^2$` when enabled.

## Quote

> The best way to predict the future is to invent it.
> — Alan Kay

## Task list

- [x] Parser
- [x] HTML renderer
- [x] React renderer
- [x] React Native renderer
- [ ] Vue adapter

## Table

| Feature | HTML | React | RN |
| :-- | :-: | :-: | :-: |
| Streaming | ✅ | ✅ | ✅ |
| Theming | ✅ | ✅ | ✅ |
| GFM | ✅ | ✅ | ✅ |

## Link

Visit [streamd on GitHub](https://github.com/KarthikMAM/streamd) for the source.
