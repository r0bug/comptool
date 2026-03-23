import { useLocation, Link } from "react-router-dom";
import { useState } from "react";

export default function RegisterSuccess() {
  const { state } = useLocation();
  const [copied, setCopied] = useState(false);

  if (!state?.apiKey) {
    return (
      <div style={{ textAlign: "center", marginTop: 80 }}>
        <p style={{ color: "#888" }}>No registration data found.</p>
        <Link to="/register" style={{ color: "#e94560" }}>Register here</Link>
      </div>
    );
  }

  function handleCopy() {
    navigator.clipboard.writeText(state.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 520, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Welcome, {state.name}!</h1>
        <p style={{ color: "#888", marginBottom: 32 }}>Your account has been created. Here's your API key:</p>

        <div style={keyBox}>
          <code style={{ fontSize: 14, wordBreak: "break-all" }}>{state.apiKey}</code>
        </div>

        <button onClick={handleCopy} style={copyBtn}>
          {copied ? "Copied!" : "Copy API Key"}
        </button>

        <div style={warningBox}>
          Save this key now — you will not be able to see it again.
        </div>

        <div style={{ textAlign: "left", marginTop: 32 }}>
          <h3 style={{ marginBottom: 16 }}>Setup Instructions</h3>
          <ol style={{ color: "#ccc", lineHeight: 2, paddingLeft: 20, fontSize: 14 }}>
            <li>Download and install the <a href="/comp/extension/" style={{ color: "#7ec8e3" }}>CompTool Chrome Extension</a></li>
            <li>Open the extension settings (click extension icon → Settings)</li>
            <li>Set API URL to <code style={{ color: "#ff9800" }}>https://listflow.robug.com</code></li>
            <li>Paste your API key above</li>
            <li>Navigate to <a href="https://www.ebay.com/sh/research" target="_blank" style={{ color: "#7ec8e3" }}>eBay Terapeak Research</a></li>
            <li>Search for sold items and click <strong>"Save Comps"</strong></li>
          </ol>
        </div>

        <div style={{ marginTop: 32 }}>
          <Link to="/" style={{ color: "#e94560", textDecoration: "none", fontWeight: 600 }}>Go to Dashboard →</Link>
        </div>
      </div>
    </div>
  );
}

const keyBox = {
  background: "#0a0a1a",
  border: "2px solid #e94560",
  borderRadius: 8,
  padding: "16px 20px",
  marginBottom: 12,
  fontFamily: "monospace",
};

const copyBtn = {
  padding: "10px 32px",
  background: "#e94560",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const warningBox = {
  marginTop: 16,
  padding: "10px 16px",
  background: "#3a2a00",
  border: "1px solid #ff9800",
  borderRadius: 6,
  color: "#ffcc02",
  fontSize: 13,
  fontWeight: 600,
};
