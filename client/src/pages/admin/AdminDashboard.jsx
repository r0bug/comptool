import { useState, useEffect } from "react";
import { adminGet, adminPatch } from "../../api";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminGet("/admin/dashboard").then(setStats).catch((e) => setError(e.message));
  }, []);

  async function toggleSetting(key) {
    setSaving(true);
    try {
      const current = stats.settings[key];
      const newVal = current === "true" ? "false" : "true";
      const updated = await adminPatch("/admin/settings", { [key]: newVal });
      setStats((s) => ({ ...s, settings: updated }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateSetting(key, value) {
    setSaving(true);
    try {
      const updated = await adminPatch("/admin/settings", { [key]: value });
      setStats((s) => ({ ...s, settings: updated }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <p style={{ color: "#e94560" }}>{error}</p>;
  if (!stats) return <p style={{ color: "#888" }}>Loading...</p>;

  const s = stats.settings || {};
  const saasOn = s.saas_mode === "true";

  const cards = [
    { label: "Clients", value: stats.activeClients, sub: `${stats.totalClients} total` },
    { label: "API Keys", value: stats.activeKeys, sub: `${stats.totalKeys} total` },
    { label: "Machines", value: stats.totalMachines },
    { label: "Total Comps", value: stats.totalComps.toLocaleString() },
    { label: "Total Searches", value: stats.totalSearches },
    { label: "Searches Today", value: stats.searchesToday },
    { label: "Comps This Week", value: stats.compsThisWeek.toLocaleString() },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Admin Dashboard</h2>

      {/* Stats cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        {cards.map((c) => (
          <div key={c.label} style={cardStyle}>
            <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase" }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#e94560" }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: 11, color: "#666" }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* SaaS Mode Toggle */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>SaaS Mode</h3>
            <p style={{ color: "#888", fontSize: 12, margin: "4px 0 0" }}>
              {saasOn ? "Full SaaS: email verification, usage limits, billing enforced" : "Open mode: unlimited free keys, no email required"}
            </p>
          </div>
          <button
            onClick={() => toggleSetting("saas_mode")}
            disabled={saving}
            style={{ ...toggleBtn, background: saasOn ? "#4caf50" : "#333" }}
          >
            {saasOn ? "ON" : "OFF"}
          </button>
        </div>

        {/* Settings grid — shown regardless, but some only apply in SaaS mode */}
        <div style={settingsGrid}>
          <Toggle label="Registration Open" value={s.registration_open} onChange={() => toggleSetting("registration_open")} />
          <Toggle label="Require Email Verification" value={s.require_email_verification} onChange={() => toggleSetting("require_email_verification")} disabled={!saasOn} />
          <Toggle label="Stripe Billing" value={s.stripe_enabled} onChange={() => toggleSetting("stripe_enabled")} disabled={!saasOn} />

          <NumberSetting label="Free Tier: Monthly Searches" value={s.max_free_searches} onChange={(v) => updateSetting("max_free_searches", v)} disabled={!saasOn} />
          <NumberSetting label="Free Tier: Max Comps" value={s.max_free_comps} onChange={(v) => updateSetting("max_free_comps", v)} disabled={!saasOn} />
          <NumberSetting label="Free Tier: Max API Keys" value={s.max_free_keys} onChange={(v) => updateSetting("max_free_keys", v)} disabled={!saasOn} />

          <NumberSetting label="Pro Price ($/mo)" value={s.pro_price_monthly} onChange={(v) => updateSetting("pro_price_monthly", v)} disabled={!saasOn} />
          <NumberSetting label="Enterprise Price ($/mo)" value={s.enterprise_price_monthly} onChange={(v) => updateSetting("enterprise_price_monthly", v)} disabled={!saasOn} />
        </div>
      </div>

      {/* Push Keywords + Extension Controls */}
      <div style={sectionStyle}>
        <h3 style={{ margin: "0 0 12px" }}>Extension Controls</h3>
        <KeywordPusher />
        <ScriptPusher />
      </div>

      {/* Recent Activity */}
      <h3 style={{ marginBottom: 12 }}>Recent Activity</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {["Client", "Keyword", "Results", "Source", "Status", "Date"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.recentSearches.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #222" }}>
              <td style={tdStyle}>{s.clientId === "default" ? "Owner" : s.clientId.slice(0, 8)}</td>
              <td style={tdStyle}>{s.keyword}</td>
              <td style={tdStyle}>{s.resultCount}</td>
              <td style={tdStyle}>{s.source}</td>
              <td style={tdStyle}>
                <span style={{ color: s.status === "done" ? "#4caf50" : s.status === "error" ? "#e94560" : "#ff9800" }}>
                  {s.status}
                </span>
              </td>
              <td style={tdStyle}>{new Date(s.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeywordPusher() {
  const [keywords, setKeywords] = useState("");
  const [status, setStatus] = useState("");
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    adminGet("/queue?limit=10").then((d) => setQueue(d.queue || [])).catch(() => {});
  }, []);

  async function pushKeywords() {
    if (!keywords.trim()) return;
    const lines = keywords.split("\n").map((l) => l.trim()).filter(Boolean);
    // Save to extension_script setting — batch search picks it up
    const script = lines.map((kw) => `"${kw}"`).join(",");
    const code = `(function(){var t=document.getElementById("keywords");if(t){t.value+="\\n${lines.join("\\n")}";alert("CompTool: Added ${lines.length} keywords")}else{alert("Open Batch Search first")}})()`;
    try {
      await adminPatch("/admin/settings", { extension_script: code });
      setStatus(`Pushed ${lines.length} keywords. Extensions will pick them up on next poll.`);
      setKeywords("");
    } catch (e) {
      setStatus("Error: " + e.message);
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#aaa", marginBottom: 6 }}>Push Search Keywords</div>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
        Server queue suggests: {queue.length > 0 ? queue.join(", ") : "none"}
      </div>
      <textarea
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
        placeholder="One keyword per line..."
        rows={4}
        style={{ width: "100%", padding: 8, background: "#0a0a1a", border: "1px solid #0f3460", borderRadius: 6, color: "#eee", fontSize: 13, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
        <button onClick={pushKeywords} style={miniSave}>Push to Extensions</button>
        <button onClick={() => { setKeywords(queue.join("\n")); }} style={{ ...miniSave, background: "#0f3460" }}>Fill from Queue</button>
        {status && <span style={{ fontSize: 11, color: "#4caf50" }}>{status}</span>}
      </div>
    </div>
  );
}

function ScriptPusher() {
  const [script, setScript] = useState("");
  const [patch, setPatch] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    adminGet("/admin/settings").then((s) => {
      setPatch(s.extension_patch || "");
    }).catch(() => {});
  }, []);

  async function pushPatch() {
    try {
      await adminPatch("/admin/settings", { extension_patch: patch });
      setStatus(patch ? "Persistent patch set — runs on every page load" : "Patch cleared");
    } catch (e) {
      setStatus("Error: " + e.message);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#aaa", marginBottom: 6 }}>Hot Code Push</div>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
        Push JavaScript to all extensions. Persistent patch runs on every eBay page load. Use for selector fixes.
      </div>
      <textarea
        value={patch}
        onChange={(e) => setPatch(e.target.value)}
        placeholder='console.log("hot fix running")'
        rows={3}
        style={{ width: "100%", padding: 8, background: "#0a0a1a", border: "1px solid #0f3460", borderRadius: 6, color: "#eee", fontSize: 12, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
        <button onClick={pushPatch} style={miniSave}>{patch ? "Set Patch" : "Clear Patch"}</button>
        {status && <span style={{ fontSize: 11, color: "#4caf50" }}>{status}</span>}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange, disabled }) {
  const on = value === "true";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", opacity: disabled ? 0.4 : 1 }}>
      <span style={{ fontSize: 13, color: "#ccc" }}>{label}</span>
      <button onClick={disabled ? undefined : onChange} style={{ ...miniToggle, background: on ? "#4caf50" : "#333" }} disabled={disabled}>
        {on ? "ON" : "OFF"}
      </button>
    </div>
  );
}

function NumberSetting({ label, value, onChange, disabled }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", opacity: disabled ? 0.4 : 1 }}>
      <span style={{ fontSize: 13, color: "#ccc" }}>{label}</span>
      {editing ? (
        <div style={{ display: "flex", gap: 4 }}>
          <input type="number" value={val} onChange={(e) => setVal(e.target.value)} style={numInput} autoFocus />
          <button onClick={() => { onChange(val); setEditing(false); }} style={miniSave}>Save</button>
        </div>
      ) : (
        <button onClick={disabled ? undefined : () => setEditing(true)} style={numDisplay} disabled={disabled}>
          {value}
        </button>
      )}
    </div>
  );
}

const cardStyle = { background: "#16213e", padding: "14px 22px", borderRadius: 6, border: "1px solid #0f3460", minWidth: 120, textAlign: "center" };
const sectionStyle = { background: "#16213e", border: "1px solid #0f3460", borderRadius: 8, padding: "20px", marginBottom: 24 };
const settingsGrid = { display: "flex", flexDirection: "column", borderTop: "1px solid #0f3460", paddingTop: 12 };
const toggleBtn = { padding: "8px 24px", color: "white", border: "none", borderRadius: 20, cursor: "pointer", fontWeight: 700, fontSize: 14 };
const miniToggle = { padding: "4px 14px", color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontWeight: 600, fontSize: 11 };
const numInput = { width: 70, padding: "4px 8px", background: "#0a0a1a", border: "1px solid #0f3460", borderRadius: 4, color: "#eee", fontSize: 13, textAlign: "right" };
const numDisplay = { background: "#0a0a1a", border: "1px solid #0f3460", borderRadius: 4, padding: "4px 12px", color: "#eee", fontSize: 13, cursor: "pointer" };
const miniSave = { padding: "4px 10px", background: "#e94560", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 };
const thStyle = { padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #333", color: "#aaa" };
const tdStyle = { padding: "8px 10px" };
