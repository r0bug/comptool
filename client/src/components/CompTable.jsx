import { useState } from "react";

export default function CompTable({ comps, onSort }) {
  const [sortCol, setSortCol] = useState("soldPrice");
  const [sortDir, setSortDir] = useState("desc");

  function handleSort(col) {
    const newDir = sortCol === col && sortDir === "desc" ? "asc" : "desc";
    setSortCol(col);
    setSortDir(newDir);
    if (onSort) onSort(col, newDir);
  }

  if (!comps || comps.length === 0) {
    return <p style={{ color: "#666" }}>No results</p>;
  }

  const columns = [
    { key: "imageUrl", label: "", sortable: false },
    { key: "title", label: "Title", sortable: true },
    { key: "soldPrice", label: "Price", sortable: true },
    { key: "shippingPrice", label: "Ship", sortable: false },
    { key: "totalPrice", label: "Total", sortable: true },
    { key: "condition", label: "Cond", sortable: false },
    { key: "listingType", label: "Type", sortable: false },
    { key: "bidCount", label: "Bids", sortable: false },
    { key: "soldDate", label: "Sold", sortable: true },
  ];

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                style={{
                  padding: "8px 10px",
                  textAlign: "left",
                  borderBottom: "1px solid #333",
                  color: "#aaa",
                  cursor: col.sortable ? "pointer" : "default",
                  whiteSpace: "nowrap",
                  userSelect: "none",
                }}
              >
                {col.label}
                {col.sortable && sortCol === col.key && (sortDir === "asc" ? " ▲" : " ▼")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comps.map((comp, i) => (
            <tr key={comp.id || comp.ebayItemId || i} style={{ borderBottom: "1px solid #222" }}>
              <td style={cellStyle}>
                {(comp.localImage || comp.imageUrl) && (
                  <img
                    src={comp.localImage ? `/comp/images/${comp.localImage}` : comp.imageUrl}
                    alt=""
                    style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }}
                    loading="lazy"
                  />
                )}
              </td>
              <td style={{ ...cellStyle, maxWidth: "300px" }}>
                {comp.itemUrl ? (
                  <a href={comp.itemUrl} target="_blank" rel="noreferrer" style={{ color: "#7ec8e3", textDecoration: "none" }}>
                    {comp.title}
                  </a>
                ) : (
                  comp.title
                )}
              </td>
              <td style={cellStyle}>${comp.soldPrice?.toFixed(2)}</td>
              <td style={cellStyle}>
                {comp.shippingPrice === 0 ? "Free" : comp.shippingPrice ? `$${comp.shippingPrice.toFixed(2)}` : "—"}
              </td>
              <td style={{ ...cellStyle, fontWeight: 600, color: "#4caf50" }}>
                ${comp.totalPrice?.toFixed(2) || comp.soldPrice?.toFixed(2)}
              </td>
              <td style={cellStyle}>{comp.condition || "—"}</td>
              <td style={cellStyle}>{formatType(comp.listingType)}</td>
              <td style={cellStyle}>{comp.bidCount || "—"}</td>
              <td style={cellStyle}>{formatDate(comp.soldDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatType(type) {
  if (!type) return "—";
  if (type === "buy_it_now") return "BIN";
  if (type === "auction") return "Auction";
  return type;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const cellStyle = {
  padding: "8px 10px",
  verticalAlign: "middle",
};
