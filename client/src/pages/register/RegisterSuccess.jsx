import { useLocation, Link } from "react-router-dom";
import { useState } from "react";
import { apiPost } from "../../api";

export default function RegisterSuccess() {
  const { state } = useLocation();
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState(null);

  if (!state?.apiKey) {
    return (
      <div style={{ textAlign: "center", marginTop: 80, color: "#888" }}>
        <p>No registration data found.</p>
        <Link to="/register" style={{ color: "#e94560" }}>Register here</Link>
      </div>
    );
  }

  function handleCopy() {
    navigator.clipboard.writeText(state.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  async function handleEmail() {
    try {
      // Use the recovery endpoint to email the key
      await apiPost("/clients/recover", { email: state.email });
      setEmailSent(true);
    } catch (err) {
      setEmailError(err.message);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1a2e", color: "#eee" }}>
      <div style={{ width: "100%", maxWidth: 520, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16, color: "#4caf50" }}>&#10003;</div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Welcome, {state.name}!</h1>
        <p style={{ color: "#888", marginBottom: 24 }}>Your account is ready. Here's your API key:</p>

        <div style={keyBox}>
          <code style={{ fontSize: 14, wordBreak: "break-all" }}>{state.apiKey}</code>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
          <button onClick={handleCopy} style={btnPrimary}>
            {copied ? "Copied!" : "Copy Key"}
          </button>
          {!emailSent ? (
            <button onClick={handleEmail} style={btnSecondary}>
              Email Me a Copy
            </button>
          ) : (
            <span style={{ color: "#4caf50", fontSize: 13, display: "flex", alignItems: "center" }}>
              Sent to {state.email}
            </span>
          )}
        </div>

        {emailError && <p style={{ color: "#e94560", fontSize: 12, marginBottom: 8 }}>{emailError}</p>}

        <div style={warningBox}>
          This is the only time your key will be displayed. Copy it now or email yourself a backup.
        </div>

        <div style={{ textAlign: "left", marginTop: 32 }}>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>What to do next</h3>
          <ol style={{ color: "#ccc", lineHeight: 2.2, paddingLeft: 20, fontSize: 14 }}>
            <li><a href="/comp/extension/" style={link}>Download the CompTool Chrome Extension</a></li>
            <li>Open <code style={code}>chrome://extensions/</code>, enable <strong>Developer mode</strong></li>
            <li>Click <strong>Load unpacked</strong> → select the extension folder</li>
            <li>Click the extension icon → <strong>Settings</strong></li>
            <li>Set API URL: <code style={code}>https://listflow.robug.com</code></li>
            <li>Paste your API key and save</li>
            <li>Go to <a href="https://www.ebay.com" target="_blank" rel="noreferrer" style={link}>eBay</a>, search for anything, check <strong>Sold Items</strong> — comps save automatically!</li>
          </ol>
        </div>

        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 32 }}>
          <Link to="/browse" style={{ color: "#7ec8e3", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>Browse Comps</Link>
          <Link to="/" style={{ color: "#e94560", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>Home</Link>
        </div>
      </div>
    </div>
  );
}

const keyBox = { background: "#0a0a1a", border: "2px solid #e94560", borderRadius: 8, padding: "16px 20px", marginBottom: 16, fontFamily: "monospace" };
const btnPrimary = { padding: "10px 24px", background: "#e94560", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 14 };
const btnSecondary = { padding: "10px 24px", background: "#0f3460", color: "#eee", border: "1px solid #1a4a7a", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14 };
const warningBox = { padding: "10px 16px", background: "#3a2a00", border: "1px solid #ff9800", borderRadius: 6, color: "#ffcc02", fontSize: 13, fontWeight: 600, marginBottom: 8 };
const link = { color: "#7ec8e3", textDecoration: "none" };
const code = { background: "#0a0a1a", padding: "2px 6px", borderRadius: 3, fontSize: 12, color: "#ff9800" };
