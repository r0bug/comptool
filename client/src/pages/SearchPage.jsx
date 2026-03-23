import { useState } from "react";
import { Link } from "react-router-dom";
import { apiPost } from "../api";

export default function SearchPage() {
  return (
    <div className="ct-search-page">
      <style>{pageStyles}</style>

      {/* Hero */}
      <div className="ct-hero">
        <h1 className="ct-hero-title">Know What It's Worth</h1>
        <p className="ct-hero-sub">
          CompTool tracks eBay sold prices so you never have to guess what something sells for.
          Install our Chrome extension, browse eBay like you normally do, and every sold listing
          gets saved to your personal database — searchable, filterable, with full price analytics.
        </p>
      </div>

      {/* Quick links */}
      <div className="ct-cards">
        <Link to="/browse" className="ct-card">
          <div className="ct-card-icon">&#128269;</div>
          <div className="ct-card-title">Browse Comps</div>
          <div className="ct-card-desc">Search your database of sold items with advanced filters, price stats, and tile/table views</div>
        </Link>
        <Link to="/history" className="ct-card">
          <div className="ct-card-icon">&#128200;</div>
          <div className="ct-card-title">Price Analytics</div>
          <div className="ct-card-desc">View search history with avg, median, min/max pricing across every search you've run</div>
        </Link>
        <Link to="/register" className="ct-card ct-card--accent">
          <div className="ct-card-icon">&#128273;</div>
          <div className="ct-card-title">Get Your API Key</div>
          <div className="ct-card-desc">Free account — takes 10 seconds. You'll need this to connect the Chrome extension.</div>
        </Link>
      </div>

      {/* How it works */}
      <div className="ct-section">
        <h2>How It Works</h2>
        <div className="ct-steps">
          <Step num="1" title="Register for free">
            <Link to="/register" style={link}>Create your account</Link> and get an API key.
            Save it somewhere safe — or we'll email it to you.
          </Step>
          <Step num="2" title="Install the Chrome extension">
            <a href="/comp/extension/" style={link}>Download CompTool for Chrome</a>.
            Load it as an unpacked extension in Developer mode.
            Configure it with your API key in the extension settings.
          </Step>
          <Step num="3" title="Browse eBay normally">
            Search on <a href="https://www.ebay.com/sh/research" target="_blank" rel="noreferrer" style={link}>Terapeak Research</a> or
            use regular eBay search with the <strong>"Sold Items"</strong> filter.
            CompTool auto-captures every result — prices, shipping, condition, seller, images, dates.
          </Step>
          <Step num="4" title="Analyze your data">
            Come back here to <Link to="/browse" style={link}>browse</Link> your growing comp database.
            Filter by keyword, price range, condition, category, seller, date.
            Right-click any comp to copy the URL, open the listing, or sell a similar item.
          </Step>
        </div>
      </div>

      {/* What gets captured */}
      <div className="ct-section">
        <h2>What Gets Captured</h2>
        <div className="ct-features">
          <Feature icon="&#128176;" title="Price & Shipping" desc="Sold price, shipping cost, total price — the real numbers" />
          <Feature icon="&#128247;" title="Product Images" desc="Cached locally so they never expire — zoom and compare anytime" />
          <Feature icon="&#128181;" title="Seller Details" desc="Seller name, feedback score — know who's selling what" />
          <Feature icon="&#128196;" title="Listing Details" desc="Condition, listing type (auction vs BIN), bid count, date sold" />
          <Feature icon="&#128193;" title="Categories" desc="Full eBay category path — filter from top-level down to subcategory" />
          <Feature icon="&#128202;" title="Price Statistics" desc="Avg, median, min, max, percentiles — computed per search automatically" />
        </div>
      </div>

      {/* Extension install */}
      <div className="ct-section ct-install">
        <h2>Quick Setup Guide</h2>
        <ol className="ct-install-list">
          <li><Link to="/register" style={link}>Register</Link> for your free API key</li>
          <li><a href="/comp/extension/" style={link}>Download the extension</a></li>
          <li>Open <code style={code}>chrome://extensions/</code>, enable <strong>Developer mode</strong></li>
          <li>Click <strong>Load unpacked</strong> and select the extension folder</li>
          <li>Click the CompTool extension icon → <strong>Settings</strong></li>
          <li>Set API URL: <code style={code}>https://listflow.robug.com</code></li>
          <li>Paste your API key and save</li>
          <li>Go to eBay, search with <strong>Sold Items</strong> filter — comps save automatically!</li>
        </ol>
      </div>

      {/* Lost key */}
      <LostKeyForm />
    </div>
  );
}

