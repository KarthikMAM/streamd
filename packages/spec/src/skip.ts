/**
 * Known spec divergences — tests skipped against reference output.
 *
 * Source of truth: `SKIP_METADATA`. Each cluster (a spec section, e.g.
 * "tabs", "block-quotes") carries:
 *
 * - `classification`: one of `documented-limitation` | `fixable` |
 *   `known-bug` | `under-investigation`.
 * - `notes`: one-sentence explanation of the divergence.
 * - `docLinkInParserDesign`: optional pointer into
 *   `.kiro/steering/parser-design.md` §11 Known Limitations.
 * - `trackingUrl`: optional ticket URL for `known-bug` clusters.
 *
 * Consumers that only need the runtime skip set (e.g. `spec.test.ts`)
 * read the flat `SKIP: Record<suite, Set<fixture>>` view, which is
 * derived from `SKIP_METADATA` at module load.
 *
 * Rebuild after any parser / renderer change:
 *
 *     node packages/spec/scripts/collect-failures.mjs --annotate --write
 *
 * Pass rate snapshot (CommonMark 0.31.2 / GFM 0.29):
 *   CommonMark: 436 / 655 = 66.6 %
 *   GFM:        437 / 733 = 59.6 %
 *
 * @module spec.skip
 */

/**
 * Classification buckets for a skipped cluster.
 *
 * @group Classification Policy
 *
 * - `documented-limitation` — divergence is an accepted trade-off and
 *   has a matching entry in `parser-design.md` §11. These are NOT bugs;
 *   they are intentional architectural decisions. Only add entries here
 *   when the parser-design doc explicitly acknowledges the divergence.
 * - `fixable` — divergence is a bug we intend to fix. Not in §11 yet.
 *   Add entries here when root cause is understood and a fix is scoped
 *   but not yet landed. Promote to `documented-limitation` if the fix
 *   is deferred indefinitely, or remove from skip entirely once fixed.
 * - `known-bug` — divergence is a bug that contradicts a design
 *   statement elsewhere in `parser-design.md` and has a tracking
 *   ticket. Every entry MUST have a `trackingUrl`. Promote to `fixable`
 *   once the ticket is actively being worked.
 * - `under-investigation` — root cause not yet diagnosed; needs a
 *   pass through `collect-failures.mjs` and manual triage. This is the
 *   default bucket for auto-generated entries. Promote to one of the
 *   above once root cause is identified.
 */
export type SkipClassification =
  | "documented-limitation"
  | "fixable"
  | "known-bug"
  | "under-investigation";

/**
 * Metadata attached to a single skip cluster.
 */
export interface SkipClusterAnnotation {
  /** Which classification bucket this cluster belongs to. */
  readonly classification: SkipClassification;
  /** One-sentence explanation of the divergence root cause. */
  readonly notes: string;
  /** Optional pointer into `parser-design.md` §11 Known Limitations. */
  readonly docLinkInParserDesign?: string;
  /** Optional tracking ticket URL; required when classification is `known-bug`. */
  readonly trackingUrl?: string;
}

/**
 * A skip cluster: annotation + the fixture names in the cluster.
 * Fixture names match the `.md`/`.html` basename in `fixtures/<suite>`.
 */
export interface SkipCluster {
  /** Classification and notes describing why these fixtures are skipped. */
  readonly annotation: SkipClusterAnnotation;
  /** Fixture basenames (e.g. `"0001--tabs"`) that belong to this cluster. */
  readonly examples: ReadonlyArray<string>;
}

/**
 * Structured skip data for one suite, keyed by spec section slug
 * (everything after `NNNN--` in the fixture basename).
 */
export interface SkipSuite {
  /** Map from spec-section slug (e.g. `"tabs"`, `"block-quotes"`) to its skip cluster. */
  readonly clusters: Readonly<Record<string, SkipCluster>>;
}

/**
 * Known suite keys. Must match directory names under
 * `packages/spec/fixtures/`.
 */
export type SuiteKey = "commonmark" | "gfm";

/**
 * Full annotated skip metadata — the single source of truth for all
 * known spec divergences. Edit here — do not hand-edit `SKIP` below.
 *
 * Keyed by suite (`"commonmark"` | `"gfm"`), each value contains
 * clusters grouped by spec section slug. The `collect-failures.mjs`
 * script auto-generates entries with `under-investigation`; manual
 * triage promotes them to the appropriate classification.
 */
