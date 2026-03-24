import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { apiGet } from "../api";
import CompTable from "../components/CompTable";
import CompTiles from "../components/CompTiles";
import StatsBar from "../components/StatsBar";
import FacetCounts from "../components/FacetCounts";
import SearchBuilder, { buildSearchParams, parseSearchParams } from "../components/SearchBuilder";

const PAGE_SIZES = [25, 50, 100, 200];

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [comps, setComps] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [facets, setFacets] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState(localStorage.getItem("comptool_view") || "tiles");
  const [tileSize, setTileSize] = useState(parseInt(localStorage.getItem("comptool_tile_size") || "220"));
  const [mobileCols, setMobileCols] = useState(parseInt(localStorage.getItem("comptool_mobile_cols") || "3"));
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const [showSidebar, setShowSidebar] = useState(window.innerWidth > 900);

  // URL params
  const keyword = searchParams.get("q") || "";
  const exclude = searchParams.get("not") || "";
  const minPrice = searchParams.get("min") || "";
  const maxPrice = searchParams.get("max") || "";
  const condition = searchParams.get("cond") || "";
  const category = searchParams.get("cat") || "";
  const listingType = searchParams.get("type") || "";
  const seller = searchParams.get("seller") || "";
  const dateFrom = searchParams.get("from") || "";
  const dateTo = searchParams.get("to") || "";
  const hasImage = searchParams.get("img") || "";
  const richOnly = searchParams.get("rich") || "";
  const sortBy = searchParams.get("sort") || "soldDate";
  const sortDir = searchParams.get("dir") || "desc";
  const pageSize = parseInt(searchParams.get("size") || "50");
  const page = parseInt(searchParams.get("page") || "1");

  // Search builder rows
  const [searchRows, setSearchRows] = useState(() => parseSearchParams(keyword, exclude));

  // Price form
  const [fMin, setFMin] = useState(minPrice);
  const [fMax, setFMax] = useState(maxPrice);
  const [fSeller, setFSeller] = useState(seller);
  const [fDateFrom, setFDateFrom] = useState(dateFrom);
  const [fDateTo, setFDateTo] = useState(dateTo);

  useEffect(() => {
    setSearchRows(parseSearchParams(keyword, exclude));
    setFMin(minPrice); setFMax(maxPrice); setFSeller(seller);
    setFDateFrom(dateFrom); setFDateTo(dateTo);
  }, [keyword, exclude, minPrice, maxPrice, seller, dateFrom, dateTo]);

  const fetchComps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      if (keyword) p.set("keyword", keyword);
      if (exclude) p.set("exclude", exclude);
      if (minPrice) p.set("minPrice", minPrice);
      if (maxPrice) p.set("maxPrice", maxPrice);
      if (condition) p.set("condition", condition);
      if (category) p.set("category", category);
      if (listingType) p.set("listingType", listingType);
      if (seller) p.set("seller", seller);
      if (dateFrom) p.set("dateFrom", dateFrom);
      if (dateTo) p.set("dateTo", dateTo);
      if (hasImage) p.set("hasImage", hasImage);
      if (richOnly) p.set("richOnly", richOnly);
      p.set("sortBy", sortBy);
      p.set("sortDir", sortDir);
      p.set("limit", pageSize);
      p.set("offset", (page - 1) * pageSize);

      const [result, statsData, facetData] = await Promise.all([
        apiGet(`/comps?${p}`),
        keyword ? apiGet(`/comps/stats?keyword=${encodeURIComponent(keyword)}`) : Promise.resolve(null),
        apiGet(`/comps/facets?${keyword ? `keyword=${encodeURIComponent(keyword)}` : ""}${exclude ? `&exclude=${encodeURIComponent(exclude)}` : ""}`),
      ]);

      setComps(result.comps);
      setTotal(result.total);
      setStats(statsData);
      setFacets(facetData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [keyword, exclude, minPrice, maxPrice, condition, category, listingType, seller, dateFrom, dateTo, hasImage, richOnly, sortBy, sortDir, pageSize, page]);

  useEffect(() => { fetchComps(); }, [fetchComps]);

  function applyAll(overrides = {}) {
    const { keyword: kw, exclude: ex } = buildSearchParams(searchRows);
    const params = {};
    const merged = { keyword: kw, exclude: ex, minPrice: fMin, maxPrice: fMax, condition, category, listingType, seller: fSeller, dateFrom: fDateFrom, dateTo: fDateTo, hasImage, richOnly, ...overrides };
    if (merged.keyword) params.q = merged.keyword;
    if (merged.exclude) params.not = merged.exclude;
    if (merged.minPrice) params.min = merged.minPrice;
    if (merged.maxPrice) params.max = merged.maxPrice;
    if (merged.condition) params.cond = merged.condition;
    if (merged.category) params.cat = merged.category;
    if (merged.listingType) params.type = merged.listingType;
    if (merged.seller) params.seller = merged.seller;
    if (merged.dateFrom) params.from = merged.dateFrom;
    if (merged.dateTo) params.to = merged.dateTo;
    if (merged.hasImage) params.img = merged.hasImage;
    if (merged.richOnly) params.rich = merged.richOnly;
    params.sort = sortBy; params.dir = sortDir; params.size = String(pageSize);
    setSearchParams(params);
  }

  function handleSearch(e) { e.preventDefault(); applyAll(); }

  function handleFacetApply(field, value) {
    applyAll({ [field]: value });
  }

  function handleSort(col, dir) {
    const p = Object.fromEntries(searchParams);
    p.sort = col; p.dir = dir; p.page = "1";
    setSearchParams(p);
  }

  function handleSortSelect(e) {
    const [col, dir] = e.target.value.split(":");
    handleSort(col, dir);
  }

  function handlePageChange(newPage) {
    const p = Object.fromEntries(searchParams);
    p.page = String(newPage);
    setSearchParams(p);
  }

  function clearAll() {
    setSearchRows([{ operator: "AND", term: "" }]);
    setFMin(""); setFMax(""); setFSeller(""); setFDateFrom(""); setFDateTo("");
    setSearchParams({});
  }

  const totalPages = Math.ceil(total / pageSize);
  const hasFilters = keyword || exclude || minPrice || maxPrice || condition || category || listingType || seller || dateFrom || dateTo || hasImage || richOnly;
  const filterCount = [keyword, exclude, minPrice, maxPrice, condition, category, listingType, seller, dateFrom, dateTo, hasImage, richOnly].filter(Boolean).length;

  return (
    <div className="ct-browse">
      <style>{browseStyles}</style>
      {/* Sidebar overlay on mobile */}
      {showSidebar && <div className="ct-sidebar-overlay" onClick={() => setShowSidebar(false)} />}
      {/* Sidebar with facets */}
      {showSidebar && (
        <div className="ct-sidebar">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#aaa" }}>Filters</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#555" }}>{facets?.total?.toLocaleString() || 0} total</span>
              <button className="ct-sidebar-close" onClick={() => setShowSidebar(false)}>&times;</button>
            </div>
          </div>

          {/* Price */}
          <div style={sideSection}>
            <div style={sideLabel}>Price Range</div>
            <div style={{ display: "flex", gap: 4 }}>
              <input type="number" placeholder="Min" value={fMin} onChange={(e) => setFMin(e.target.value)} style={{ ...sideInput, width: "50%" }} step="0.01" min="0" />
              <input type="number" placeholder="Max" value={fMax} onChange={(e) => setFMax(e.target.value)} style={{ ...sideInput, width: "50%" }} step="0.01" min="0" />
            </div>
          </div>

          {/* Seller */}
          <div style={sideSection}>
            <div style={sideLabel}>Seller</div>
            <input type="text" placeholder="Seller name..." value={fSeller} onChange={(e) => setFSeller(e.target.value)} style={sideInput} />
          </div>

          {/* Date range */}
          <div style={sideSection}>
            <div style={sideLabel}>Date Range</div>
            <input type="date" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} style={sideInput} />
            <input type="date" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} style={{ ...sideInput, marginTop: 4 }} />
          </div>

          {/* Data quality */}
          <div style={sideSection}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#aaa", cursor: "pointer" }}>
              <input type="checkbox" checked={richOnly === "true"} onChange={() => applyAll({ richOnly: richOnly === "true" ? "" : "true" })} />
              Detailed only
            </label>
          </div>

          <button onClick={() => applyAll()} style={sideApplyBtn}>Apply</button>

          {/* Facet counts */}
          {facets && (
            <div style={{ marginTop: 16, borderTop: "1px solid #1a2744", paddingTop: 12 }}>
              <FacetCounts facets={facets} activeFilters={{ condition, category, listingType, hasImage }} onApply={handleFacetApply} />
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Search builder */}
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "flex-start" }}>
          <SearchBuilder value={searchRows} onChange={setSearchRows} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button type="submit" style={btnPrimary}>Search</button>
            <div style={{ display: "flex", gap: 4 }}>
              <button type="button" onClick={() => setShowSidebar(!showSidebar)} style={btnSmall} title="Toggle filters">
                {showSidebar ? "Hide" : "Filters"}{filterCount > 0 ? ` (${filterCount})` : ""}
              </button>
              {hasFilters && <button type="button" onClick={clearAll} style={btnSmall}>Clear</button>}
            </div>
          </div>
        </form>

        {error && <p style={{ color: "#e94560" }}>{error}</p>}
        {stats && <StatsBar stats={stats} />}

        {/* Active filter pills */}
        {hasFilters && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {condition && <Pill label={condition} onRemove={() => applyAll({ condition: "" })} />}
            {category && <Pill label={`Cat: ${category}`} onRemove={() => applyAll({ category: "" })} color="#2e7d32" />}
            {listingType && <Pill label={listingType === "Fixed price" ? "BIN" : listingType} onRemove={() => applyAll({ listingType: "" })} />}
            {minPrice && <Pill label={`Min $${minPrice}`} onRemove={() => { setFMin(""); applyAll({ minPrice: "" }); }} />}
            {maxPrice && <Pill label={`Max $${maxPrice}`} onRemove={() => { setFMax(""); applyAll({ maxPrice: "" }); }} />}
            {seller && <Pill label={`Seller: ${seller}`} onRemove={() => { setFSeller(""); applyAll({ seller: "" }); }} />}
            {dateFrom && <Pill label={`From: ${dateFrom}`} onRemove={() => { setFDateFrom(""); applyAll({ dateFrom: "" }); }} />}
            {dateTo && <Pill label={`To: ${dateTo}`} onRemove={() => { setFDateTo(""); applyAll({ dateTo: "" }); }} />}
            {hasImage && <Pill label="Has Image" onRemove={() => applyAll({ hasImage: "" })} />}
            {richOnly && <Pill label="Detailed" onRemove={() => applyAll({ richOnly: "" })} color="#1565c0" />}
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
          <span style={{ color: "#888", fontSize: 13 }}>
            {loading ? "Loading..." : `${total.toLocaleString()} results`}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <select value={`${sortBy}:${sortDir}`} onChange={handleSortSelect} style={toolSelect}>
              <option value="soldDate:desc">Newest</option>
              <option value="soldDate:asc">Oldest</option>
              <option value="soldPrice:desc">Price High</option>
              <option value="soldPrice:asc">Price Low</option>
              <option value="totalPrice:desc">Total High</option>
              <option value="totalPrice:asc">Total Low</option>
              <option value="title:asc">Title A-Z</option>
              <option value="createdAt:desc">Recently Added</option>
            </select>
            <select value={pageSize} onChange={(e) => { const p = Object.fromEntries(searchParams); p.size = e.target.value; p.page = "1"; setSearchParams(p); }} style={{ ...toolSelect, width: 60 }}>
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {viewMode === "tiles" && (
              isMobile ? (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} onClick={() => { setMobileCols(n); localStorage.setItem("comptool_mobile_cols", n); }}
                      style={{ ...vBtn, ...(mobileCols === n ? vBtnActive : {}), padding: "4px 8px", fontSize: 12 }}>{n}</button>
                  ))}
                </div>
              ) : (
                <input type="range" min="140" max="400" value={tileSize} onChange={(e) => { setTileSize(parseInt(e.target.value)); localStorage.setItem("comptool_tile_size", e.target.value); }} style={{ width: 70, accentColor: "#e94560" }} />
              )
            )}
            <div style={{ display: "flex", gap: 2 }}>
              <button onClick={() => { setViewMode("table"); localStorage.setItem("comptool_view", "table"); }} style={{ ...vBtn, ...(viewMode === "table" ? vBtnActive : {}) }}>&#9776;</button>
              <button onClick={() => { setViewMode("tiles"); localStorage.setItem("comptool_view", "tiles"); }} style={{ ...vBtn, ...(viewMode === "tiles" ? vBtnActive : {}) }}>&#9638;</button>
            </div>
          </div>
        </div>

        {/* Results */}
        {viewMode === "tiles" ? <CompTiles comps={comps} tileSize={tileSize} mobileCols={mobileCols} /> : <CompTable comps={comps} onSort={handleSort} />}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={pagination}>
            <button onClick={() => handlePageChange(1)} disabled={page <= 1} style={pageBtn}>First</button>
            <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1} style={pageBtn}>Prev</button>
            {genPages(page, totalPages).map((p, i) =>
              p === "..." ? <span key={`d${i}`} style={{ color: "#555" }}>...</span> :
              <button key={p} onClick={() => handlePageChange(p)} style={{ ...pageBtn, ...(p === page ? { borderColor: "#e94560", color: "#e94560" } : {}) }}>{p}</button>
            )}
            <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages} style={pageBtn}>Next</button>
            <button onClick={() => handlePageChange(totalPages)} disabled={page >= totalPages} style={pageBtn}>Last</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Pill({ label, onRemove, color }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: color || "#0f3460", border: "1px solid #1a4a7a", borderRadius: 20, padding: "3px 10px", fontSize: 12, color: "#ccc" }}>
      {label}
      <button onClick={onRemove} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>x</button>
    </span>
  );
}

