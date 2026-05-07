/**
 * @streamd/plugin-katex — KaTeX adapter for the streamd plugin pipeline.
 *
 * @module index
 */

export { katex } from "./katex";
export type { KatexDisplayMode, KatexPluginOptions } from "./types";
export {
  StreamdPluginKatexArgumentError,
  type StreamdPluginKatexArgumentErrorFields,
  type StreamdPluginKatexArgumentErrorKind,
} from "./validation";
