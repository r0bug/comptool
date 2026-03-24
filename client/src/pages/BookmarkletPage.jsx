import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

// The bookmarklet code — same scraping logic as content-sold.js
// Minified into a single javascript: URL
const BOOKMARKLET_CODE = `javascript:void(function(){var A="https://listflow.robug.com",K=localStorage.getItem("ct_key")||prompt("Enter your CompTool API key:");if(!K)return;localStorage.setItem("ct_key",K);var j=["eBay","All","More","See All","Back",""];var cl=document.querySelectorAll('.seo-breadcrumb-text a,[class*="breadcrumb"] a');var cat=null;if(cl.length>0){var lk=Array.from(cl).map(function(a){return{t:a.textContent.trim(),c:a.href.match(/\\/(\\d+)\\//)?a.href.match(/\\/(\\d+)\\//)[1]:""}}).filter(function(l){return l.t&&j.indexOf(l.t)<0&&l.t.length>1&&l.t.length<80});if(lk.length>0){var p=[lk[0]];for(var i=1;i<lk.length&&p.length<4;i++){if(lk[i].c!==p[p.length-1].c)p.push(lk[i]);else break}cat=p.map(function(l){return l.t}).join(" > ")}}var nkw=new URL(location.href).searchParams.get("_nkw");var kw=nkw||document.title.replace(/[|\\-].*/,"").trim()||"uncategorized";var items=[];document.querySelectorAll(".srp-results li.s-card,.srp-results .s-item").forEach(function(el){try{var te=el.querySelector('[class*="title"],[role="heading"],.s-item__title');if(!te)return;var t=te.textContent.trim();if(!t||t.length<3||t.indexOf("Shop on eBay")>=0)return;var le=el.querySelector('a[href*="/itm/"]');var u=le?le.href:"";var m=u.match(/\\/itm\\/(\\d+)/);var id=m?m[1]:"pub-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);var pe=el.querySelector('[class*="price"]');var sp=0;if(pe){var pm=pe.textContent.match(/\\$?([\\d,]+\\.?\\d*)/);if(pm)sp=parseFloat(pm[1].replace(",",""))}if(sp===0)return;var sh=null;el.querySelectorAll("span").forEach(function(s){if(sh!==null)return;var st=s.textContent.trim();if(st.match(/free\\s*(delivery|shipping)/i)){sh=0}else{var sm=st.match(/\\+?\\$?([\\d,]+\\.?\\d*)\\s*(delivery|shipping)/i);if(sm)sh=parseFloat(sm[1].replace(",",""))}});var ce=el.querySelector('.SECONDARY_INFO,[class*="condition"],[class*="subtitle"]');var co=ce?ce.textContent.trim():null;var lt="Fixed price";var bc=null;var be=el.querySelector('[class*="bids"],.s-item__bids');if(be){lt="Auction";var bm=be.textContent.match(/(\\d+)\\s*bid/);if(bm)bc=parseInt(bm[1])}var ie=el.querySelector("img");var iu=ie?ie.src:null;var sd=new Date().toISOString();var at=el.textContent||"";var dm=at.match(/Sold\\s+(\\w+\\s+\\d+,?\\s*\\d{4})/i);if(dm){var dp=new Date(dm[1]);if(!isNaN(dp.getTime()))sd=dp.toISOString()}var tp=sh!==null?sp+sh:sp;var ic=null;var ice=el.querySelector('[class*="category"] a,[class*="breadcrumb"] a');if(ice){var ict=ice.textContent.trim();if(ict&&ict!=="More"&&ict.length>1&&ict.length<60)ic=ict}items.push({ebayItemId:id,title:t,soldPrice:sp,shippingPrice:sh,totalPrice:tp,condition:co,category:ic||cat,listingType:lt,bidCount:bc,seller:null,sellerFeedback:null,imageUrl:iu,itemUrl:u||null,soldDate:sd})}catch(e){}});if(items.length===0){alert("CompTool: No sold items found on this page");return}var d=document.createElement("div");d.style.cssText="position:fixed;top:10px;right:10px;z-index:99999;background:#16213e;color:#eee;padding:12px 16px;border-radius:8px;font:14px system-ui;border:2px solid #e94560;box-shadow:0 4px 20px rgba(0,0,0,0.5)";d.textContent="CompTool: Saving "+items.length+" comps...";document.body.appendChild(d);fetch(A+"/comp/api/ingest",{method:"POST",headers:{"Content-Type":"application/json","X-API-Key":K},body:JSON.stringify({keyword:kw,items:items,source:"bookmarklet"})}).then(function(r){return r.json()}).then(function(r){var c=r.resultCount||items.length;var a=r.stats&&r.stats.avg?", avg $"+r.stats.avg.toFixed(2):"";d.style.borderColor="#4caf50";d.textContent="CompTool: Saved "+c+" comps"+a;setTimeout(function(){d.remove()},4000)}).catch(function(e){d.style.borderColor="#f44336";d.textContent="CompTool Error: "+e.message;setTimeout(function(){d.remove()},5000)})})()`;