function genPages(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const p = [1];
  if (cur > 3) p.push("...");
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) p.push(i);
  if (cur < total - 2) p.push("...");
  p.push(total);
  return p;
}

const browseStyles = `
  .ct-browse { display: flex; gap: 16px; }
  .ct-sidebar {
    width: 220px; flex-shrink: 0; background: #111827; border: 1px solid #0f3460;
    border-radius: 8px; padding: 14px; align-self: flex-start; position: sticky; top: 16px;
  }
  .ct-sidebar-overlay { display: none; }
  .ct-sidebar-close { display: none; background: none; border: none; color: #888; font-size: 20px; cursor: pointer; }
  .ct-browse-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 6px; }
  .ct-browse-controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

  @media (max-width: 768px) {
    .ct-browse { flex-direction: column; gap: 0; }
    .ct-sidebar {
      position: fixed; top: 0; left: 0; bottom: 0; width: 280px; z-index: 200;
      border-radius: 0; overflow-y: auto; border: none; border-right: 1px solid #0f3460;
    }
    .ct-sidebar-overlay {
      display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 199;
    }
    .ct-sidebar-close { display: block; }
    .ct-browse-toolbar { flex-direction: column; align-items: stretch; }
    .ct-browse-controls { justify-content: space-between; }
  }
`;

