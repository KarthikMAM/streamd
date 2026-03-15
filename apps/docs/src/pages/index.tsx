import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";

export default function Home() {
  return (
    <Layout title="streamd" description="streaming-first markdown parser">
      <main style={{ padding: "4rem 0", textAlign: "center" }}>
        <h1>streamd</h1>
        <p>streaming-first markdown parser with plugin support</p>
        <Link to="/docs/intro">get started</Link>
      </main>
    </Layout>
  );
}