export const SKIP_METADATA: Readonly<Record<SuiteKey, SkipSuite>> = {
  commonmark: {
    clusters: {
      tabs: {
        annotation: {
          classification: "fixable",
          notes:
            "Tab-stop expansion diverges from spec §2.2 for interactions between leading tabs and block-start detection (list items, indented code, blockquote prefixes).",
          docLinkInParserDesign: 'parser-design.md §11 "Tab expansion"',
        },
        examples: [
          "0001--tabs",
          "0002--tabs",
          "0003--tabs",
          "0004--tabs",
          "0005--tabs",
          "0006--tabs",
          "0007--tabs",
          "0008--tabs",
          "0009--tabs",
          "0010--tabs",
          "0011--tabs",
        ],
      },
      "backslash-escapes": {
        annotation: {
          classification: "under-investigation",
          notes:
            "Backslash-escape edge cases inside code spans / raw HTML need a separate triage pass.",
        },
        examples: [
          "0018--backslash-escapes",
          "0019--backslash-escapes",
          "0020--backslash-escapes",
          "0024--backslash-escapes",
        ],
      },
      "entity-and-numeric-character-references": {
        annotation: {
          classification: "documented-limitation",
          notes:
            "Named HTML entities are emitted as raw text; no HTML5 entity list check. Resolution is a renderer concern.",
          docLinkInParserDesign: 'parser-design.md §11 "Named HTML entities" + "Entity validation"',
        },
        examples: [
          "0028--entity-and-numeric-character-references",
          "0034--entity-and-numeric-character-references",
          "0036--entity-and-numeric-character-references",
          "0040--entity-and-numeric-character-references",
        ],
      },
      "thematic-breaks": {
        annotation: {
          classification: "fixable",
          notes:
            "Thematic-break detection misses a small set of setext-heading / list-marker interactions.",
        },
        examples: ["0048--thematic-breaks", "0060--thematic-breaks", "0061--thematic-breaks"],
      },
      "atx-headings": {
        annotation: {
          classification: "under-investigation",
          notes: "Auto-generated by collect-failures.mjs — classification pending manual triage.",
        },
        examples: ["0069--atx-headings"],
      },
      "setext-headings": {
        annotation: {
          classification: "known-bug",
          notes:
            "Setext promotion of preceding paragraphs diverges from §3.2 in edge cases (blank lines, multi-line underlines, interaction with lazy continuation).",
          trackingUrl: "https://github.com/KarthikMAM/streamd/issues/TODO-setext",
        },
        examples: [
          "0082--setext-headings",
          "0085--setext-headings",
          "0087--setext-headings",
          "0092--setext-headings",
          "0093--setext-headings",
          "0100--setext-headings",
          "0101--setext-headings",
        ],
      },
      "indented-code-blocks": {
        annotation: {
          classification: "fixable",
          notes:
            "Paragraph / indented-code boundary mis-detected in a couple of fixtures; narrow fix in the paragraph scanner.",
        },
        examples: [
          "0107--indented-code-blocks",
          "0108--indented-code-blocks",
          "0109--indented-code-blocks",
          "0110--indented-code-blocks",
          "0111--indented-code-blocks",
          "0112--indented-code-blocks",
          "0114--indented-code-blocks",
          "0115--indented-code-blocks",
          "0116--indented-code-blocks",
          "0117--indented-code-blocks",
          "0118--indented-code-blocks",
        ],
      },
      "fenced-code-blocks": {
        annotation: {
          classification: "under-investigation",
          notes: "Auto-generated by collect-failures.mjs — classification pending manual triage.",
        },
        examples: [
          "0119--fenced-code-blocks",
          "0120--fenced-code-blocks",
          "0122--fenced-code-blocks",
          "0123--fenced-code-blocks",
          "0124--fenced-code-blocks",
          "0125--fenced-code-blocks",
          "0126--fenced-code-blocks",
          "0127--fenced-code-blocks",
          "0128--fenced-code-blocks",
          "0129--fenced-code-blocks",
          "0130--fenced-code-blocks",
          "0131--fenced-code-blocks",
          "0132--fenced-code-blocks",
          "0133--fenced-code-blocks",
          "0134--fenced-code-blocks",
          "0135--fenced-code-blocks",
          "0136--fenced-code-blocks",
          "0137--fenced-code-blocks",
          "0139--fenced-code-blocks",
          "0140--fenced-code-blocks",
          "0141--fenced-code-blocks",
          "0142--fenced-code-blocks",
          "0143--fenced-code-blocks",
          "0144--fenced-code-blocks",
          "0146--fenced-code-blocks",
          "0147--fenced-code-blocks",
        ],
      },
      "html-blocks": {
        annotation: {
          classification: "fixable",
          notes:
            "Two HTML block type edge cases involving nested tags / case sensitivity fall through the current type-1..7 dispatch.",
        },
        examples: [
          "0148--html-blocks",
          "0169--html-blocks",
          "0185--html-blocks",
          "0186--html-blocks",
          "0193--html-blocks",
        ],
      },
      "link-reference-definitions": {
        annotation: {
          classification: "documented-limitation",
          notes:
            "Link reference definitions declared after the referencing paragraph don't retroactively resolve; streaming trade-off.",
          docLinkInParserDesign: 'parser-design.md §11 "Forward reference resolution"',
        },
        examples: [
          "0195--link-reference-definitions",
          "0196--link-reference-definitions",
          "0197--link-reference-definitions",
          "0199--link-reference-definitions",
          "0203--link-reference-definitions",
          "0204--link-reference-definitions",
          "0211--link-reference-definitions",
          "0213--link-reference-definitions",
          "0214--link-reference-definitions",
          "0217--link-reference-definitions",
          "0218--link-reference-definitions",
          "0219--link-reference-definitions",
          "0220--link-reference-definitions",
        ],
      },
      paragraphs: {
        annotation: {
          classification: "under-investigation",
          notes: "Auto-generated by collect-failures.mjs — classification pending manual triage.",
        },
        examples: ["0227--paragraphs"],
      },
      "block-quotes": {
        annotation: {
          classification: "documented-limitation",
          notes:
            "Blockquote lazy continuation is approximate — any non-blank, non-block-start line continues, per the flat-scan architecture trade-off.",
          docLinkInParserDesign: 'parser-design.md §11 "Blockquote lazy continuation"',
        },
        examples: [
          "0233--block-quotes",
          "0236--block-quotes",
          "0237--block-quotes",
          "0238--block-quotes",
          "0239--block-quotes",
          "0240--block-quotes",
          "0244--block-quotes",
          "0248--block-quotes",
          "0251--block-quotes",
          "0254--block-quotes",
        ],
      },
      "list-items": {
        annotation: {
          classification: "under-investigation",
          notes:
            "List-item start detection, marker-width handling, and tight/loose classification diverge from §5.2 in roughly a third of list-item fixtures; scope of the divergence needs triage.",
          docLinkInParserDesign: 'parser-design.md §11 "List-item edge cases"',
        },
        examples: [
          "0255--list-items",
          "0256--list-items",
          "0258--list-items",
          "0259--list-items",
          "0260--list-items",
          "0261--list-items",
          "0264--list-items",
          "0265--list-items",
          "0266--list-items",
          "0272--list-items",
          "0273--list-items",
          "0274--list-items",
          "0275--list-items",
          "0276--list-items",
          "0279--list-items",
          "0280--list-items",
          "0281--list-items",
          "0282--list-items",
          "0283--list-items",
          "0285--list-items",
          "0286--list-items",
          "0288--list-items",
          "0289--list-items",
          "0290--list-items",
          "0291--list-items",
          "0292--list-items",
          "0294--list-items",
          "0295--list-items",
          "0296--list-items",
          "0297--list-items",
          "0298--list-items",
          "0299--list-items",
          "0300--list-items",
          "0301--list-items",
          "0302--list-items",
        ],
      },
      lists: {
        annotation: {
          classification: "under-investigation",
          notes: "Same root cause as list-items — list-level tight/loose + nesting diverges.",
          docLinkInParserDesign: 'parser-design.md §11 "List-item edge cases"',
        },
        examples: [
          "0304--lists",
          "0306--lists",
          "0308--lists",
          "0309--lists",
          "0311--lists",
          "0312--lists",
          "0313--lists",
          "0314--lists",
          "0315--lists",
          "0316--lists",
          "0317--lists",
          "0318--lists",
          "0319--lists",
          "0320--lists",
          "0321--lists",
          "0322--lists",
          "0323--lists",
          "0325--lists",
          "0326--lists",
          "0327--lists",
          "0328--lists",
        ],
      },
      "code-spans": {
        annotation: {
          classification: "under-investigation",
          notes:
            "Code-span content normalization for multi-backtick openers / leading-space trimming needs review.",
        },
        examples: ["0344--code-spans", "0346--code-spans", "0348--code-spans", "0349--code-spans"],
      },
      "emphasis-and-strong-emphasis": {
        annotation: {
          classification: "under-investigation",
          notes:
            "Delimiter-resolution edge cases (rule of three, intraword `_`, nested emphasis with mixed runs) diverge — concentrated in the opener-bottom branches of the Appendix algorithm.",
        },
        examples: [
          "0356--emphasis-and-strong-emphasis",
          "0393--emphasis-and-strong-emphasis",
          "0399--emphasis-and-strong-emphasis",
          "0411--emphasis-and-strong-emphasis",
          "0418--emphasis-and-strong-emphasis",
          "0419--emphasis-and-strong-emphasis",
          "0421--emphasis-and-strong-emphasis",
          "0433--emphasis-and-strong-emphasis",
          "0435--emphasis-and-strong-emphasis",
          "0445--emphasis-and-strong-emphasis",
          "0449--emphasis-and-strong-emphasis",
          "0457--emphasis-and-strong-emphasis",
          "0461--emphasis-and-strong-emphasis",
          "0466--emphasis-and-strong-emphasis",
          "0467--emphasis-and-strong-emphasis",
          "0468--emphasis-and-strong-emphasis",
          "0469--emphasis-and-strong-emphasis",
          "0470--emphasis-and-strong-emphasis",
        ],
      },
      links: {
        annotation: {
          classification: "under-investigation",
          notes:
            "Link parsing diverges on reference / collapsed / shortcut forms and on links containing nested brackets or escapes; some overlap with the link-reference-definitions cluster.",
        },
        examples: [
          "0504--links",
          "0506--links",
          "0509--links",
          "0517--links",
          "0518--links",
          "0519--links",
          "0520--links",
          "0521--links",
          "0522--links",
          "0526--links",
          "0527--links",
          "0528--links",
          "0531--links",
          "0532--links",
          "0533--links",
          "0534--links",
          "0535--links",
          "0538--links",
          "0539--links",
          "0540--links",
          "0542--links",
          "0549--links",
          "0550--links",
          "0552--links",
          "0556--links",
          "0560--links",
          "0561--links",
          "0573--links",
        ],
      },
      images: {
        annotation: {
          classification: "under-investigation",
          notes: "Image parsing shares code paths with links; same root causes apply.",
        },
        examples: [
          "0575--images",
          "0576--images",
          "0577--images",
          "0578--images",
          "0579--images",
          "0587--images",
          "0591--images",
          "0592--images",
        ],
      },
      autolinks: {
        annotation: {
          classification: "under-investigation",
          notes: "A handful of autolink URL-validation fixtures diverge; narrow scope.",
        },
        examples: ["0605--autolinks", "0611--autolinks"],
      },
      "raw-html": {
        annotation: {
          classification: "under-investigation",
          notes: "Inline raw-HTML tag parsing misses CDATA / comment / PI edge cases.",
        },
        examples: [
          "0615--raw-html",
          "0616--raw-html",
          "0617--raw-html",
          "0618--raw-html",
          "0624--raw-html",
          "0625--raw-html",
          "0628--raw-html",
        ],
      },
    },
  },
  gfm: {
    clusters: {
      tabs: {
        annotation: {
          classification: "fixable",
          notes: "Same root cause as CommonMark tabs cluster.",
          docLinkInParserDesign: 'parser-design.md §11 "Tab expansion"',
        },
        examples: [
          "0001--tabs",
          "0002--tabs",
          "0003--tabs",
          "0004--tabs",
          "0005--tabs",
          "0006--tabs",
          "0007--tabs",
          "0008--tabs",
          "0009--tabs",
          "0010--tabs",
          "0011--tabs",
        ],
      },
      "thematic-breaks": {
        annotation: {
          classification: "fixable",
          notes: "Same root cause as CommonMark thematic-breaks cluster.",
        },
        examples: ["0018--thematic-breaks", "0030--thematic-breaks", "0031--thematic-breaks"],
      },
      "atx-headings": {
        annotation: {
          classification: "under-investigation",
          notes: "Auto-generated by collect-failures.mjs — classification pending manual triage.",
        },
        examples: ["0039--atx-headings"],
      },
      "setext-headings": {
        annotation: {
          classification: "known-bug",
          notes: "Same root cause as CommonMark setext-headings cluster.",
          trackingUrl: "https://github.com/KarthikMAM/streamd/issues/TODO-setext",
        },
        examples: [
          "0052--setext-headings",
          "0055--setext-headings",
          "0057--setext-headings",
          "0058--setext-headings",
          "0062--setext-headings",
          "0063--setext-headings",
          "0070--setext-headings",
          "0071--setext-headings",
        ],
      },
      "indented-code-blocks": {
        annotation: {
          classification: "fixable",
          notes: "Same root cause as CommonMark indented-code-blocks cluster.",
        },
        examples: [
          "0077--indented-code-blocks",
          "0078--indented-code-blocks",
          "0079--indented-code-blocks",
          "0080--indented-code-blocks",
          "0081--indented-code-blocks",
          "0082--indented-code-blocks",
          "0084--indented-code-blocks",
          "0085--indented-code-blocks",
          "0086--indented-code-blocks",
          "0087--indented-code-blocks",
          "0088--indented-code-blocks",
        ],
      },
      "fenced-code-blocks": {
        annotation: {
          classification: "under-investigation",
          notes: "Auto-generated by collect-failures.mjs — classification pending manual triage.",
        },
        examples: [
          "0089--fenced-code-blocks",
          "0090--fenced-code-blocks",
          "0092--fenced-code-blocks",
          "0093--fenced-code-blocks",
          "0094--fenced-code-blocks",
          "0095--fenced-code-blocks",
          "0096--fenced-code-blocks",
          "0097--fenced-code-blocks",
          "0098--fenced-code-blocks",
          "0099--fenced-code-blocks",
          "0100--fenced-code-blocks",
          "0101--fenced-code-blocks",
          "0102--fenced-code-blocks",
          "0103--fenced-code-blocks",
          "0104--fenced-code-blocks",
          "0105--fenced-code-blocks",
          "0106--fenced-code-blocks",
          "0107--fenced-code-blocks",
          "0109--fenced-code-blocks",
          "0110--fenced-code-blocks",
          "0111--fenced-code-blocks",
          "0112--fenced-code-blocks",
          "0113--fenced-code-blocks",
          "0114--fenced-code-blocks",
          "0116--fenced-code-blocks",
          "0117--fenced-code-blocks",
        ],
      },
      "html-blocks": {
        annotation: {
          classification: "fixable",
          notes: "Same root cause as CommonMark html-blocks cluster.",
        },
        examples: [
          "0118--html-blocks",
          "0138--html-blocks",
          "0152--html-blocks",
          "0153--html-blocks",
          "0160--html-blocks",
        ],
      },
      "link-reference-definitions": {
        annotation: {
          classification: "documented-limitation",
          notes: "Forward reference resolution — same trade-off as CommonMark suite.",
          docLinkInParserDesign: 'parser-design.md §11 "Forward reference resolution"',
        },
        examples: [
          "0162--link-reference-definitions",
          "0163--link-reference-definitions",
          "0164--link-reference-definitions",
          "0166--link-reference-definitions",
          "0170--link-reference-definitions",
          "0171--link-reference-definitions",
          "0178--link-reference-definitions",
          "0180--link-reference-definitions",
          "0181--link-reference-definitions",
          "0184--link-reference-definitions",
          "0185--link-reference-definitions",
          "0186--link-reference-definitions",
          "0187--link-reference-definitions",
        ],
      },
      paragraphs: {
        annotation: {
          classification: "under-investigation",
          notes: "Auto-generated by collect-failures.mjs — classification pending manual triage.",
        },
        examples: ["0195--paragraphs"],
      },
      "tables-extension": {
        annotation: {
          classification: "under-investigation",
          notes:
            "Table separator validation + alignment-cell rendering diverge from the GFM extension in a few fixtures.",
        },
        examples: [
          "0198--tables-extension",
          "0199--tables-extension",
          "0200--tables-extension",
          "0201--tables-extension",
          "0202--tables-extension",
          "0203--tables-extension",
          "0204--tables-extension",
          "0205--tables-extension",
        ],
      },
      "block-quotes": {
        annotation: {
          classification: "documented-limitation",
          notes: "Blockquote lazy continuation — same trade-off as CommonMark suite.",
          docLinkInParserDesign: 'parser-design.md §11 "Blockquote lazy continuation"',
        },
        examples: [
          "0209--block-quotes",
          "0212--block-quotes",
          "0213--block-quotes",
          "0214--block-quotes",
          "0215--block-quotes",
          "0216--block-quotes",
          "0220--block-quotes",
          "0224--block-quotes",
          "0227--block-quotes",
          "0230--block-quotes",
        ],
      },
      "list-items": {
        annotation: {
          classification: "under-investigation",
          notes: "Same root cause as CommonMark list-items cluster.",
          docLinkInParserDesign: 'parser-design.md §11 "List-item edge cases"',
        },
        examples: [
          "0231--list-items",
          "0232--list-items",
          "0234--list-items",
          "0235--list-items",
          "0236--list-items",
          "0237--list-items",
          "0240--list-items",
          "0241--list-items",
          "0242--list-items",
          "0248--list-items",
          "0249--list-items",
          "0250--list-items",
          "0251--list-items",
          "0252--list-items",
          "0255--list-items",
          "0256--list-items",
          "0257--list-items",
          "0258--list-items",
          "0259--list-items",
          "0261--list-items",
          "0262--list-items",
          "0264--list-items",
          "0265--list-items",
          "0266--list-items",
          "0267--list-items",
          "0268--list-items",
          "0270--list-items",
          "0271--list-items",
          "0272--list-items",
          "0273--list-items",
          "0274--list-items",
          "0275--list-items",
          "0276--list-items",
          "0277--list-items",
          "0278--list-items",
        ],
      },
      "task-list-items-extension": {
        annotation: {
          classification: "under-investigation",
          notes: "Single task-list fixture diverges; interaction with list-item cluster.",
        },
        examples: ["0279--task-list-items-extension", "0280--task-list-items-extension"],
      },
      lists: {
        annotation: {
          classification: "under-investigation",
          notes: "Same root cause as CommonMark lists cluster.",
          docLinkInParserDesign: 'parser-design.md §11 "List-item edge cases"',
        },
        examples: [
          "0282--lists",
          "0284--lists",
          "0286--lists",
          "0287--lists",
          "0289--lists",
          "0290--lists",
          "0291--lists",
          "0292--lists",
          "0293--lists",
          "0294--lists",
          "0295--lists",
          "0296--lists",
          "0297--lists",
          "0298--lists",
          "0299--lists",
          "0300--lists",
          "0301--lists",
          "0303--lists",
          "0304--lists",
          "0305--lists",
          "0306--lists",
        ],
      },
      "backslash-escapes": {
        annotation: {
          classification: "under-investigation",
          notes: "Same root cause as CommonMark backslash-escapes cluster.",
        },
        examples: [
          "0314--backslash-escapes",
          "0315--backslash-escapes",
          "0316--backslash-escapes",
          "0320--backslash-escapes",
        ],
      },
      "entity-and-numeric-character-references": {
        annotation: {
          classification: "documented-limitation",
          notes: "Same trade-off as CommonMark suite.",
          docLinkInParserDesign: 'parser-design.md §11 "Named HTML entities" + "Entity validation"',
        },
        examples: [
          "0330--entity-and-numeric-character-references",
          "0332--entity-and-numeric-character-references",
          "0336--entity-and-numeric-character-references",
        ],
      },
      "code-spans": {
        annotation: {
          classification: "under-investigation",
          notes: "Same root cause as CommonMark code-spans cluster.",
        },
        examples: ["0352--code-spans", "0354--code-spans", "0356--code-spans", "0357--code-spans"],
      },
      "emphasis-and-strong-emphasis": {
        annotation: {
          classification: "under-investigation",
          notes: "Same root cause as CommonMark emphasis cluster.",
        },
        examples: [
          "0398--emphasis-and-strong-emphasis",
          "0400--emphasis-and-strong-emphasis",
          "0406--emphasis-and-strong-emphasis",
          "0418--emphasis-and-strong-emphasis",
          "0425--emphasis-and-strong-emphasis",
          "0426--emphasis-and-strong-emphasis",
          "0428--emphasis-and-strong-emphasis",
          "0434--emphasis-and-strong-emphasis",
          "0435--emphasis-and-strong-emphasis",
          "0436--emphasis-and-strong-emphasis",
          "0440--emphasis-and-strong-emphasis",
          "0442--emphasis-and-strong-emphasis",
          "0452--emphasis-and-strong-emphasis",
          "0456--emphasis-and-strong-emphasis",
          "0464--emphasis-and-strong-emphasis",
          "0468--emphasis-and-strong-emphasis",
          "0473--emphasis-and-strong-emphasis",
          "0474--emphasis-and-strong-emphasis",
          "0475--emphasis-and-strong-emphasis",
          "0476--emphasis-and-strong-emphasis",
          "0477--emphasis-and-strong-emphasis",
        ],
      },
      links: {
        annotation: {
          classification: "under-investigation",
          notes: "Same root cause as CommonMark links cluster.",
        },
        examples: [
          "0510--links",
          "0512--links",
          "0515--links",
          "0523--links",
          "0524--links",
          "0525--links",
          "0526--links",
          "0527--links",
          "0528--links",
          "0532--links",
          "0533--links",
          "0534--links",
          "0537--links",
          "0538--links",
          "0539--links",
          "0540--links",
          "0541--links",
          "0544--links",
          "0545--links",
          "0546--links",
          "0555--links",
          "0556--links",
          "0558--links",
          "0562--links",
          "0566--links",
          "0567--links",
          "0579--links",
        ],
      },
      images: {
        annotation: {
          classification: "under-investigation",
          notes: "Same root cause as CommonMark images cluster.",
        },
        examples: [
          "0581--images",
          "0582--images",
          "0583--images",
          "0584--images",
          "0585--images",
          "0593--images",
          "0597--images",
          "0598--images",
        ],
      },
      autolinks: {
        annotation: {
          classification: "under-investigation",
          notes: "Same root cause as CommonMark autolinks cluster.",
        },
        examples: [
          "0610--autolinks",
          "0611--autolinks",
          "0616--autolinks",
          "0617--autolinks",
          "0619--autolinks",
          "0691--autolinks",
          "0692--autolinks",
        ],
      },
      "autolinks-extension": {
        annotation: {
          classification: "under-investigation",
          notes:
            "GFM extended autolinks (bare URL / www / mail) diverge on several edge cases around trailing punctuation and entity-boundary detection.",
        },
        examples: [
          "0623--autolinks-extension",
          "0624--autolinks-extension",
          "0626--autolinks-extension",
          "0627--autolinks-extension",
          "0628--autolinks-extension",
          "0629--autolinks-extension",
          "0630--autolinks-extension",
          "0631--autolinks-extension",
        ],
      },
      "raw-html": {
        annotation: {
          classification: "under-investigation",
          notes: "Same root cause as CommonMark raw-html cluster.",
        },
        examples: [
          "0632--raw-html",
          "0633--raw-html",
          "0634--raw-html",
          "0635--raw-html",
          "0641--raw-html",
          "0642--raw-html",
          "0645--raw-html",
        ],
      },
      "disallowed-raw-html-extension": {
        annotation: {
          classification: "fixable",
          notes:
            "Disallowed-raw-HTML filter (GFM §6.11) not implemented — parser emits all raw HTML tags unfiltered.",
        },
        examples: ["0652--disallowed-raw-html-extension"],
      },
      tables: {
        annotation: {
          classification: "under-investigation",
          notes: "GFM tables regression — single fixture.",
        },
        examples: [
          "0673--tables",
          "0674--tables",
          "0675--tables",
          "0676--tables",
          "0677--tables",
          "0678--tables",
          "0703--tables",
        ],
      },
      "table-cell-count-mismatches": {
        annotation: {
          classification: "under-investigation",
          notes: "Table cell-count mismatch handling diverges from cmark-gfm regression fixture.",
        },
        examples: ["0679--table-cell-count-mismatches", "0680--table-cell-count-mismatches"],
      },
      "embedded-pipes": {
        annotation: {
          classification: "under-investigation",
          notes: "Embedded pipes inside code-spans / emphasis within table cells need triage.",
        },
        examples: ["0681--embedded-pipes"],
      },
      "oddly-formatted-markers": {
        annotation: {
          classification: "under-investigation",
          notes: "Auto-generated by collect-failures.mjs — classification pending manual triage.",
        },
        examples: ["0682--oddly-formatted-markers"],
      },
      escaping: {
        annotation: {
          classification: "under-investigation",
          notes: "Table-cell escaping of `|` via backslash diverges on one regression fixture.",
        },
        examples: ["0683--escaping"],
      },
      "embedded-html": {
        annotation: {
          classification: "under-investigation",
          notes: "Auto-generated by collect-failures.mjs — classification pending manual triage.",
        },
        examples: ["0684--embedded-html"],
      },
      "reference-style-links": {
        annotation: {
          classification: "under-investigation",
          notes: "Auto-generated by collect-failures.mjs — classification pending manual triage.",
        },
        examples: ["0685--reference-style-links"],
      },
      "sequential-cells": {
        annotation: {
          classification: "under-investigation",
          notes: "Auto-generated by collect-failures.mjs — classification pending manual triage.",
        },
        examples: ["0686--sequential-cells"],
      },
      "interaction-with-emphasis": {
        annotation: {
          classification: "under-investigation",
          notes: "Emphasis / table interaction regression.",
        },
        examples: ["0687--interaction-with-emphasis"],
      },
      "a-table-can-be-recognised-when-separated-from-a-paragraph-of-text-without-an-empty-line": {
        annotation: {
          classification: "under-investigation",
          notes:
            "GFM regression: table following a paragraph without blank line is not recognised.",
        },
        examples: [
          "0688--a-table-can-be-recognised-when-separated-from-a-paragraph-of-text-without-an-empty-line",
        ],
      },
      strikethroughs: {
        annotation: {
          classification: "under-investigation",
          notes: "GFM strikethrough (`~~`) delimiter pairing diverges on two regression fixtures.",
        },
        examples: ["0689--strikethroughs", "0690--strikethroughs"],
      },
      "html-tag-filter": {
        annotation: {
          classification: "fixable",
          notes:
            "GFM raw-HTML tag filter (§6.11) not implemented; disallowed tags (`<iframe>`, `<script>`, …) pass through.",
        },
        examples: ["0694--html-tag-filter"],
      },
      footnotes: {
        annotation: {
          classification: "fixable",
          notes:
            "GFM footnotes extension not implemented — `[^id]` references and `[^id]:` definitions are not recognised.",
        },
        examples: ["0695--footnotes"],
      },
      "when-a-footnote-is-used-multiple-times-we-insert-multiple-backrefs": {
        annotation: {
          classification: "under-investigation",
          notes: "Auto-generated by collect-failures.mjs — classification pending manual triage.",
        },
        examples: ["0696--when-a-footnote-is-used-multiple-times-we-insert-multiple-backrefs"],
      },
      "footnote-reference-labels-are-href-escaped": {
        annotation: {
          classification: "under-investigation",
          notes: "Auto-generated by collect-failures.mjs — classification pending manual triage.",
        },
        examples: ["0697--footnote-reference-labels-are-href-escaped"],
      },
      interop: {
        annotation: {
          classification: "under-investigation",
          notes: "Cross-extension interop regression.",
        },
        examples: ["0698--interop", "0699--interop"],
      },
      "task-lists": {
        annotation: {
          classification: "under-investigation",
          notes:
            "GFM task-list regression fixtures fail — same checkbox-in-list interaction as task-list-items-extension cluster.",
        },
        examples: ["0700--task-lists", "0701--task-lists", "0702--task-lists"],
      },
      "full-info-string": {
        annotation: {
          classification: "under-investigation",
          notes:
            "GFM fenced-code full-info-string extension: multi-word info strings not round-tripped.",
        },
        examples: [
          "0704--full-info-string",
          "0705--full-info-string",
          "0706--full-info-string",
          "0707--full-info-string",
        ],
      },
      "regression-tests": {
        annotation: {
          classification: "under-investigation",
          notes:
            "Miscellaneous cmark-gfm regression fixtures; root causes overlap with list-items, emphasis, and table clusters.",
        },
        examples: [
          "0708--regression-tests",
          "0709--regression-tests",
          "0711--regression-tests",
          "0712--regression-tests",
          "0714--regression-tests",
          "0715--regression-tests",
          "0716--regression-tests",
          "0717--regression-tests",
          "0718--regression-tests",
          "0720--regression-tests",
          "0721--regression-tests",
          "0722--regression-tests",
          "0723--regression-tests",
          "0726--regression-tests",
          "0727--regression-tests",
          "0728--regression-tests",
          "0729--regression-tests",
          "0730--regression-tests",
          "0731--regression-tests",
        ],
      },
    },
  },
};

/**
 * Flattens a `SkipSuite` into the raw set of fixture names used by
 * `spec.test.ts` for `.skip` dispatch. Stable across calls.
 *
 * @param suite - Structured skip data containing clusters of fixture names.
 * @returns Deduplicated set of all fixture basenames in the suite.
 */
function flattenSuite(suite: SkipSuite): Set<string> {
  const out = new Set<string>();
  for (const cluster of Object.values(suite.clusters)) {
    for (const example of cluster.examples) out.add(example);
  }
  return out;
}

/**
 * Runtime skip view — flat `Set<fixture>` per suite, derived from
 * `SKIP_METADATA` at module load. Consumed by `spec.test.ts` for
 * `.skip` dispatch via `SKIP[skipKey].has(fixtureName)`.
 */
export const SKIP: Record<SuiteKey, Set<string>> = {
  commonmark: flattenSuite(SKIP_METADATA.commonmark),
  gfm: flattenSuite(SKIP_METADATA.gfm),
};
