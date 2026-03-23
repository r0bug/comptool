import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../../api";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", company: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiPost("/clients/register", form);
      navigate("/register/success", { state: result });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 440, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, color: "#e94560", marginBottom: 8 }}>CompTool</h1>
          <p style={{ color: "#888", fontSize: 14 }}>Get your API key to start saving eBay sold comps</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={inputStyle}
            required
            minLength={2}
            autoFocus
          />

          <label style={labelStyle}>Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={inputStyle}
            required
          />

          <label style={labelStyle}>Company <span style={{ color: "#666" }}>(optional)</span></label>
          <input
            type="text"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            style={inputStyle}
          />

          {error && <p style={{ color: "#e94560", fontSize: 13, marginTop: 8 }}>{error}</p>}

          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? "Creating account..." : "Get API Key"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#666" }}>
          Already have a key? Install the <a href="/comp/extension/" style={{ color: "#7ec8e3" }}>Chrome extension</a> and configure it.
        </p>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#ccc" };
const inputStyle = { width: "100%", padding: "10px 14px", background: "#16213e", border: "1px solid #0f3460", borderRadius: 6, color: "#eee", fontSize: 14, boxSizing: "border-box" };
const btnStyle = { width: "100%", padding: "12px", background: "#e94560", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 15, marginTop: 24 };
