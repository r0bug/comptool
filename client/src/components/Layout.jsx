import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { apiGet } from "../api";

export default function Layout() {
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    apiGet("/stats").then(setStats).catch(() => {});
  }, [location.pathname]);

  // Close menu on navigation
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  return (
    <div className="ct-app">
      <style>{mobileStyles}</style>

      <header className="ct-header">
        <div className="ct-header-left">
          <button className="ct-hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? "\u2715" : "\u2630"}
          </button>
          <Link to="/" className="ct-logo">CompTool</Link>
          <nav className={`ct-nav ${menuOpen ? "ct-nav--open" : ""}`}>
            <NavLink to="/" label="Search" path={location.pathname} exact />
            <NavLink to="/browse" label="Browse" path={location.pathname} />
            <NavLink to="/history" label="History" path={location.pathname} exact />
            <a href="/comp/extension/" target="_blank" rel="noreferrer" className="ct-nav-link ct-nav-ext">Extension</a>
            <Link to="/bookmarklet" className="ct-nav-link ct-nav-ext">Mobile</Link>
            <Link to="/register" className="ct-nav-link ct-nav-ext">API Key</Link>
          </nav>
        </div>
        <div className="ct-header-right">
          <a href="/comp/extension/" target="_blank" rel="noreferrer" className="ct-ext-link">
            <span style={{ fontSize: 16 }}>&#8681;</span> Extension
          </a>
          <Link to="/register" className="ct-key-link">API Key</Link>
        </div>
      </header>

      <main className="ct-main">
        <Outlet />
      </main>

      <footer className="ct-footer">
        {stats && (
          <>
            <span>{stats.compCount.toLocaleString()} comps</span>
            <span>{stats.searchCount.toLocaleString()} searches</span>
            <span className="ct-footer-hide-mobile">{stats.cachedImages.toLocaleString()} images</span>
            <span className="ct-footer-hide-mobile">{stats.storageMb > 0 ? `${stats.storageMb.toLocaleString()} MB` : ""}</span>
          </>
        )}
      </footer>
    </div>
  );
}

function NavLink({ to, label, path, exact }) {
  const active = exact ? path === to : path.startsWith(to);
  return (
    <Link to={to} className={`ct-nav-link ${active ? "ct-nav-link--active" : ""}`}>
      {label}
    </Link>
  );
}

const mobileStyles = `
  .ct-app {
    min-height: 100vh; display: flex; flex-direction: column;
    background: #1a1a2e; color: #eee; font-family: system-ui, sans-serif;
  }
  .ct-header {
    background: #16213e; padding: 10px 16px; display: flex; align-items: center;
    justify-content: space-between; border-bottom: 1px solid #0f3460; position: sticky; top: 0; z-index: 100;
  }
  .ct-header-left { display: flex; align-items: center; gap: 16px; }
  .ct-logo { margin: 0; font-size: 18px; font-weight: 700; color: #eee; text-decoration: none; }
  .ct-hamburger {
    display: none; background: none; border: none; color: #aaa; font-size: 22px;
    cursor: pointer; padding: 4px 8px; line-height: 1;
  }
  .ct-nav { display: flex; gap: 14px; }
  .ct-nav-link { color: #aaa; text-decoration: none; font-size: 14px; }
  .ct-nav-link--active { color: #e94560; }
  .ct-nav-ext { display: none; }
  .ct-header-right { display: flex; align-items: center; gap: 14px; }
  .ct-ext-link { font-size: 13px; color: #7ec8e3; text-decoration: none; display: flex; align-items: center; gap: 4px; }
  .ct-key-link { font-size: 13px; color: #aaa; text-decoration: none; }
  .ct-main { flex: 1; padding: 16px; max-width: 1400px; margin: 0 auto; width: 100%; box-sizing: border-box; }
  .ct-footer {
    background: #16213e; border-top: 1px solid #0f3460; padding: 8px 16px;
    display: flex; justify-content: center; gap: 16px; font-size: 11px; color: #555;
  }

  @media (max-width: 768px) {
    .ct-hamburger { display: block; }
    .ct-nav {
      display: none; position: absolute; top: 100%; left: 0; right: 0;
      background: #16213e; flex-direction: column; padding: 12px 16px; gap: 12px;
      border-bottom: 1px solid #0f3460; z-index: 101;
    }
    .ct-nav--open { display: flex; }
    .ct-nav-ext { display: block; }
    .ct-header-right { display: none; }
    .ct-main { padding: 8px; }
    .ct-footer { gap: 10px; font-size: 10px; padding: 6px 10px; }
    .ct-footer-hide-mobile { display: none; }
    .ct-logo { font-size: 16px; }
  }
`;
