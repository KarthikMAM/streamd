/**
 * Help text + version string for `@streamd/cli`.
 *
 * The version is mirrored from `package.json` and asserted in
 * `help-text.test.ts` so drift between the two fails loudly.
 *
 * @module help-text
 */

/** Version emitted by `streamd --version`. Mirror of package.json. */
export const CLI_VERSION = "0.1.0";

/**
 * Help text emitted by `streamd --help`.
 *
 * Kept as a single exported string so tests can snapshot it and the
 * `run()` function can write it to stdout without extra formatting.
 */
export const HELP_TEXT = `streamd — stream markdown through @streamd/parser + @streamd/html

Usage:
  streamd [options] < input.md > output.html
  echo '# hello' | streamd

Options:
  --gfm / --no-gfm          Enable GFM (tables, strike, task lists, autolinks). Default: off
  --math                    Enable math ($...$ inline, $$...$$ block). Default: off
  --class-prefix <str>      Add class="<prefix>-<kind>" to every block tag
  --theme <light|dark|none> Prepend a <style> block with CSS vars + rules. Default: none
  --anchors                 Add stable id attributes to headings
  --link-attrs              Add rel/target to external links
  --sanitize / --no-sanitize
                            Apply the default-strict sanitize() plugin. Default: on
  --allow-dangerous-meta-html
                            Honour meta.html emitted by plugins. Requires trusted plugins.
  --stream <auto|delta|full|off>
                            Streaming mode. auto picks delta for pipes and off for a TTY.
                            delta = write common-prefix additions. full = write full HTML each chunk.
                            Default: auto
  --wrap-root               Wrap output in <div class="<prefix>-root">. Requires --class-prefix.
  --xhtml / --no-xhtml      Emit XHTML-style void tags. Default: on
  -v, --version             Print version and exit
  -h, --help                Print this help and exit

Exit codes:
  0   success
  1   runtime error during parse/render/write
  2   argument error (bad flag, bad value, conflicting flags)
  130 received SIGINT
  143 received SIGTERM
`;
