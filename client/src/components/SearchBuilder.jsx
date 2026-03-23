import { useState } from "react";

const OPERATORS = ["AND", "OR", "NOT"];

export default function SearchBuilder({ value, onChange }) {
  // value = array of { operator: "AND"|"OR"|"NOT", term: string }
  // First row is always implicit AND (no operator shown)

  function addRow() {
    onChange([...value, { operator: "AND", term: "" }]);
  }

  function removeRow(idx) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function updateRow(idx, field, val) {
    const next = [...value];
    next[idx] = { ...next[idx], [field]: val };
    onChange(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
      {value.map((row, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {i === 0 ? (
            <span style={opLabel}>MATCH</span>
          ) : (
            <select
              value={row.operator}
              onChange={(e) => updateRow(i, "operator", e.target.value)}
              style={opSelect}
            >
              {OPERATORS.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={row.term}
            onChange={(e) => updateRow(i, "term", e.target.value)}
            placeholder={i === 0 ? "Search terms..." : row.operator === "NOT" ? "Exclude term..." : "Additional term..."}
            style={termInput}
            autoFocus={i === 0}
          />
          {i > 0 && (
            <button onClick={() => removeRow(i)} style={removeBtn} title="Remove">x</button>
          )}
        </div>
      ))}
      <button onClick={addRow} style={addBtn}>+ Add Term</button>
    </div>
  );
}

// Convert search rows to keyword + exclude strings for the API
export function buildSearchParams(rows) {
  const includes = [];
  const excludes = [];

  for (const row of rows) {
    const term = row.term.trim();
    if (!term) continue;
    if (row.operator === "NOT") {
      excludes.push(term);
    } else {
      // AND and OR both go into keyword for now
      // (Prisma contains is AND by default; OR would need a different query)
      includes.push(term);
    }
  }

  return {
    keyword: includes.join(" "),
    exclude: excludes.join(","),
  };
}

// Parse keyword + exclude back into rows
export function parseSearchParams(keyword, exclude) {
  const rows = [];
  if (keyword) {
    keyword.split(/\s+/).filter(Boolean).forEach((term, i) => {
      rows.push({ operator: i === 0 ? "AND" : "AND", term });
    });
  }
  if (exclude) {
    exclude.split(/[,\s]+/).filter(Boolean).forEach((term) => {
      rows.push({ operator: "NOT", term });
    });
  }
  if (rows.length === 0) rows.push({ operator: "AND", term: "" });
  return rows;
}

const opLabel = {
  fontSize: 11, color: "#e94560", fontWeight: 700, width: 50, textAlign: "center",
  padding: "7px 0", flexShrink: 0,
};

const opSelect = {
  width: 50, padding: "6px 4px", background: "#0f1a2e", border: "1px solid #0f3460",
  borderRadius: 4, color: "#e94560", fontSize: 11, fontWeight: 700, textAlign: "center",
  outline: "none", flexShrink: 0, cursor: "pointer",
};

const termInput = {
  flex: 1, padding: "7px 10px", background: "#16213e", border: "1px solid #0f3460",
  borderRadius: 5, color: "#eee", fontSize: 13, outline: "none", minWidth: 120,
};

const removeBtn = {
  background: "none", border: "1px solid #333", color: "#666", width: 24, height: 24,
  borderRadius: 4, cursor: "pointer", fontSize: 14, lineHeight: "22px", textAlign: "center",
  flexShrink: 0, padding: 0,
};

const addBtn = {
  background: "none", border: "1px dashed #333", color: "#666", padding: "5px 12px",
  borderRadius: 4, cursor: "pointer", fontSize: 12, alignSelf: "flex-start",
};
