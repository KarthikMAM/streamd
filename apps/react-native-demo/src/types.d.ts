/**
 * Ambient module declarations for non-code imports used by the demo app.
 *
 * @module apps/react-native-demo/src/types.d
 */

/** Vite `?raw` suffix import — resolves to the file's UTF-8 text content at build time. */
declare module "*?raw" {
  /** The full file content as a UTF-8 string. */
  const content: string;
  export default content;
}
