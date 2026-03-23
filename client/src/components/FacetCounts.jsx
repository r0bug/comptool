import { useState } from "react";

export default function FacetCounts({ facets, activeFilters, onApply }) {
  if (!facets) return null;

  return (
    <div style={panel}>
      {facets.categories?.length > 0 && (
        <CategoryFacet
          categories={facets.categories}
          active={activeFilters.category}
          onApply={(val) => onApply("category", val)}
        />
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
        <FacetRow label="Free Shipping" count={facets.freeShipping} active={false} onClick={() => {}} />
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

/**
 * Category facet with hierarchy support.
 * Categories stored as "eBay Motors > Parts & Accessories > Motorcycle Parts"
 * Groups by top-level, shows subcategories when expanded.
 */
function CategoryFacet({ categories, active, onApply }) {
  const [expanded, setExpanded] = useState({});

  // Build hierarchy from "A > B > C" paths
  const tree = {};
  for (const cat of categories) {
    const parts = cat.value.split(" > ").map((s) => s.trim());
    const topLevel = parts[0];
    if (!tree[topLevel]) tree[topLevel] = { count: 0, children: {}, fullPath: topLevel };
    tree[topLevel].count += cat.count;

    if (parts.length > 1) {
      const sub = parts.slice(1).join(" > ");
      if (!tree[topLevel].children[sub]) tree[topLevel].children[sub] = { count: 0, fullPath: cat.value };
      tree[topLevel].children[sub].count += cat.count;
    }
  }

  // Sort by count
  const sorted = Object.entries(tree).sort((a, b) => b[1].count - a[1].count);

  return (
    <div style={section}>
      <div style={sectionTitle}>Category</div>
      {sorted.slice(0, 12).map(([name, data]) => {
        const isExpanded = expanded[name];
        const children = Object.entries(data.children).sort((a, b) => b[1].count - a[1].count);
        const hasChildren = children.length > 0;
        const isActive = active === name || active?.startsWith(name + " > ");

        return (
          <div key={name}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {hasChildren && (
                <button
                  onClick={() => setExpanded({ ...expanded, [name]: !isExpanded })}
                  style={expandBtn}
                >
                  {isExpanded ? "▾" : "▸"}
                </button>
              )}
              <div
                onClick={() => onApply(active === name ? "" : name)}
                style={{
                  ...row,
                  flex: 1,
                  paddingLeft: hasChildren ? 0 : 16,
                  background: active === name ? "#1a2744" : "transparent",
                  borderLeft: active === name ? "2px solid #e94560" : "2px solid transparent",
                }}
              >
                <span style={{ color: isActive ? "#eee" : "#aaa" }}>{name}</span>
                <span style={countStyle}>{data.count.toLocaleString()}</span>
              </div>
            </div>

            {isExpanded && children.slice(0, 10).map(([subName, subData]) => (
              <FacetRow
                key={subData.fullPath}
                label={subName}
                count={subData.count}
                active={active === subData.fullPath}
                onClick={() => onApply(active === subData.fullPath ? "" : subData.fullPath)}
                indent
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function FacetRow({ label, count, active, onClick, indent }) {
  return (
    <div onClick={onClick} style={{
      ...row,
      paddingLeft: indent ? 24 : 8,
      background: active ? "#1a2744" : "transparent",
      borderLeft: active ? "2px solid #e94560" : "2px solid transparent",
    }}>
      <span style={{ color: active ? "#eee" : "#aaa", fontSize: indent ? 12 : 13 }}>{label}</span>
      <span style={countStyle}>{count.toLocaleString()}</span>
    </div>
  );
}

const panel = { display: "flex", flexDirection: "column", gap: 12 };
const section = {};
const sectionTitle = { fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 };
const totalBadge = { fontSize: 10, color: "#555" };
const row = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", borderRadius: 3, cursor: "pointer", fontSize: 13, transition: "background 0.1s" };
const countStyle = { fontSize: 11, color: "#555", fontFamily: "monospace" };
const expandBtn = { background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 12, padding: "2px 4px", lineHeight: 1 };
