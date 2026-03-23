import { useState } from "react";
import ImageLightbox from "./ImageLightbox";
import CompContextMenu from "./CompContextMenu";

export default function CompTiles({ comps, tileSize = 220 }) {
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);

  if (!comps || comps.length === 0) {
    return <p style={{ color: "#666" }}>No results</p>;
  }

  function getImgSrc(comp) {
    if (comp.localImage) return `/comp/images/${comp.localImage}`;
    return comp.imageUrl || null;
  }

  function handleContextMenu(e, comp) {
    e.preventDefault();
    setCtxMenu({ comp, x: e.clientX, y: e.clientY });
  }

  return (
    <>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      {ctxMenu && <CompContextMenu comp={ctxMenu.comp} x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)} />}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))`, gap: 10 }}>
        {comps.map((comp, i) => {
          const src = getImgSrc(comp);
          return (
            <Tile
              key={comp.id || comp.ebayItemId || i}
              comp={comp}
              imgSrc={src}
              onImageClick={() => src && setLightboxSrc(src)}
              onContextMenu={(e) => handleContextMenu(e, comp)}
              tileSize={tileSize}
            />
          );
        })}
      </div>
    </>
  );
}

function Tile({ comp, imgSrc, onImageClick, onContextMenu, tileSize }) {
  const [hovered, setHovered] = useState(false);
  const showDetails = tileSize >= 180;

  return (
    <div
      style={tile}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={onContextMenu}
    >
      {/* Image — always visible, click opens lightbox */}
      <div style={imgContainer} onClick={onImageClick}>
        {imgSrc ? (
          <img src={imgSrc} alt={comp.title} style={imgStyle} loading="lazy" />
        ) : (
          <div style={noImg}>No Image</div>
        )}
        {/* Price badge */}
        <div style={{ ...priceBadge, background: comp.listingType === "Auction" ? "#ff9800" : "#4caf50" }}>
          ${comp.soldPrice?.toFixed(2)}
        </div>
        {/* Condition badge */}
        {comp.condition && (
          <div style={condBadge}>{comp.condition}</div>
        )}
      </div>

      {/* Info bar — always visible */}
      <div style={infoBar}>
        <div style={titleText}>{comp.title}</div>
        {hovered && showDetails && (
          <div style={detailsRow}>
            {comp.shippingPrice != null && (
              <span style={detailTag}>{comp.shippingPrice === 0 ? "Free ship" : `+$${comp.shippingPrice.toFixed(2)}`}</span>
            )}
            {comp.listingType && <span style={detailTag}>{comp.listingType === "Auction" ? `Auction${comp.bidCount ? ` (${comp.bidCount})` : ""}` : "BIN"}</span>}
            {comp.soldDate && <span style={detailTag}>{fmtDate(comp.soldDate)}</span>}
            {comp.seller && <span style={detailTag}>{comp.seller}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const tile = {
  background: "#16213e",
  border: "1px solid #0f3460",
  borderRadius: 8,
  overflow: "hidden",
  cursor: "context-menu",
  transition: "border-color 0.15s",
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
  color: "#333",
  fontSize: 12,
};

const priceBadge = {
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

const condBadge = {
  position: "absolute",
  top: 6,
  left: 6,
  background: "rgba(0,0,0,0.7)",
  color: "#ccc",
  padding: "2px 6px",
  borderRadius: 3,
  fontSize: 10,
};

const infoBar = {
  padding: "6px 8px",
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

const detailsRow = {
  display: "flex",
  gap: 4,
  flexWrap: "wrap",
  marginTop: 4,
};

const detailTag = {
  fontSize: 10,
  color: "#888",
  background: "#0f1a2e",
  padding: "1px 5px",
  borderRadius: 3,
};
