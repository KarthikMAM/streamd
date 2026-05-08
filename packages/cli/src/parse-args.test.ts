/**
 * Unit tests for `parseCliArgs`.
 *
 * Exhaustively covers every flag accepted by the CLI, default values,
 * conflicting-flag detection, and Node parseArgs error mapping.
 *
 * @module parse-args.test
 */

import { describe, expect, it } from "vitest";
import { parseCliArgs } from "./parse-args";
import { StreamdCliArgumentError } from "./validation";

describe("parseCliArgs — defaults", () => {
  it("returns fully-populated CliOptions for empty argv", () => {
    const opts = parseCliArgs([]);
    expect(opts).toStrictEqual({
      gfm: false,
      math: false,
      classPrefix: "",
      theme: "none",
      anchors: false,
      linkAttrs: false,
      sanitize: true,
      allowDangerousMetaHtml: false,
      stream: "auto",
      wrapRoot: false,
      xhtml: true,
      help: false,
      version: false,
    });
  });
});

describe("parseCliArgs — gfm", () => {
  it("--gfm sets gfm true", () => {
    expect(parseCliArgs(["--gfm"]).gfm).toBe(true);
  });

  it("--no-gfm keeps gfm false (explicit)", () => {
    expect(parseCliArgs(["--no-gfm"]).gfm).toBe(false);
  });

  it("--gfm --no-gfm throws conflicting-flag", () => {
    expectArgError(["--gfm", "--no-gfm"], "conflicting-flag");
  });
});

describe("parseCliArgs — math", () => {
  it("--math toggles math on", () => {
    expect(parseCliArgs(["--math"]).math).toBe(true);
  });
});

describe("parseCliArgs — class-prefix", () => {
  it("accepts a non-empty value", () => {
    expect(parseCliArgs(["--class-prefix", "md"]).classPrefix).toBe("md");
  });

  it("rejects an empty value with empty-class-prefix", () => {
    expectArgError(["--class-prefix", ""], "empty-class-prefix");
  });

  it("missing value surfaces as missing-value", () => {
    expectArgError(["--class-prefix"], "missing-value");
  });
});

describe("parseCliArgs — theme", () => {
  it("accepts 'light'", () => {
    expect(parseCliArgs(["--theme", "light"]).theme).toBe("light");
  });

  it("accepts 'dark'", () => {
    expect(parseCliArgs(["--theme", "dark"]).theme).toBe("dark");
  });

  it("accepts 'none'", () => {
    expect(parseCliArgs(["--theme", "none"]).theme).toBe("none");
  });

  it("rejects unknown values with unknown-theme", () => {
    expectArgError(["--theme", "oledblack"], "unknown-theme");
  });
});

describe("parseCliArgs — anchors and link-attrs", () => {
  it("--anchors flips the flag", () => {
    expect(parseCliArgs(["--anchors"]).anchors).toBe(true);
  });

  it("--link-attrs flips the flag", () => {
    expect(parseCliArgs(["--link-attrs"]).linkAttrs).toBe(true);
  });
});

describe("parseCliArgs — sanitize", () => {
  it("default is true", () => {
    expect(parseCliArgs([]).sanitize).toBe(true);
  });

  it("--no-sanitize turns it off", () => {
    expect(parseCliArgs(["--no-sanitize"]).sanitize).toBe(false);
  });

  it("--sanitize --no-sanitize throws conflicting-flag", () => {
    expectArgError(["--sanitize", "--no-sanitize"], "conflicting-flag");
  });
});

describe("parseCliArgs — allow-dangerous-meta-html", () => {
  it("defaults to false", () => {
    expect(parseCliArgs([]).allowDangerousMetaHtml).toBe(false);
  });

  it("--allow-dangerous-meta-html sets it to true", () => {
    expect(parseCliArgs(["--allow-dangerous-meta-html"]).allowDangerousMetaHtml).toBe(true);
  });
});

describe("parseCliArgs — stream", () => {
  it("accepts 'auto'", () => {
    expect(parseCliArgs(["--stream", "auto"]).stream).toBe("auto");
  });

  it("accepts 'delta'", () => {
    expect(parseCliArgs(["--stream", "delta"]).stream).toBe("delta");
  });

  it("accepts 'full'", () => {
    expect(parseCliArgs(["--stream", "full"]).stream).toBe("full");
  });

  it("accepts 'off'", () => {
    expect(parseCliArgs(["--stream", "off"]).stream).toBe("off");
  });

  it("rejects unknown values with unknown-stream-mode", () => {
    expectArgError(["--stream", "flush"], "unknown-stream-mode");
  });
});