const sideSection = { marginBottom: 12 };
const sideLabel = { fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 };
const sideInput = { width: "100%", padding: "6px 8px", background: "#16213e", border: "1px solid #0f3460", borderRadius: 4, color: "#eee", fontSize: 12, outline: "none", boxSizing: "border-box" };
const sideApplyBtn = { width: "100%", padding: "7px", background: "#e94560", color: "white", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 600, fontSize: 12 };
const btnPrimary = { padding: "8px 20px", background: "#e94560", color: "white", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" };
const btnSmall = { padding: "4px 10px", background: "transparent", color: "#888", border: "1px solid #333", borderRadius: 4, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" };
const toolSelect = { padding: "5px 8px", background: "#16213e", border: "1px solid #0f3460", borderRadius: 4, color: "#eee", fontSize: 12, outline: "none" };
const vBtn = { padding: "5px 9px", background: "#16213e", color: "#555", border: "1px solid #0f3460", borderRadius: 4, cursor: "pointer", fontSize: 15, lineHeight: 1 };
const vBtnActive = { color: "#e94560", borderColor: "#e94560" };
const pagination = { display: "flex", gap: 6, alignItems: "center", justifyContent: "center", marginTop: 16, paddingTop: 16, borderTop: "1px solid #222", flexWrap: "wrap" };
const pageBtn = { padding: "5px 12px", background: "#16213e", color: "#aaa", border: "1px solid #0f3460", borderRadius: 4, cursor: "pointer", fontSize: 12 };
