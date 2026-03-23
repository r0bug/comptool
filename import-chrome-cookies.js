#!/usr/bin/env node

/**
 * Import eBay cookies from a Chrome profile into CompTool's Playwright browser.
 *
 * Handles Chrome v11 encryption (libsecret/keyring) on Linux.
 * Requires: sqlite3 CLI, python3 with secretstorage module.
 *
 * Usage:
 *   node import-chrome-cookies.js                  # uses Default profile
 *   node import-chrome-cookies.js "Profile 1"      # uses a specific profile
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const CHROME_DIR = path.join(require("os").homedir(), ".config/google-chrome");
const profileName = process.argv[2] || "Default";

async function main() {
  const cookieDbPath = path.join(CHROME_DIR, profileName, "Cookies");
  if (!fs.existsSync(cookieDbPath)) {
    console.error(`Cookie DB not found: ${cookieDbPath}`);
    console.error(`Available profiles:`);
    fs.readdirSync(CHROME_DIR)
      .filter((d) => fs.existsSync(path.join(CHROME_DIR, d, "Cookies")))
      .forEach((d) => console.error(`  ${d}`));
    process.exit(1);
  }

  // Use Python for decryption — it handles Chrome's v11 keyring encryption
  const pyScript = path.join("/tmp", `chrome-decrypt-${Date.now()}.py`);
  const outPath = path.join(__dirname, ".ebay-cookies.json");

  fs.writeFileSync(
    pyScript,
    `
import sqlite3, os, shutil, hashlib, json, sys
try:
    import secretstorage
except ImportError:
    print("ERROR: python3-secretstorage not installed", file=sys.stderr)
    print("Install with: pip3 install secretstorage", file=sys.stderr)
    sys.exit(1)
from Crypto.Cipher import AES

conn = secretstorage.dbus_init()
collection = secretstorage.get_default_collection(conn)
chrome_pass = None
for item in collection.get_all_items():
    attrs = item.get_attributes()
    if attrs.get('application') == 'chrome' and attrs.get('xdg:schema') == 'chrome_libsecret_os_crypt_password_v2':
        chrome_pass = item.get_secret()
        break

if not chrome_pass:
    print("ERROR: Chrome encryption key not found in keyring", file=sys.stderr)
    sys.exit(1)

key = hashlib.pbkdf2_hmac('sha1', chrome_pass, b'saltysalt', 1, dklen=16)

profile = sys.argv[1]
src = os.path.expanduser(f"~/.config/google-chrome/{profile}/Cookies")
dst = f"/tmp/chrome-cookies-{os.getpid()}.db"
shutil.copy2(src, dst)
db = sqlite3.connect(dst)

cursor = db.execute("""
    SELECT name, encrypted_value, host_key, path, is_secure, is_httponly, expires_utc, samesite
    FROM cookies WHERE host_key LIKE '%ebay%'
""")

cookies = []
for name, ev, host, cpath, is_secure, is_httponly, expires_utc, samesite in cursor:
    if not ev or len(ev) < 36:
        continue
    rest = ev[3:]
    iv = b' ' * 16
    cipher = AES.new(key, AES.MODE_CBC, iv)
    dec = cipher.decrypt(rest)
    pad_byte = dec[-1]
    if 0 < pad_byte <= 16:
        dec = dec[:-pad_byte]
    if len(dec) <= 32:
        continue
    dec = dec[32:]
    val = dec.decode('utf-8', errors='replace')
    if not all(c.isprintable() or c in '\\n\\r\\t' for c in val):
        continue
    if not val:
        continue
    expires = -1
    if expires_utc > 0:
        expires = int(expires_utc / 1000000) - 11644473600
    sm = {"0": "None", "1": "Lax", "2": "Strict", "-1": "None"}
    cookies.append({
        "name": name, "value": val, "domain": host, "path": cpath,
        "expires": expires, "httpOnly": bool(is_httponly),
        "secure": bool(is_secure), "sameSite": sm.get(str(samesite), "None"),
    })

db.close()
os.unlink(dst)
print(json.dumps(cookies))
`
  );

  let cookiesJson;
  try {
    // Try system python first, fall back to venv
    const pythons = [
      "/tmp/cookievenv/bin/python",
      "python3",
    ];
    let result;
    for (const py of pythons) {
      try {
        result = execSync(
          `${py} "${pyScript}" "${profileName}"`,
          { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
        );
        break;
      } catch {
        continue;
      }
    }
    if (!result) throw new Error("No working Python found");
    cookiesJson = result.trim();
  } finally {
    try { fs.unlinkSync(pyScript); } catch {}
  }

  const cookies = JSON.parse(cookiesJson);
  if (cookies.length === 0) {
    console.error(`No eBay cookies found in Chrome profile "${profileName}".`);
    process.exit(1);
  }

  fs.writeFileSync(outPath, JSON.stringify(cookies, null, 2));
  console.log(`Decrypted ${cookies.length} eBay cookies → .ebay-cookies.json`);

  // Auto-import if the server is running
  try {
    const statusResp = await fetch("http://localhost:3002/comp/api/browser/status");
    const status = await statusResp.json();
    if (status.launched) {
      const importResp = await fetch(
        "http://localhost:3002/comp/api/browser/import-cookies",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cookies),
        }
      );
      const result = await importResp.json();
      if (result.loggedIn) {
        console.log("Imported & verified — logged into eBay!");
      } else {
        console.log("Imported but login not verified — cookies may be expired.");
      }
    } else {
      console.log("Browser not launched. Start server first, then re-run.");
    }
  } catch {
    console.log("Server not running. Start it, launch browser, then re-run.");
  }
}

main().catch(console.error);