describe("parseCliArgs — wrap-root", () => {
  it("allowed with --class-prefix", () => {
    const opts = parseCliArgs(["--class-prefix", "md", "--wrap-root"]);
    expect(opts.wrapRoot).toBe(true);
    expect(opts.classPrefix).toBe("md");
  });

  it("without --class-prefix throws wrap-root-requires-prefix", () => {
    expectArgError(["--wrap-root"], "wrap-root-requires-prefix");
  });
});

describe("parseCliArgs — xhtml", () => {
  it("default is true", () => {
    expect(parseCliArgs([]).xhtml).toBe(true);
  });

  it("--no-xhtml turns it off", () => {
    expect(parseCliArgs(["--no-xhtml"]).xhtml).toBe(false);
  });

  it("--xhtml keeps it on explicitly", () => {
    expect(parseCliArgs(["--xhtml"]).xhtml).toBe(true);
  });

  it("--xhtml --no-xhtml throws conflicting-flag", () => {
    expectArgError(["--xhtml", "--no-xhtml"], "conflicting-flag");
  });
});

describe("parseCliArgs — version and help", () => {
  it("--version sets the flag", () => {
    expect(parseCliArgs(["--version"]).version).toBe(true);
  });

  it("-v short form sets the flag", () => {
    expect(parseCliArgs(["-v"]).version).toBe(true);
  });

  it("--help sets the flag", () => {
    expect(parseCliArgs(["--help"]).help).toBe(true);
  });

  it("-h short form sets the flag", () => {
    expect(parseCliArgs(["-h"]).help).toBe(true);
  });
});

describe("parseCliArgs — unknown flag and positional", () => {
  it("unknown flag throws unknown-flag", () => {
    expectArgError(["--nope"], "unknown-flag");
  });

  it("positional argument throws positional-not-allowed", () => {
    expectArgError(["input.md"], "positional-not-allowed");
  });
});

describe("parseCliArgs — combined realistic scenarios", () => {
  it("full plugin + theme combo", () => {
    const argv = [
      "--gfm",
      "--math",
      "--anchors",
      "--link-attrs",
      "--class-prefix",
      "md",
      "--theme",
      "dark",
      "--wrap-root",
    ];
    const opts = parseCliArgs(argv);
    expect(opts).toStrictEqual({
      gfm: true,
      math: true,
      classPrefix: "md",
      theme: "dark",
      anchors: true,
      linkAttrs: true,
      sanitize: true,
      allowDangerousMetaHtml: false,
      stream: "auto",
      wrapRoot: true,
      xhtml: true,
      help: false,
      version: false,
    });
  });

  it("trusted-highlighter combo (no sanitize, allow meta html)", () => {
    const opts = parseCliArgs(["--no-sanitize", "--allow-dangerous-meta-html"]);
    expect(opts.sanitize).toBe(false);
    expect(opts.allowDangerousMetaHtml).toBe(true);
  });
});

describe("StreamdCliArgumentError — shape", () => {
  it("exposes kind, caller, and source", () => {
    expect(() => parseCliArgs(["--nope"])).toThrow(StreamdCliArgumentError);
    expect(() => parseCliArgs(["--nope"])).toThrow(
      expect.objectContaining({
        kind: "unknown-flag",
        caller: "parseCliArgs",
        source: "@streamd/cli",
        name: "StreamdCliArgumentError",
        message: expect.stringContaining("--nope"),
      }),
    );
  });

  it("is a TypeError subclass (shares the Streamd base)", () => {
    expect(() => parseCliArgs(["--nope"])).toThrow(TypeError);
  });
});

/**
 * Helper: assert that `parseCliArgs(argv)` throws a
 * `StreamdCliArgumentError` with the given `kind`.
 *
 * Uses vitest's canonical `toThrow` matcher pair — one for the
 * error class, one for the discriminator field — per
 * `testing-standards.md` §5.
 *
 * @param argv Argv slice to pass to parseCliArgs.
 * @param kind Expected discriminator on the thrown error.
 */
function expectArgError(argv: ReadonlyArray<string>, kind: string): void {
  expect(() => parseCliArgs(argv)).toThrow(StreamdCliArgumentError);
  expect(() => parseCliArgs(argv)).toThrow(expect.objectContaining({ kind }));
}
