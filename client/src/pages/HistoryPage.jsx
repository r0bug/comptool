import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../api";

export default function HistoryPage() {
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const { searches: data } = await apiGet("/search/history?limit=50");
      setSearches(data);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p style={{ color: "#888" }}>Loading...</p>;

  if (searches.length === 0) {
    return <p style={{ color: "#888" }}>No searches yet. Run a search from the Search tab.</p>;
  }

  return (
    <div>
      <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>Search History</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr>
            <th style={thStyle}>Keyword</th>
            <th style={thStyle}>Results</th>
            <th style={thStyle}>Avg</th>
            <th style={thStyle}>Median</th>
            <th style={thStyle}>Range</th>
            <th style={thStyle}>Source</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Date</th>
          </tr>
        </thead>
        <tbody>
          {searches.map((s) => (
            <tr
              key={s.id}
              onClick={() => navigate(`/search/${s.id}`)}
              style={{ cursor: "pointer", borderBottom: "1px solid #222" }}
            >
              <td style={cellStyle}>{s.keyword}</td>
              <td style={cellStyle}>{s.resultCount}</td>
              <td style={cellStyle}>{s.avgPrice ? `$${s.avgPrice.toFixed(2)}` : "—"}</td>
              <td style={cellStyle}>{s.medianPrice ? `$${s.medianPrice.toFixed(2)}` : "—"}</td>
              <td style={cellStyle}>
                {s.minPrice && s.maxPrice
                  ? `$${s.minPrice.toFixed(2)} – $${s.maxPrice.toFixed(2)}`
                  : "—"}
              </td>
              <td style={cellStyle}>{s.source === "seller_hub" ? "Hub" : "Public"}</td>
              <td style={cellStyle}>
                <span style={{ color: s.status === "done" ? "#4caf50" : s.status === "error" ? "#f44336" : "#ff9800" }}>
                  {s.status}
                </span>
              </td>
              <td style={cellStyle}>{new Date(s.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  padding: "8px 10px",
  textAlign: "left",
  borderBottom: "1px solid #333",
  color: "#aaa",
};

const cellStyle = {
  padding: "8px 10px",
};
