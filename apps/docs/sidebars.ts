/**
 * Sidebar navigation configuration for the streamd documentation site.
 *
 * Defines the hierarchical structure of the docs sidebar, grouping pages
 * into logical categories (Packages, Recipes) for discoverability.
 *
 * @module apps/docs/sidebars
 */
import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

/**
 * Sidebar definitions consumed by the Docusaurus docs plugin.
 *
 * `docsSidebar` is the primary sidebar rendered on every docs page.
 * Categories are expanded by default (`collapsed: false`) so users
 * see the full navigation tree on first visit.
 */
const sidebars: SidebarsConfig = {
  docsSidebar: [
    /** Entry-point overview page. */
    "intro",
    {
      type: "category",
      /** Human-readable group label shown in the sidebar. */
      label: "Packages",
      /** Expanded by default for immediate visibility. */
      collapsed: false,
      items: [
        "packages/parser",
        "packages/tokens",
        "packages/html",
        "packages/react",
        "packages/react-native",
        "packages/plugins",
        "packages/plugin-shiki",
        "packages/cli",
      ],
    },
    {
      type: "category",
      /** Human-readable group label shown in the sidebar. */
      label: "Recipes",
      /** Expanded by default for immediate visibility. */
      collapsed: false,
      items: [
        "recipes/llm-streaming",
        "recipes/sanitize-and-plugins",
        "recipes/custom-theme",
        "recipes/custom-components",
        "recipes/shiki-integration",
        "recipes/math-rendering",
        "recipes/migration-from-markdown-it",
        "recipes/migration-from-commonmark-js",
        "recipes/migration-from-marked",
      ],
    },
  ],
};

export default sidebars;
