import { useState, useEffect, useRef } from "react";

export default function ImageLightbox({ src, alt, onClose }) {
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragStart = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(s + 0.25, 5));
      if (e.key === "-") setScale((s) => Math.max(s - 0.25, 0.25));
      if (e.key === "0") { setScale(1); setPos({ x: 0, y: 0 }); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale((s) => Math.max(0.25, Math.min(5, s + delta)));
  }

  function handleMouseDown(e) {
    if (e.target.tagName === "IMG") {
      setDragging(true);
      dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    }
  }

  function handleMouseMove(e) {
    if (dragging && dragStart.current) {
      setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    }
  }

  function handleMouseUp() {
    setDragging(false);
    dragStart.current = null;
  }

  return (
    <div
      style={overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div style={controls}>
        <button onClick={() => setScale((s) => Math.min(s + 0.25, 5))} style={ctrlBtn}>+</button>
        <span style={{ color: "#aaa", fontSize: 13, minWidth: 50, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.max(s - 0.25, 0.25))} style={ctrlBtn}>-</button>
        <button onClick={() => { setScale(1); setPos({ x: 0, y: 0 }); }} style={ctrlBtn}>Reset</button>
        <button onClick={onClose} style={{ ...ctrlBtn, marginLeft: 16, color: "#e94560" }}>Close</button>
      </div>
      <img
        src={src}
        alt={alt || ""}
        draggable={false}
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          maxWidth: "90vw",
          maxHeight: "85vh",
          objectFit: "contain",
          cursor: dragging ? "grabbing" : "grab",
          transition: dragging ? "none" : "transform 0.15s ease",
          borderRadius: 4,
        }}
      />
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "rgba(0,0,0,0.92)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  cursor: "default",
};

const controls = {
  position: "absolute",
  top: 12,
  display: "flex",
  gap: 8,
  alignItems: "center",
  zIndex: 10000,
};

const ctrlBtn = {
  background: "rgba(255,255,255,0.1)",
  border: "1px solid #444",
  color: "#eee",
  padding: "6px 14px",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
};
