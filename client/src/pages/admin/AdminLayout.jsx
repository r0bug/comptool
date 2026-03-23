import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { adminPost } from "../../api";

export default function AdminLayout() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem("comptool_admin_pw"));
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const location = useLocation();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    try {
      sessionStorage.setItem("comptool_admin_pw", password);
      await adminPost("/admin/auth", {});
      setAuthed(true);
    } catch (err) {
      sessionStorage.removeItem("comptool_admin_pw");
      setError("Invalid password");
    }
  }

  if (!authed) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", textAlign: "center" }}>
        <h2 style={{ marginBottom: 24 }}>Admin Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoFocus
          />
          <button type="submit" style={{ ...btnStyle, marginLeft: 8 }}>Login</button>
        </form>
        {error && <p style={{ color: "#e94560", marginTop: 12 }}>{error}</p>}
      </div>
    );
  }

  const isActive = (path) => location.pathname === `/admin${path}` || location.pathname === `/admin${path}/`;

  return (
    <div>
      <div style={{ background: "#16213e", padding: "12px 24px", display: "flex", alignItems: "center", gap: 24 }}>
        <Link to="/" style={{ color: "#e94560", textDecoration: "none", fontWeight: 700, fontSize: 18 }}>CompTool</Link>
        <nav style={{ display: "flex", gap: 16 }}>
          <Link to="/admin" style={{ color: isActive("") ? "#e94560" : "#aaa", textDecoration: "none" }}>Dashboard</Link>
          <Link to="/admin/clients" style={{ color: location.pathname.includes("/admin/clients") ? "#e94560" : "#aaa", textDecoration: "none" }}>Clients</Link>
        </nav>
        <div style={{ marginLeft: "auto" }}>
          <button
            onClick={() => { sessionStorage.removeItem("comptool_admin_pw"); setAuthed(false); }}
            style={{ background: "none", border: "1px solid #444", color: "#888", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
          >
            Logout
          </button>
        </div>
      </div>
      <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
        <Outlet />
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "10px 14px",
  background: "#16213e",
  border: "1px solid #0f3460",
  borderRadius: 6,
  color: "#eee",
  fontSize: 14,
};

const btnStyle = {
  padding: "10px 24px",
  background: "#e94560",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
};