export default function BookmarkletPage() {
  const [apiKey, setApiKey] = useState("");
  const [customCode, setCustomCode] = useState(BOOKMARKLET_CODE);

  // Generate personalized bookmarklet with embedded key
  useEffect(() => {
    if (apiKey) {
      setCustomCode(BOOKMARKLET_CODE.replace(
        'localStorage.getItem("ct_key")||prompt("Enter your CompTool API key:")',
        `"${apiKey}"`
      ));
    } else {
      setCustomCode(BOOKMARKLET_CODE);
    }
  }, [apiKey]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1a2e", color: "#eee" }}>
      <div style={{ width: "100%", maxWidth: 600, padding: 24 }}>
        <style>{styles}</style>

        <h1 style={{ fontSize: 24, marginBottom: 8, textAlign: "center" }}>CompTool Mobile Bookmarklet</h1>
        <p style={{ color: "#888", textAlign: "center", marginBottom: 24, fontSize: 14 }}>
          Save eBay sold comps from any mobile browser — no extension needed.
          One tap saves all items on the page (up to 240).
        </p>

        {/* Step 1 */}
        <div className="bm-section">
          <h3>Step 1: Enter your API key</h3>
          <p className="bm-hint">Optional — if you skip this, it'll ask each time you use it.</p>
          <input
            type="text"
            placeholder="ct_your_api_key_here"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="bm-input"
          />
          <p className="bm-hint">
            Don't have one? <Link to="/register" style={{ color: "#7ec8e3" }}>Register here</Link>
          </p>
        </div>

        {/* Step 2 */}
        <div className="bm-section">
          <h3>Step 2: Add the bookmarklet</h3>

          <div className="bm-method">
            <h4>Method A — Drag to bookmarks bar (desktop)</h4>
            <p className="bm-hint">Drag this button to your bookmarks bar:</p>
            <a href={customCode} className="bm-drag-btn" onClick={(e) => { e.preventDefault(); alert("Drag this to your bookmarks bar — don't click it here!"); }}>
              Save Comps
            </a>
          </div>

          <div className="bm-method">
            <h4>Method B — Mobile (Android/iOS)</h4>
            <ol className="bm-steps">
              <li>Bookmark this page (any page will do)</li>
              <li>Edit the bookmark</li>
              <li>Replace the URL with the code below</li>
              <li>Name it <strong>"Save Comps"</strong></li>
            </ol>
            <div className="bm-code-box">
              <code className="bm-code">{customCode}</code>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(customCode); }}
              className="bm-copy-btn"
            >
              Copy Bookmarklet Code
            </button>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bm-section">
          <h3>Step 3: Use it</h3>
          <ol className="bm-steps">
            <li>Go to <strong>ebay.com</strong> in your browser</li>
            <li>Search for something and check <strong>Sold Items</strong></li>
            <li>Tap your <strong>"Save Comps"</strong> bookmark</li>
            <li>A popup shows how many comps were saved</li>
            <li>Works on any page with sold items — search results, seller pages, category pages</li>
          </ol>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, display: "flex", gap: 16, justifyContent: "center" }}>
          <Link to="/browse" style={{ color: "#7ec8e3", textDecoration: "none", fontWeight: 600 }}>Browse Comps</Link>
          <Link to="/" style={{ color: "#e94560", textDecoration: "none", fontWeight: 600 }}>Home</Link>
        </div>
      </div>
    </div>
  );
}

const styles = `
  .bm-section { background: #16213e; border: 1px solid #0f3460; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
  .bm-section h3 { font-size: 15px; margin-bottom: 8px; }
  .bm-section h4 { font-size: 13px; color: #aaa; margin: 12px 0 6px; }
  .bm-hint { font-size: 12px; color: #666; margin: 4px 0; }
  .bm-input { width: 100%; padding: 10px 12px; background: #0a0a1a; border: 1px solid #0f3460; border-radius: 6px; color: #eee; font-size: 14px; font-family: monospace; box-sizing: border-box; outline: none; }
  .bm-method { margin-top: 12px; }
  .bm-steps { color: #ccc; line-height: 2; padding-left: 20px; font-size: 14px; }
  .bm-drag-btn {
    display: inline-block; padding: 10px 24px; background: #e94560; color: white; text-decoration: none;
    border-radius: 6px; font-weight: 700; font-size: 14px; cursor: grab;
  }
  .bm-code-box {
    background: #0a0a1a; border: 1px solid #333; border-radius: 6px; padding: 10px;
    margin: 8px 0; max-height: 80px; overflow: auto; word-break: break-all;
  }
  .bm-code { font-size: 10px; color: #888; font-family: monospace; }
  .bm-copy-btn {
    padding: 8px 20px; background: #e94560; color: white; border: none; border-radius: 6px;
    cursor: pointer; font-weight: 600; font-size: 13px;
  }

  @media (max-width: 768px) {
    .bm-section { padding: 14px; }
    .bm-drag-btn { display: none; }
  }
`;
