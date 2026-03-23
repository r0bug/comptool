import { useState, useEffect, useRef } from "react";

export default function CompContextMenu({ comp, x, y, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function handleEsc(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  // Adjust position to stay on screen
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 250);

  function copyText(text, label) {
    navigator.clipboard.writeText(text);
    onClose();
  }

  return (
    <div ref={ref} style={{ ...menu, left: adjustedX, top: adjustedY }}>
      {comp.itemUrl && (
        <MenuItem label="Open Listing in New Tab" onClick={() => { window.open(comp.itemUrl, "_blank"); onClose(); }} />
      )}
      {comp.ebayItemId && (
        <MenuItem label="Sell Similar on eBay" onClick={() => {
          window.open(`https://www.ebay.com/sl/prelist?mode=SellSimilar&itemId=${comp.ebayItemId}`, "_blank");
          onClose();
        }} />
      )}
      <div style={divider} />
      {comp.itemUrl && (
        <MenuItem label="Copy Listing URL" onClick={() => copyText(comp.itemUrl)} />
      )}
      {comp.ebayItemId && (
        <MenuItem label="Copy Item ID" onClick={() => copyText(comp.ebayItemId)} />
      )}
      <MenuItem label="Copy Title" onClick={() => copyText(comp.title)} />
      <MenuItem label={`Copy Price ($${comp.soldPrice?.toFixed(2)})`} onClick={() => copyText(String(comp.soldPrice))} />
      {comp.seller && (
        <>
          <div style={divider} />
          <MenuItem label={`Search Seller: ${comp.seller}`} onClick={() => {
            window.open(`https://www.ebay.com/sch/${comp.seller}/m.html?_nkw=&_armrs=1&_from=&LH_Complete=1&LH_Sold=1`, "_blank");
            onClose();
          }} />
        </>
      )}
    </div>
  );
}

function MenuItem({ label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ ...item, background: hovered ? "#1a2744" : "transparent" }}
    >
      {label}
    </div>
  );
}

const menu = {
  position: "fixed",
  zIndex: 10001,
  background: "#0d1117",
  border: "1px solid #30363d",
  borderRadius: 8,
  padding: "4px 0",
  minWidth: 200,
  boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
};

const item = {
  padding: "7px 14px",
  fontSize: 13,
  color: "#ccc",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const divider = {
  height: 1,
  background: "#21262d",
  margin: "4px 0",
};
