export default function StatsBar({ stats }) {
  if (!stats || stats.count === 0) return null;

  const cards = [
    { label: "Avg", value: `$${stats.avg?.toFixed(2) || stats.avgPrice?.toFixed(2) || "—"}` },
    { label: "Median", value: `$${stats.median?.toFixed(2) || stats.medianPrice?.toFixed(2) || "—"}` },
    { label: "Min", value: `$${stats.min?.toFixed(2) || stats.minPrice?.toFixed(2) || "—"}` },
    { label: "Max", value: `$${stats.max?.toFixed(2) || stats.maxPrice?.toFixed(2) || "—"}` },
    { label: "Count", value: stats.count || stats.resultCount || 0 },
  ];

  return (
    <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
      {cards.map((card) => (
        <div key={card.label} style={{ background: "#16213e", padding: "12px 20px", borderRadius: "6px", border: "1px solid #0f3460", minWidth: "100px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "#888", textTransform: "uppercase" }}>{card.label}</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#e94560" }}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
