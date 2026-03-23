import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { adminGet, adminPost, adminPatch, adminDelete } from "../../api";

export default function AdminClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [error, setError] = useState(null);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [editPlan, setEditPlan] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, [id]);

  async function load() {
    try {
      const data = await adminGet(`/admin/clients/${id}`);
      setClient(data);
      setEditPlan(data.planTier);
    } catch (e) {
      setError(e.message);
    }
  }

  async function generateKey() {
    try {
      const key = await adminPost(`/admin/clients/${id}/keys`, { label: newKeyLabel || "Default" });
      setMsg(`New key: ${key.key}`);
      setNewKeyLabel("");
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function revokeKey(keyId) {
    if (!confirm("Revoke this API key?")) return;
    try {
      await adminDelete(`/admin/keys/${keyId}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function updatePlan() {
    try {
      await adminPatch(`/admin/clients/${id}`, { planTier: editPlan });
      setMsg("Plan updated");
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleActive() {
    try {
      await adminPatch(`/admin/clients/${id}`, { isActive: !client.isActive });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <p style={{ color: "#e94560" }}>{error}</p>;
  if (!client) return <p style={{ color: "#888" }}>Loading...</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{client.name}</h2>
          <div style={{ color: "#888", fontSize: 13 }}>{client.email} {client.company && `· ${client.company}`}</div>
          <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>ID: {client.id}</div>
        </div>
        <button onClick={toggleActive} style={{ ...btnStyle, background: client.isActive ? "#c62828" : "#4caf50" }}>
          {client.isActive ? "Deactivate" : "Activate"}
        </button>
      </div>

      {msg && <div style={{ background: "#1b3a1b", border: "1px solid #4caf50", padding: "8px 12px", borderRadius: 6, marginBottom: 16, fontSize: 13, wordBreak: "break-all" }}>{msg}</div>}

      {/* Plan */}
      <Section title="Plan">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={editPlan} onChange={(e) => setEditPlan(e.target.value)} style={inputStyle}>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <button onClick={updatePlan} style={btnSmall}>Update</button>
          <span style={{ color: "#888", fontSize: 12 }}>Billing: {client.billingStatus} · Limit: {client.usageLimitMonthly}/mo</span>
        </div>
      </Section>

      {/* Stats */}
      <Section title="Usage">
        <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
          <Stat label="Searches" value={client.stats?.searchCount || 0} />
          <Stat label="Comps" value={client.stats?.compCount || 0} />
        </div>
      </Section>

      {/* API Keys */}
      <Section title="API Keys">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
          <thead>
            <tr>
              {["Label", "Key", "Status", "Usage", "Last Used", "Created", ""].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {client.apiKeys?.map((k) => (
              <tr key={k.id} style={{ borderBottom: "1px solid #222" }}>
                <td style={tdStyle}>{k.label}</td>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>...{k.key.slice(-12)}</td>
                <td style={tdStyle}>
                  <span style={{ color: k.isActive ? "#4caf50" : "#e94560" }}>{k.isActive ? "Active" : "Revoked"}</span>
                </td>
                <td style={tdStyle}>{k.usageCount}</td>
                <td style={tdStyle}>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}</td>
                <td style={tdStyle}>{new Date(k.createdAt).toLocaleDateString()}</td>
                <td style={tdStyle}>
                  {k.isActive && (
                    <button onClick={() => revokeKey(k.id)} style={{ ...btnSmall, background: "#c62828" }}>Revoke</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Key label" value={newKeyLabel} onChange={(e) => setNewKeyLabel(e.target.value)} style={inputStyle} />
          <button onClick={generateKey} style={btnSmall}>Generate New Key</button>
        </div>
      </Section>

      {/* Machines */}
      <Section title="Machines">
        {client.apiKeys?.flatMap((k) => k.machines || []).length === 0 ? (
          <p style={{ color: "#666", fontSize: 13 }}>No machines registered yet</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Machine ID", "Browser", "Requests", "First Seen", "Last Seen"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {client.apiKeys?.flatMap((k) =>
                (k.machines || []).map((m) => (
                  <tr key={m.id} style={{ borderBottom: "1px solid #222" }}>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{m.machineId.slice(0, 16)}...</td>
                    <td style={tdStyle}>{m.browserInfo?.split(" ").slice(-1)[0] || "—"}</td>
                    <td style={tdStyle}>{m.requestCount}</td>
                    <td style={tdStyle}>{new Date(m.firstSeen).toLocaleDateString()}</td>
                    <td style={tdStyle}>{new Date(m.lastSeen).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ marginBottom: 12, borderBottom: "1px solid #333", paddingBottom: 8 }}>{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: "#16213e", padding: "10px 18px", borderRadius: 6, border: "1px solid #0f3460", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#e94560" }}>{value}</div>
    </div>
  );
}

const inputStyle = { padding: "6px 10px", background: "#16213e", border: "1px solid #0f3460", borderRadius: 6, color: "#eee", fontSize: 13 };
const btnStyle = { padding: "8px 20px", background: "#e94560", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 };
const btnSmall = { padding: "4px 12px", background: "#e94560", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 12 };
const thStyle = { padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #333", color: "#aaa" };
const tdStyle = { padding: "8px 10px" };
