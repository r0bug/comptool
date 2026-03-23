import { useState, useEffect } from "react";
import { adminGet } from "../../api";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminGet("/admin/dashboard").then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <p style={{ color: "#e94560" }}>{error}</p>;
  if (!stats) return <p style={{ color: "#888" }}>Loading...</p>;

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

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
        {cards.map((c) => (
          <div key={c.label} style={cardStyle}>
            <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase" }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#e94560" }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: 11, color: "#666" }}>{c.sub}</div>}
          </div>
        ))}
      </div>

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

const cardStyle = {
  background: "#16213e",
  padding: "14px 22px",
  borderRadius: 6,
  border: "1px solid #0f3460",
  minWidth: 120,
  textAlign: "center",
};

const thStyle = {
  padding: "8px 10px",
  textAlign: "left",
  borderBottom: "1px solid #333",
  color: "#aaa",
};

const tdStyle = {
  padding: "8px 10px",
};
