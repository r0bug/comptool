import { useState } from "react";
import ImageLightbox from "./ImageLightbox";

export default function CompTiles({ comps }) {
  const [lightboxSrc, setLightboxSrc] = useState(null);

  if (!comps || comps.length === 0) {
    return <p style={{ color: "#666" }}>No results</p>;
  }

  function getImgSrc(comp) {
    if (comp.localImage) return `/comp/images/${comp.localImage}`;
    return comp.imageUrl || null;
  }

  return (
    <>
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
      <div style={grid}>
        {comps.map((comp, i) => (
          <Tile
            key={comp.id || comp.ebayItemId || i}
            comp={comp}
            imgSrc={getImgSrc(comp)}
            onImageClick={() => {
              const src = getImgSrc(comp);
              if (src) setLightboxSrc(src);
            }}
          />
        ))}
      </div>
    </>
  );
}

function Tile({ comp, imgSrc, onImageClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={tile}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={imgContainer} onClick={onImageClick}>
        {imgSrc ? (
          <img src={imgSrc} alt={comp.title} style={imgStyle} loading="lazy" />
        ) : (
          <div style={noImg}>No Image</div>
        )}
        <div style={{ ...priceTag, background: comp.listingType === "Auction" ? "#ff9800" : "#4caf50" }}>
          ${comp.soldPrice?.toFixed(2)}
        </div>
      </div>

      <div style={titleBar}>
        <div style={titleText}>{comp.title}</div>
      </div>

      {/* Hover overlay with details */}
      {hovered && (
        <div style={hoverOverlay}>
          <div style={overlayTitle}>{comp.title}</div>
          <div style={overlayRow}>
            <span>Sold: <strong>${comp.soldPrice?.toFixed(2)}</strong></span>
            {comp.shippingPrice != null && (
              <span>Ship: {comp.shippingPrice === 0 ? "Free" : `$${comp.shippingPrice.toFixed(2)}`}</span>
            )}
          </div>
          {comp.totalPrice && comp.totalPrice !== comp.soldPrice && (
            <div style={overlayRow}>
              <span>Total: <strong style={{ color: "#4caf50" }}>${comp.totalPrice.toFixed(2)}</strong></span>
            </div>
          )}
          <div style={overlayRow}>
            {comp.listingType && <span>{comp.listingType}</span>}
            {comp.bidCount ? <span>{comp.bidCount} bids</span> : null}
            {comp.soldDate && <span>{formatDate(comp.soldDate)}</span>}
          </div>
          {comp.condition && <div style={overlayRow}><span>{comp.condition}</span></div>}
          <div style={overlayActions}>
            {comp.itemUrl && (
              <a href={comp.itemUrl} target="_blank" rel="noreferrer" style={actionLink}>
                View on eBay
              </a>
            )}
            {comp.itemUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(comp.itemUrl);
                }}
                style={actionBtn}
              >
                Copy URL
              </button>
            )}
            {comp.ebayItemId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(comp.ebayItemId);
                }}
                style={actionBtn}
              >
                Copy Item #
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: "12px",
};

const tile = {
  position: "relative",
  background: "#16213e",
  border: "1px solid #0f3460",
  borderRadius: 8,
  overflow: "hidden",
  cursor: "default",
};

const imgContainer = {
  position: "relative",
  width: "100%",
  aspectRatio: "1",
  overflow: "hidden",
  cursor: "pointer",
  background: "#0a0a1a",
};

const imgStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const noImg = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#444",
  fontSize: 13,
};

const priceTag = {
  position: "absolute",
  bottom: 6,
  right: 6,
  color: "white",
  padding: "3px 8px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 700,
  boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
};

const titleBar = {
  padding: "8px 10px",
};

const titleText = {
  fontSize: 12,
  color: "#ccc",
  lineHeight: 1.3,
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
};

const hoverOverlay = {
  position: "absolute",
  inset: 0,
  background: "rgba(10, 10, 30, 0.95)",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  zIndex: 10,
  overflow: "auto",
};

const overlayTitle = {
  fontSize: 13,
  fontWeight: 600,
  color: "#eee",
  lineHeight: 1.4,
  marginBottom: 4,
};

const overlayRow = {
  display: "flex",
  gap: 12,
  fontSize: 12,
  color: "#aaa",
  flexWrap: "wrap",
};

const overlayActions = {
  marginTop: "auto",
  paddingTop: 8,
  borderTop: "1px solid #333",
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const actionLink = {
  color: "#7ec8e3",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 600,
};

const actionBtn = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid #444",
  color: "#aaa",
  padding: "3px 10px",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 11,
};
