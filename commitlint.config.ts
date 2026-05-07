/**
 * Conventional Commits rules tightened for the streamd monorepo.
 *
 * Scope values align to package / app names so `git log --grep` and
 * changelog generation stay predictable.
 *
 * @module commitlint.config
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "refactor",
        "test",
        "chore",
        "perf",
        "style",
        "build",
        "ci",
        "revert",
      ],
    ],
    "subject-case": [2, "always", ["lower-case"]],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 72],
    "body-max-line-length": [2, "always", 100],
    "body-leading-blank": [2, "always"],
    "footer-leading-blank": [2, "always"],
    "scope-case": [2, "always", "kebab-case"],
    "scope-enum": [
      2,
      "always",
      [
        "parser",
        "tokens",
        "html",
        "plugins",
        "react",
        "react-native",
        "bench",
        "spec",
        "e2e",
        "config",
        "html-demo",
        "react-demo",
        "react-native-demo",
        "docs",
        "repo",
        "ci",
        "release",
        "deps",
      ],
    ],
  },
};