function Step({ num, title, children }) {
  return (
    <div className="ct-step">
      <div className="ct-step-num">{num}</div>
      <div>
        <div className="ct-step-title">{title}</div>
        <div className="ct-step-desc">{children}</div>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }) {
  return (
    <div className="ct-feature">
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div className="ct-feature-title">{title}</div>
      <div className="ct-feature-desc">{desc}</div>
    </div>
  );
}

function LostKeyForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleRecover(e) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setStatus(null);
    try {
      const result = await apiPost("/clients/recover", { email });
      setStatus({ type: "ok", msg: "If an account exists with that email, a new API key has been generated and will be emailed to you shortly." });
      setEmail("");
    } catch (err) {
      setStatus({ type: "err", msg: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ct-section" style={{ textAlign: "center" }}>
      <h3 style={{ marginBottom: 8 }}>Lost your API key?</h3>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 12 }}>
        Enter your email and we'll generate a new key and send it to you.
      </p>
      <form onSubmit={handleRecover} style={{ display: "flex", gap: 8, justifyContent: "center", maxWidth: 400, margin: "0 auto" }}>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ flex: 1, padding: "8px 12px", background: "#16213e", border: "1px solid #0f3460", borderRadius: 6, color: "#eee", fontSize: 13, outline: "none" }}
        />
        <button type="submit" disabled={loading} style={{ padding: "8px 18px", background: "#0f3460", color: "#eee", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          {loading ? "Sending..." : "Recover Key"}
        </button>
      </form>
      {status && (
        <p style={{ marginTop: 10, fontSize: 13, color: status.type === "ok" ? "#4caf50" : "#e94560" }}>
          {status.msg}
        </p>
      )}
    </div>
  );
}

const link = { color: "#7ec8e3", textDecoration: "none" };
const code = { background: "#0a0a1a", padding: "2px 6px", borderRadius: 3, fontSize: 12, color: "#ff9800" };

const pageStyles = `
  .ct-search-page { max-width: 800px; margin: 0 auto; }

  .ct-hero { text-align: center; margin-bottom: 32px; }
  .ct-hero-title { font-size: 28px; margin-bottom: 12px; color: #eee; }
  .ct-hero-sub { color: #999; font-size: 15px; line-height: 1.7; max-width: 600px; margin: 0 auto; }

  .ct-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 36px; }
  .ct-card {
    display: block; background: #16213e; border: 1px solid #0f3460; border-radius: 8px;
    padding: 20px; text-decoration: none; color: #eee; transition: border-color 0.15s;
  }
  .ct-card:hover { border-color: #e94560; }
  .ct-card--accent { border-color: #e94560; }
  .ct-card-icon { font-size: 28px; margin-bottom: 6px; }
  .ct-card-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .ct-card-desc { font-size: 12px; color: #888; line-height: 1.5; }

  .ct-section { background: #16213e; border: 1px solid #0f3460; border-radius: 8px; padding: 24px; margin-bottom: 20px; }
  .ct-section h2 { font-size: 18px; margin-bottom: 16px; }
  .ct-section h3 { font-size: 15px; }

  .ct-steps { display: flex; flex-direction: column; gap: 16px; }
  .ct-step { display: flex; gap: 14px; align-items: flex-start; }
  .ct-step-num {
    width: 32px; height: 32px; background: #e94560; color: white; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;
  }
  .ct-step-title { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
  .ct-step-desc { font-size: 13px; color: #aaa; line-height: 1.6; }

  .ct-features { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
  .ct-feature { text-align: center; padding: 12px; }
  .ct-feature-title { font-size: 13px; font-weight: 600; margin: 6px 0 2px; }
  .ct-feature-desc { font-size: 11px; color: #888; line-height: 1.4; }

  .ct-install-list { text-align: left; line-height: 2.2; color: #ccc; padding-left: 20px; font-size: 14px; }

  @media (max-width: 768px) {
    .ct-hero-title { font-size: 22px; }
    .ct-hero-sub { font-size: 13px; }
    .ct-cards { grid-template-columns: 1fr; }
    .ct-features { grid-template-columns: repeat(2, 1fr); }
    .ct-section { padding: 16px; }
  }
`;
