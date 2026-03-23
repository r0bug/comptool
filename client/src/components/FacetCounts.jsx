export default function FacetCounts({ facets, activeFilters, onApply }) {
  if (!facets) return null;

  return (
    <div style={panel}>
      {facets.categories?.length > 0 && (
        <div style={section}>
          <div style={sectionTitle}>Category</div>
          {facets.categories.slice(0, 10).map((c) => (
            <FacetRow
              key={c.value}
              label={c.value}
              count={c.count}
              active={activeFilters.category === c.value}
              onClick={() => onApply("category", activeFilters.category === c.value ? "" : c.value)}
            />
          ))}
        </div>
      )}

      <div style={section}>
        <div style={sectionTitle}>Condition <span style={totalBadge}>{facets.conditions.reduce((a, c) => a + c.count, 0)}</span></div>
        {facets.conditions.slice(0, 8).map((c) => (
          <FacetRow
            key={c.value}
            label={c.value}
            count={c.count}
            active={activeFilters.condition === c.value}
            onClick={() => onApply("condition", activeFilters.condition === c.value ? "" : c.value)}
          />
        ))}
      </div>

      <div style={section}>
        <div style={sectionTitle}>Listing Type</div>
        {facets.listingTypes.map((c) => (
          <FacetRow
            key={c.value}
            label={c.value === "Fixed price" ? "Buy It Now" : c.value}
            count={c.count}
            active={activeFilters.listingType === c.value}
            onClick={() => onApply("listingType", activeFilters.listingType === c.value ? "" : c.value)}
          />
        ))}
      </div>

      <div style={section}>
        <div style={sectionTitle}>Shipping</div>
        <FacetRow
          label="Free Shipping"
          count={facets.freeShipping}
          active={false}
          onClick={() => {}}
        />
      </div>

      <div style={section}>
        <div style={sectionTitle}>Images</div>
        <FacetRow
          label="Has Image"
          count={facets.withImages}
          active={activeFilters.hasImage === "true"}
          onClick={() => onApply("hasImage", activeFilters.hasImage === "true" ? "" : "true")}
        />
      </div>
    </div>
  );
}

function FacetRow({ label, count, active, onClick }) {
  return (
    <div onClick={onClick} style={{ ...row, background: active ? "#1a2744" : "transparent", borderLeft: active ? "2px solid #e94560" : "2px solid transparent" }}>
      <span style={{ color: active ? "#eee" : "#aaa" }}>{label}</span>
      <span style={countStyle}>{count.toLocaleString()}</span>
    </div>
  );
}

const panel = { display: "flex", flexDirection: "column", gap: 12 };

const section = {};

const sectionTitle = {
  fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.5px",
  marginBottom: 4, display: "flex", alignItems: "center", gap: 6,
};

const totalBadge = { fontSize: 10, color: "#555" };

const row = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "4px 8px", borderRadius: 3, cursor: "pointer", fontSize: 13, transition: "background 0.1s",
};

const countStyle = { fontSize: 11, color: "#555", fontFamily: "monospace" };
