import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const location = useLocation();

  return (
    <div style={{ minHeight: "100vh", background: "#1a1a2e", color: "#eee", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ background: "#16213e", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #0f3460" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>CompTool</h1>
          <nav style={{ display: "flex", gap: "16px" }}>
            <NavLink to="/" label="Search" path={location.pathname} exact />
            <NavLink to="/browse" label="Browse" path={location.pathname} />
            <NavLink to="/history" label="History" path={location.pathname} exact />
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <a
            href="/comp/extension/"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: "13px", color: "#7ec8e3", textDecoration: "none", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <span style={{ fontSize: "16px" }}>&#8681;</span> Install Extension
          </a>
          <Link
            to="/register"
            style={{ fontSize: "13px", color: "#aaa", textDecoration: "none" }}
          >
            Get API Key
          </Link>
        </div>
      </header>

      <main style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({ to, label, path, exact }) {
  const active = exact ? path === to : path.startsWith(to);
  return (
    <Link to={to} style={{ color: active ? "#e94560" : "#aaa", textDecoration: "none" }}>
      {label}
    </Link>
  );
}
