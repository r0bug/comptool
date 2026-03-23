import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { apiGet, apiPost } from "../api";

export default function Layout() {
  const [browserStatus, setBrowserStatus] = useState({
    launched: false,
    loggedIn: false,
  });
  const [showLogin, setShowLogin] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [loginStep, setLoginStep] = useState(null);
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCookieInput, setShowCookieInput] = useState(false);
  const [cookieText, setCookieText] = useState("");
  const location = useLocation();

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  async function checkStatus() {
    try {
      const status = await apiGet("/browser/status");
      setBrowserStatus(status);
      if (status.loggedIn && showLogin) {
        setShowLogin(false);
        setScreenshot(null);
      }
    } catch {
      setBrowserStatus({ launched: false, loggedIn: false });
    }
  }

  async function handleLaunch() {
    try {
      setLoading(true);
      await apiPost("/browser/launch");
      await checkStatus();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    try {
      setLoading(true);
      const data = await apiPost("/browser/login");
      setScreenshot(data.screenshot);
      setShowLogin(true);
      setLoginStep("username");
      setInputVal("");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitUsername() {
    try {
      setLoading(true);
      await apiPost("/browser/fill", { selector: "#userid", value: inputVal });
      await apiPost("/browser/click", { selector: "#signin-continue-btn" });
      const data = await apiGet("/browser/screenshot");
      setScreenshot(data.screenshot);
      setLoginStep("password");
      setInputVal("");
    } catch (err) {
      alert("Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitPassword() {
    try {
      setLoading(true);
      await apiPost("/browser/fill", { selector: "#pass", value: inputVal });
      const data = await apiPost("/browser/click", { selector: "#sgnBt" });
      setScreenshot(data.screenshot);
      setInputVal("");
      // Show interactive step for 2FA / CAPTCHA / whatever eBay throws
      setLoginStep("interact");
      setLoading(false);
    } catch (err) {
      alert("Failed: " + err.message);
      setLoading(false);
    }
  }

  async function handleVerifyLogin() {
    try {
      setLoading(true);
      const verify = await apiPost("/browser/verify");
      setScreenshot(verify.screenshot);
      setBrowserStatus((prev) => ({ ...prev, loggedIn: verify.loggedIn }));
      setLoginStep("done");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    try {
      setLoading(true);
      await apiPost("/browser/close");
      setBrowserStatus({ launched: false, loggedIn: false });
      setShowLogin(false);
      setScreenshot(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCookieImport() {
    setShowCookieInput(true);
    setShowLogin(true);
    setLoginStep("cookies");
    setCookieText("");
  }

  async function submitCookies() {
    if (!cookieText.trim()) return;
    try {
      setLoading(true);
      const cookies = JSON.parse(cookieText);
      const data = await apiPost("/browser/import-cookies", { cookies });
      setScreenshot(data.screenshot);
      setShowCookieInput(false);
      setCookieText("");
      setLoginStep("done");
      setBrowserStatus((prev) => ({ ...prev, loggedIn: data.loggedIn }));
    } catch (err) {
      alert("Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshScreenshot() {
    try {
      const data = await apiGet("/browser/screenshot");
      setScreenshot(data.screenshot);
      await checkStatus();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleScreenshotClick(e) {
    const img = e.target;
    const rect = img.getBoundingClientRect();
    // Scale click coords from displayed size to actual viewport (1920x1080)
    const scaleX = 1920 / rect.width;
    const scaleY = 1080 / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    try {
      setLoading(true);
      const data = await apiPost("/browser/click-at", { x, y });
      setScreenshot(data.screenshot);
      await checkStatus();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  const statusColor = browserStatus.loggedIn
    ? "#4caf50"
    : browserStatus.launched
    ? "#ff9800"
    : "#f44336";

  const statusText = browserStatus.loggedIn
    ? "Connected"
    : browserStatus.launched
    ? "Not logged in"
    : "Browser off";

  return (
    <div style={{ minHeight: "100vh", background: "#1a1a2e", color: "#eee", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ background: "#16213e", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #0f3460" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>CompTool</h1>
          <nav style={{ display: "flex", gap: "16px" }}>
            <Link to="/" style={{ color: location.pathname === "/" ? "#e94560" : "#aaa", textDecoration: "none" }}>Search</Link>
            <Link to="/browse" style={{ color: location.pathname.startsWith("/browse") ? "#e94560" : "#aaa", textDecoration: "none" }}>Browse</Link>
            <Link to="/history" style={{ color: location.pathname === "/history" ? "#e94560" : "#aaa", textDecoration: "none" }}>History</Link>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: statusColor }} />
          <span style={{ fontSize: "13px", color: "#aaa" }}>{statusText}</span>
          {!browserStatus.launched && (
            <button onClick={handleLaunch} disabled={loading} style={btnStyle}>
              {loading ? "Launching..." : "Launch Browser"}
            </button>
          )}
          {browserStatus.launched && !browserStatus.loggedIn && (
            <>
              <button onClick={handleLogin} disabled={loading} style={btnStyle}>
                {loading ? "Loading..." : "Log In"}
              </button>
              <button onClick={handleCookieImport} disabled={loading} style={btnStyle}>
                Import Cookies
              </button>
            </>
          )}
          {browserStatus.launched && (
            <button onClick={handleDisconnect} disabled={loading} style={btnSmall}>
              Disconnect
            </button>
          )}
        </div>
      </header>

      {showLogin && (
        <div style={{ background: "#0d1117", borderBottom: "1px solid #333", padding: "20px" }}>
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "16px" }}>eBay Login (Remote Browser)</h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={refreshScreenshot} style={btnSmall}>Refresh</button>
                <button onClick={() => { setShowLogin(false); setScreenshot(null); }} style={btnSmall}>Close</button>
              </div>
            </div>

            {loginStep === "username" && (
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <input
                  type="text"
                  placeholder="eBay username or email"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitUsername()}
                  style={inputStyle}
                />
                <button onClick={handleSubmitUsername} disabled={loading || !inputVal} style={btnStyle}>
                  {loading ? "..." : "Continue"}
                </button>
              </div>
            )}

            {loginStep === "password" && (
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <input
                  type="password"
                  placeholder="eBay password"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitPassword()}
                  style={inputStyle}
                />
                <button onClick={handleSubmitPassword} disabled={loading || !inputVal} style={btnStyle}>
                  {loading ? "..." : "Sign In"}
                </button>
              </div>
            )}

            {loginStep === "interact" && (
              <div style={{ marginBottom: "12px" }}>
                <p style={{ fontSize: "13px", color: "#aaa", marginBottom: "8px" }}>
                  Complete any 2FA or verification below. Click the screenshot to interact, or type a code and click Send.
                </p>
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <input
                    type="text"
                    placeholder="2FA code (if needed)"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && inputVal) {
                        apiPost("/browser/fill", { selector: "input[type='text'], input[type='tel'], input[name='pin'], input[id='pin']", value: inputVal })
                          .then(() => apiPost("/browser/click", { selector: "button[type='submit'], #submitBtn, button:has-text('Continue'), button:has-text('Confirm'), button:has-text('Submit')" }))
                          .then((data) => { setScreenshot(data.screenshot); setInputVal(""); })
                          .catch((err) => alert(err.message));
                      }
                    }}
                    style={inputStyle}
                  />
                  <button
                    disabled={loading || !inputVal}
                    onClick={async () => {
                      try {
                        setLoading(true);
                        await apiPost("/browser/fill", { selector: "input[type='text'], input[type='tel'], input[name='pin'], input[id='pin']", value: inputVal });
                        const data = await apiPost("/browser/click", { selector: "button[type='submit'], #submitBtn, button:has-text('Continue'), button:has-text('Confirm'), button:has-text('Submit')" });
                        setScreenshot(data.screenshot);
                        setInputVal("");
                      } catch (err) {
                        alert(err.message);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    style={btnStyle}
                  >
                    Send
                  </button>
                  <button onClick={handleVerifyLogin} disabled={loading} style={{ ...btnStyle, background: "#2e7d32" }}>
                    {loading ? "..." : "Verify Login"}
                  </button>
                </div>
              </div>
            )}

            {loginStep === "cookies" && (
              <div style={{ marginBottom: "12px" }}>
                <p style={{ fontSize: "13px", color: "#aaa", marginBottom: "8px" }}>
                  <strong>Option 1:</strong> Go to <a href="https://www.ebay.com" target="_blank" rel="noreferrer" style={{ color: "#7ec8e3" }}>ebay.com</a> (logged in), paste this in the address bar, and press Enter:
                </p>
                <div
                  onClick={(e) => { navigator.clipboard.writeText(e.target.innerText); e.target.style.borderColor = "#4caf50"; setTimeout(() => e.target.style.borderColor = "#333", 1000); }}
                  style={{ background: "#111", padding: "10px", borderRadius: "4px", fontSize: "11px", color: "#7ec8e3", marginBottom: "12px", wordBreak: "break-all", cursor: "pointer", border: "1px solid #333", userSelect: "all" }}
                >
                  {`javascript:void(fetch('${window.location.origin}/comp/api/browser/import-cookies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cookies:document.cookie.split(';').map(c=>{const[n,...v]=c.trim().split('=');return{name:n,value:v.join('='),domain:'.ebay.com',path:'/'}})})}).then(r=>r.json()).then(d=>alert('Sent '+d.count+' cookies to CompTool!')).catch(e=>alert('Error: '+e)))`}
                </div>
                <p style={{ fontSize: "11px", color: "#666", marginBottom: "16px" }}>Click to copy. Note: Chrome strips "javascript:" — you must type it back.</p>

                <p style={{ fontSize: "13px", color: "#aaa", marginBottom: "8px" }}>
                  <strong>Option 2:</strong> Paste cookie JSON directly:
                </p>
                <textarea
                  value={cookieText}
                  onChange={(e) => setCookieText(e.target.value)}
                  placeholder='Paste cookies JSON here...'
                  rows={4}
                  style={{ ...inputStyle, width: "100%", resize: "vertical", fontFamily: "monospace", fontSize: "12px" }}
                />
                <button onClick={submitCookies} disabled={loading || !cookieText.trim()} style={{ ...btnStyle, marginTop: "8px" }}>
                  {loading ? "Importing..." : "Import Cookies"}
                </button>
              </div>
            )}

            {loginStep === "done" && (
              <p style={{ color: browserStatus.loggedIn ? "#4caf50" : "#ff9800", marginBottom: "12px" }}>
                {browserStatus.loggedIn
                  ? "Logged in successfully!"
                  : "Check screenshot below — you may need to complete a CAPTCHA or 2FA. Use Refresh to check."}
              </p>
            )}

            {screenshot && (
              <div>
                <p style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>
                  Click on the screenshot to interact with the page (CAPTCHA, buttons, etc.)
                </p>
                <img
                  src={`data:image/png;base64,${screenshot}`}
                  alt="Browser view"
                  onClick={handleScreenshotClick}
                  style={{ width: "100%", borderRadius: "6px", border: "1px solid #333", cursor: loading ? "wait" : "crosshair" }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <main style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
        <Outlet />
      </main>
    </div>
  );
}

const btnStyle = {
  padding: "6px 14px",
  background: "#0f3460",
  color: "#eee",
  border: "1px solid #e94560",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "13px",
};

const btnSmall = {
  padding: "4px 10px",
  background: "transparent",
  color: "#888",
  border: "1px solid #444",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "12px",
};

const inputStyle = {
  flex: 1,
  padding: "8px 12px",
  background: "#16213e",
  border: "1px solid #0f3460",
  borderRadius: "4px",
  color: "#eee",
  fontSize: "14px",
  outline: "none",
};
