import { Link } from "react-router-dom";

export default function SearchPage() {
  return (
    <div style={{ maxWidth: 640, margin: "40px auto", textAlign: "center" }}>
      <h2 style={{ marginBottom: 8 }}>eBay Sold Comps Research</h2>
      <p style={{ color: "#888", marginBottom: 32 }}>
        Use the Chrome extension to scrape Terapeak results directly from your browser, then browse and analyze them here.
      </p>

      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 40 }}>
        <Link to="/browse" style={cardStyle}>
          <div style={cardIcon}>&#128269;</div>
          <div style={cardTitle}>Browse Comps</div>
          <div style={cardDesc}>Search and filter all saved comps</div>
        </Link>
        <Link to="/history" style={cardStyle}>
          <div style={cardIcon}>&#128203;</div>
          <div style={cardTitle}>Search History</div>
          <div style={cardDesc}>View past searches and stats</div>
        </Link>
      </div>

      <div style={installSection}>
        <h3 style={{ marginBottom: 12 }}>Get Started with the Chrome Extension</h3>
        <ol style={{ textAlign: "left", lineHeight: 2.2, color: "#ccc", paddingLeft: 20, fontSize: 14 }}>
          <li>
            <a href="/comp/extension/" style={linkStyle}>Download the extension</a> and unzip it
          </li>
          <li>
            Open <code style={codeStyle}>chrome://extensions/</code> in Chrome
          </li>
          <li>
            Enable <strong>Developer mode</strong> (top right toggle)
          </li>
          <li>
            Click <strong>Load unpacked</strong> and select the extension folder
          </li>
          <li>
            Click the extension icon and go to <strong>Settings</strong>
          </li>
          <li>
            Set API URL to <code style={codeStyle}>https://listflow.robug.com</code>
          </li>
          <li>
            Enter your API key (<a href="/comp/register" style={linkStyle}>get one here</a>)
          </li>
          <li>
            Go to <a href="https://www.ebay.com/sh/research" target="_blank" rel="noreferrer" style={linkStyle}>eBay Terapeak Research</a>, search for something, and click <strong>"Save Comps"</strong>
          </li>
        </ol>
      </div>
    </div>
  );
}

const cardStyle = {
  display: "block",
  background: "#16213e",
  border: "1px solid #0f3460",
  borderRadius: 8,
  padding: "24px 28px",
  textDecoration: "none",
  color: "#eee",
  flex: 1,
  maxWidth: 250,
  transition: "border-color 0.15s",
};

const cardIcon = { fontSize: 32, marginBottom: 8 };
const cardTitle = { fontSize: 16, fontWeight: 700, marginBottom: 4 };
const cardDesc = { fontSize: 13, color: "#888" };

const installSection = {
  background: "#16213e",
  border: "1px solid #0f3460",
  borderRadius: 8,
  padding: "24px 28px",
  textAlign: "left",
};

const linkStyle = { color: "#7ec8e3", textDecoration: "none" };
const codeStyle = { background: "#0a0a1a", padding: "2px 6px", borderRadius: 3, fontSize: 13, color: "#ff9800" };
