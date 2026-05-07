/**
 * Docusaurus site configuration for the streamd documentation app.
 *
 * Controls metadata, routing, i18n, presets, and theme appearance.
 * Values here are consumed at build time by the Docusaurus framework.
 *
 * @module apps/docs/docusaurus.config
 */
import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";

/**
 * Root site configuration object.
 *
 * Defines the public-facing identity (title, tagline, URL), build
 * behaviour (broken-link handling), internationalisation defaults,
 * preset plugins, and visual theme settings.
 */
const config: Config = {
  /** Display name shown in the browser tab and navbar. */
  title: "streamd",
  /** One-line project description used in meta tags and the hero. */
  tagline: "Streaming-first markdown parser with plugin support",
  /** Path to the favicon relative to the `static/` directory. */
  favicon: "img/favicon.ico",
  /** Canonical production URL used for sitemap and OG meta. */
  url: "https://streamd.dev",
  /** Root path prefix — "/" for apex deployment. */
  baseUrl: "/",
  /** Fail the build on any broken internal doc link. */
  onBrokenLinks: "throw",

  markdown: {
    hooks: {
      /** Warn (don't fail) on broken markdown-only links during build. */
      onBrokenMarkdownLinks: "warn",
    },
  },

  i18n: {
    /** English-only for now; additional locales can be appended here. */
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          /** Points to the sidebar definition module. */
          sidebarPath: "./sidebars.ts",
        },
        /** Blog disabled — this site is docs-only. */
        blog: false,
        theme: {
          /** Global CSS overrides for brand colours and spacing. */
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      /** Navbar brand text matching the package scope. */
      title: "streamd",
      items: [
        {
          type: "docSidebar",
          /** Must match a key in sidebars.ts. */
          sidebarId: "docsSidebar",
          position: "left",
          label: "Docs",
        },
        {
          /** External link to the source repository. */
          href: "https://github.com/KarthikMAM/streamd",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      /** Dark footer for visual contrast against the content area. */
      style: "dark",
      /** Dynamic year keeps the copyright evergreen. */
      copyright: `Copyright © ${new Date().getFullYear()} streamd`,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
