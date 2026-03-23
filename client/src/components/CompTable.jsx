import { useState } from "react";
import ImageLightbox from "./ImageLightbox";
import CompContextMenu from "./CompContextMenu";

const ALL_COLUMNS = [
  { key: "imageUrl", label: "", sortable: false, default: true },
  { key: "title", label: "Title", sortable: true, default: true },
  { key: "soldPrice", label: "Price", sortable: true, default: true },
  { key: "shippingPrice", label: "Ship", sortable: false, default: true },
  { key: "totalPrice", label: "Total", sortable: true, default: true },
  { key: "condition", label: "Condition", sortable: false, default: true },
  { key: "listingType", label: "Type", sortable: false, default: true },
  { key: "bidCount", label: "Bids", sortable: false, default: false },
  { key: "quantitySold", label: "Qty Sold", sortable: false, default: false },
  { key: "totalSales", label: "Total Sales", sortable: false, default: false },
  { key: "watchers", label: "Watchers", sortable: false, default: false },
  { key: "seller", label: "Seller", sortable: false, default: false },
  { key: "sellerFeedback", label: "Feedback", sortable: false, default: false },
  { key: "soldDate", label: "Sold", sortable: true, default: true },
  { key: "ebayItemId", label: "Item ID", sortable: false, default: false },
];

function getDefaultCols() {
  try {
    const saved = localStorage.getItem("comptool_columns");
    if (saved) return JSON.parse(saved);
  } catch {}
  return ALL_COLUMNS.filter((c) => c.default).map((c) => c.key);
}

export default function CompTable({ comps, onSort }) {
  const [sortCol, setSortCol] = useState("soldPrice");
  const [sortDir, setSortDir] = useState("desc");
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [visibleCols, setVisibleCols] = useState(getDefaultCols);
  const [showColPicker, setShowColPicker] = useState(false);

  function handleSort(col) {
    const newDir = sortCol === col && sortDir === "desc" ? "asc" : "desc";
    setSortCol(col);
    setSortDir(newDir);
    if (onSort) onSort(col, newDir);
  }

  function toggleCol(key) {
    const next = visibleCols.includes(key) ? visibleCols.filter((c) => c !== key) : [...visibleCols, key];
    setVisibleCols(next);
    localStorage.setItem("comptool_columns", JSON.stringify(next));
  }

  function getImgSrc(comp) {
    if (comp.localImage) return `/comp/images/${comp.localImage}`;
    return comp.imageUrl || null;
  }

  function handleContextMenu(e, comp) {
    e.preventDefault();
    setCtxMenu({ comp, x: e.clientX, y: e.clientY });
  }

  const columns = ALL_COLUMNS.filter((c) => visibleCols.includes(c.key));

  if (!comps || comps.length === 0) {
    return <p style={{ color: "#666" }}>No results</p>;
  }

  return (
    <>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      {ctxMenu && <CompContextMenu comp={ctxMenu.comp} x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)} />}

      {/* Column picker */}
      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => setShowColPicker(!showColPicker)} style={colPickerBtn}>
          Columns ({columns.length})
        </button>
        {showColPicker && (
          <div style={colPickerPanel}>
            {ALL_COLUMNS.filter((c) => c.key !== "imageUrl").map((col) => (
              <label key={col.key} style={colCheckLabel}>
                <input type="checkbox" checked={visibleCols.includes(col.key)} onChange={() => toggleCol(col.key)} />
                {col.label}
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  style={{
                    padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #333",
                    color: "#aaa", cursor: col.sortable ? "pointer" : "default",
                    whiteSpace: "nowrap", userSelect: "none",
                  }}
                >
                  {col.label}
                  {col.sortable && sortCol === col.key && (sortDir === "asc" ? " ▲" : " ▼")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comps.map((comp, i) => {
              const src = getImgSrc(comp);
              return (
                <tr
                  key={comp.id || comp.ebayItemId || i}
                  style={{ borderBottom: "1px solid #222" }}
                  onContextMenu={(e) => handleContextMenu(e, comp)}
                >
                  {columns.map((col) => (
                    <td key={col.key} style={col.key === "title" ? { ...cell, maxWidth: 300 } : cell}>
                      {renderCell(col.key, comp, src, () => src && setLightboxSrc(src))}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function renderCell(key, comp, imgSrc, onImgClick) {
  switch (key) {
    case "imageUrl":
      return imgSrc ? (
        <img src={imgSrc} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, cursor: "pointer" }}
          loading="lazy" onClick={onImgClick} />
      ) : null;
    case "title":
      return comp.itemUrl ? (
        <a href={comp.itemUrl} target="_blank" rel="noreferrer" style={{ color: "#7ec8e3", textDecoration: "none" }}>{comp.title}</a>
      ) : comp.title;
    case "soldPrice":
      return `$${comp.soldPrice?.toFixed(2)}`;
    case "shippingPrice":
      return comp.shippingPrice === 0 ? "Free" : comp.shippingPrice ? `$${comp.shippingPrice.toFixed(2)}` : "—";
    case "totalPrice":
      return <span style={{ fontWeight: 600, color: "#4caf50" }}>${(comp.totalPrice || comp.soldPrice)?.toFixed(2)}</span>;
    case "condition":
      return comp.condition || "—";
    case "listingType":
      return formatType(comp.listingType);
    case "bidCount":
      return comp.bidCount || "—";
    case "quantitySold":
      return comp.quantitySold?.toLocaleString() || "—";
    case "totalSales":
      return comp.totalSales ? `$${comp.totalSales.toLocaleString()}` : "—";
    case "watchers":
      return comp.watchers || "—";
    case "seller":
      return comp.seller || "—";
    case "sellerFeedback":
      return comp.sellerFeedback?.toLocaleString() || "—";
    case "soldDate":
      return formatDate(comp.soldDate);
    case "ebayItemId":
      return <span style={{ fontFamily: "monospace", fontSize: 11 }}>{comp.ebayItemId}</span>;
    default:
      return "—";
  }
}

function formatType(type) {
  if (!type) return "—";
  if (type.toLowerCase().includes("fixed")) return "BIN";
  if (type.toLowerCase().includes("auction")) return "Auction";
  return type;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const cell = { padding: "8px 10px", verticalAlign: "middle" };

const colPickerBtn = {
  padding: "4px 10px", background: "#16213e", color: "#888", border: "1px solid #0f3460",
  borderRadius: 4, cursor: "pointer", fontSize: 12,
};

const colPickerPanel = {
  display: "flex", gap: 12, flexWrap: "wrap", padding: "8px 12px",
  background: "#111827", border: "1px solid #0f3460", borderRadius: 6, fontSize: 12,
};

const colCheckLabel = {
  display: "flex", alignItems: "center", gap: 4, color: "#aaa", cursor: "pointer", whiteSpace: "nowrap",
};
