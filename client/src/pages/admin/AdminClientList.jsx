import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { adminGet, adminPost } from "../../api";

export default function AdminClientList() {
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "" });
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, [search]);

  async function load() {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const data = await adminGet(`/admin/clients${params}`);
      setClients(data.clients);
      setTotal(data.total);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    try {
      await adminPost("/admin/clients", form);
      setShowAdd(false);
      setForm({ name: "", email: "", company: "" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Clients ({total})</h2>
        <button onClick={() => setShowAdd(!showAdd)} style={btnStyle}>
          {showAdd ? "Cancel" : "+ Add Client"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} required />
          <input placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} required />
          <input placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={inputStyle} />
          <button type="submit" style={btnStyle}>Create</button>
        </form>
      )}

      {error && <p style={{ color: "#e94560", marginBottom: 12 }}>{error}</p>}

      <input
        type="text"
        placeholder="Search clients..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...inputStyle, width: "100%", marginBottom: 16 }}
      />

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {["Name", "Email", "Company", "Plan", "Keys", "Status", "Created"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id} style={{ borderBottom: "1px solid #222", cursor: "pointer" }}>
              <td style={tdStyle}>
                <Link to={`/admin/clients/${c.id}`} style={{ color: "#7ec8e3", textDecoration: "none" }}>{c.name}</Link>
              </td>
              <td style={tdStyle}>{c.email}</td>
              <td style={tdStyle}>{c.company || "—"}</td>
              <td style={tdStyle}><span style={planBadge(c.planTier)}>{c.planTier}</span></td>
              <td style={tdStyle}>{c.apiKeys?.filter((k) => k.isActive).length || 0}</td>
              <td style={tdStyle}>
                <span style={{ color: c.isActive ? "#4caf50" : "#e94560" }}>{c.isActive ? "Active" : "Inactive"}</span>
              </td>
              <td style={tdStyle}>{new Date(c.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
          {clients.length === 0 && (
            <tr><td colSpan={7} style={{ ...tdStyle, color: "#666", textAlign: "center" }}>No clients found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function planBadge(tier) {
  const colors = { free: "#888", pro: "#ff9800", enterprise: "#4caf50" };
  return { color: colors[tier] || "#888", fontWeight: 600, textTransform: "uppercase", fontSize: 11 };
}

const inputStyle = { padding: "8px 12px", background: "#16213e", border: "1px solid #0f3460", borderRadius: 6, color: "#eee", fontSize: 13 };
const btnStyle = { padding: "8px 20px", background: "#e94560", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 };
const thStyle = { padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #333", color: "#aaa" };
const tdStyle = { padding: "8px 10px" };
