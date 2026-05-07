/**
 * Docs homepage — landing view for the streamd documentation site.
 *
 * @module apps/docs/src/pages/index
 */
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import type { CSSProperties } from "react";

/** Centered layout padding for the hero section. */
const heroStyle: CSSProperties = {
  padding: "4rem 0",
  textAlign: "center",
};

/**
 * Landing page component for the streamd documentation site.
 *
 * Renders a centered hero section with the project title, tagline,
 * and a link to the docs entry point.
 */
export default function Home() {
  return (
    <Layout title="streamd" description="streaming-first markdown parser">
      <main style={heroStyle}>
        <h1>streamd</h1>
        <p>streaming-first markdown parser with plugin support</p>
        <Link to="/docs">get started</Link>
      </main>
    </Layout>
  );
}
