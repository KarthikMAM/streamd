/**
 * @streamd/cli — programmatic API for the streamd CLI.
 *
 * The executable itself lives at `src/bin/streamd.ts` and is shipped
 * as the `streamd` binary. The exports here let tests and library
 * consumers drive the same pipeline without spawning a child process.
 *
 * @module index
 */

export {
  buildParseOptions,
  buildPlugins,
  buildStreamOptions,
  buildThemeStyleBlock,
} from "./compose";
export { CLI_VERSION, HELP_TEXT } from "./help-text";
export { parseCliArgs } from "./parse-args";
export {
  commonPrefixLen,
  computeDelta,
  readAllStdin,
  resolveStreamMode,
  runNonStreaming,
  runStreaming,
} from "./pipeline";
export { run } from "./run";
export type { CliOptions, CliStreamMode, CliTheme, RunStreams } from "./types";
export type {
  StreamdCliArgumentErrorFields,
  StreamdCliArgumentErrorKind,
} from "./validation";
export { assertArgv, StreamdCliArgumentError } from "./validation";
