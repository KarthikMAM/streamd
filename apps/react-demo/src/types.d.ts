/**
 * Ambient module declarations for non-code imports used by Vite's
 * `?raw` query suffix.
 *
 * @module apps/react-demo/src/types.d
 */

/** Vite raw-import: resolves `import x from "file?raw"` to a UTF-8 string. */
declare module "*?raw" {
  /** The file's full UTF-8 content as a string. */
  const content: string;
  export default content;
}
