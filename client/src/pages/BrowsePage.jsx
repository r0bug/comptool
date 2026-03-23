import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { apiGet } from "../api";
import CompTable from "../components/CompTable";
import CompTiles from "../components/CompTiles";
import StatsBar from "../components/StatsBar";

const PAGE_SIZES = [25, 50, 100, 200];

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [comps, setComps] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState(localStorage.getItem("comptool_view") || "tiles");
  const [tileSize, setTileSize] = useState(parseInt(localStorage.getItem("comptool_tile_size") || "220"));
  const [showFilters, setShowFilters] = useState(true);

  // Read from URL
  const keyword = searchParams.get("q") || "";
  const exclude = searchParams.get("not") || "";
  const minPrice = searchParams.get("min") || "";
  const maxPrice = searchParams.get("max") || "";
  const condition = searchParams.get("cond") || "";
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

  // Form state
  const [f, setF] = useState({
    keyword, exclude, minPrice: minPrice, maxPrice: maxPrice,
    condition, listingType, seller, dateFrom, dateTo, hasImage, richOnly,
  });

  useEffect(() => {
    setF({ keyword, exclude, minPrice, maxPrice, condition, listingType, seller, dateFrom, dateTo, hasImage });
  }, [keyword, exclude, minPrice, maxPrice, condition, listingType, seller, dateFrom, dateTo, hasImage, richOnly]);

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

      const result = await apiGet(`/comps?${p}`);
      setComps(result.comps);
      setTotal(result.total);

      if (keyword) {
        const s = await apiGet(`/comps/stats?keyword=${encodeURIComponent(keyword)}`);
        setStats(s);
      } else {
        setStats(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [keyword, exclude, minPrice, maxPrice, condition, listingType, seller, dateFrom, dateTo, hasImage, richOnly, sortBy, sortDir, pageSize, page]);

  useEffect(() => { fetchComps(); }, [fetchComps]);

  function applyFilters(overrides = {}) {
    const params = {};
    const merged = { ...f, ...overrides };
    if (merged.keyword?.trim()) params.q = merged.keyword.trim();
    if (merged.exclude?.trim()) params.not = merged.exclude.trim();
    if (merged.minPrice) params.min = merged.minPrice;
    if (merged.maxPrice) params.max = merged.maxPrice;
    if (merged.condition) params.cond = merged.condition;
    if (merged.listingType) params.type = merged.listingType;
    if (merged.seller?.trim()) params.seller = merged.seller.trim();
    if (merged.dateFrom) params.from = merged.dateFrom;
    if (merged.dateTo) params.to = merged.dateTo;
    if (merged.hasImage) params.img = merged.hasImage;
    if (merged.richOnly) params.rich = merged.richOnly;
    params.sort = sortBy;
    params.dir = sortDir;
    params.size = String(pageSize);
    setSearchParams(params);
  }

  function handleSearch(e) {
    e.preventDefault();
    applyFilters();
  }

  function handleSort(col, dir) {
    const params = Object.fromEntries(searchParams);
    params.sort = col;
    params.dir = dir;
    params.page = "1";
    setSearchParams(params);
  }

  function handleSortSelect(e) {
    const [col, dir] = e.target.value.split(":");
    handleSort(col, dir);
  }

  function handlePageChange(newPage) {
    const params = Object.fromEntries(searchParams);
    params.page = String(newPage);
    setSearchParams(params);
  }

  function handlePageSizeChange(newSize) {
    const params = Object.fromEntries(searchParams);
    params.size = String(newSize);
    params.page = "1";
    setSearchParams(params);
  }

  function clearAll() {
    setF({ keyword: "", exclude: "", minPrice: "", maxPrice: "", condition: "", listingType: "", seller: "", dateFrom: "", dateTo: "", hasImage: "", richOnly: "" });
    setSearchParams({});
  }

  function handleTileSize(val) {
    setTileSize(val);
    localStorage.setItem("comptool_tile_size", val);
  }

  const totalPages = Math.ceil(total / pageSize);
  const hasFilters = keyword || exclude || minPrice || maxPrice || condition || listingType || seller || dateFrom || dateTo || hasImage || richOnly;
  const activeFilterCount = [keyword, exclude, minPrice, maxPrice, condition, listingType, seller, dateFrom, dateTo, hasImage, richOnly].filter(Boolean).length;

  return (
    <div>
      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Search comps..."
          value={f.keyword}
          onChange={(e) => setF({ ...f, keyword: e.target.value })}
          style={{ ...input, flex: 1 }}
          autoFocus
        />
        <input
          type="text"
          placeholder="Exclude terms..."
          value={f.exclude}
          onChange={(e) => setF({ ...f, exclude: e.target.value })}
          style={{ ...input, width: 160 }}
          title="Comma or space separated terms to exclude"
        />
        <button type="submit" style={btnPrimary}>Search</button>
        <button type="button" onClick={() => setShowFilters(!showFilters)} style={{ ...btnGhost, position: "relative" }}>
          Filters
          {activeFilterCount > 2 && <span style={badge}>{activeFilterCount - (keyword ? 1 : 0) - (exclude ? 1 : 0)}</span>}
        </button>
        {hasFilters && <button type="button" onClick={clearAll} style={btnGhost}>Clear</button>}
      </form>

      {/* Advanced filters */}
      {showFilters && (
        <div style={filterPanel}>
          <div style={filterGrid}>
            <FilterGroup label="Price Range">
              <div style={{ display: "flex", gap: 6 }}>
                <input type="number" placeholder="Min $" value={f.minPrice} onChange={(e) => setF({ ...f, minPrice: e.target.value })} style={{ ...input, width: 80 }} step="0.01" min="0" />
                <span style={{ color: "#555", lineHeight: "34px" }}>—</span>
                <input type="number" placeholder="Max $" value={f.maxPrice} onChange={(e) => setF({ ...f, maxPrice: e.target.value })} style={{ ...input, width: 80 }} step="0.01" min="0" />
              </div>
            </FilterGroup>
            <FilterGroup label="Condition">
              <select value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })} style={input}>
                <option value="">Any</option>
                <option value="Brand New">Brand New</option>
                <option value="New (Other)">New (Other)</option>
                <option value="Open Box">Open Box</option>
                <option value="Pre-Owned">Pre-Owned</option>
                <option value="Parts Only">Parts Only</option>
                <option value="Remanufactured">Remanufactured</option>
                <option value="Refurbished">Refurbished</option>
              </select>
            </FilterGroup>
            <FilterGroup label="Listing Type">
              <select value={f.listingType} onChange={(e) => setF({ ...f, listingType: e.target.value })} style={input}>
                <option value="">Any</option>
                <option value="Fixed price">Buy It Now</option>
                <option value="Auction">Auction</option>
              </select>
            </FilterGroup>
            <FilterGroup label="Seller">
              <input type="text" placeholder="Seller name..." value={f.seller} onChange={(e) => setF({ ...f, seller: e.target.value })} style={input} />
            </FilterGroup>
            <FilterGroup label="Sold After">
              <input type="date" value={f.dateFrom} onChange={(e) => setF({ ...f, dateFrom: e.target.value })} style={input} />
            </FilterGroup>
            <FilterGroup label="Sold Before">
              <input type="date" value={f.dateTo} onChange={(e) => setF({ ...f, dateTo: e.target.value })} style={input} />
            </FilterGroup>
            <FilterGroup label="Images">
              <select value={f.hasImage} onChange={(e) => setF({ ...f, hasImage: e.target.value })} style={input}>
                <option value="">Any</option>
                <option value="true">Has Image</option>
              </select>
            </FilterGroup>
            <FilterGroup label="Data Source">
              <select value={f.richOnly} onChange={(e) => setF({ ...f, richOnly: e.target.value })} style={input}>
                <option value="">All Sources</option>
                <option value="true">Detailed Only</option>
              </select>
            </FilterGroup>
          </div>
          <button onClick={() => applyFilters()} style={{ ...btnPrimary, marginTop: 8, fontSize: 12, padding: "6px 16px" }}>Apply Filters</button>
        </div>
      )}

      {error && <p style={{ color: "#e94560" }}>{error}</p>}
      {stats && <StatsBar stats={stats} />}

      {/* Active filter pills */}
      {hasFilters && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {keyword && <Pill label={`"${keyword}"`} onRemove={() => applyFilters({ keyword: "" })} />}
          {exclude && <Pill label={`NOT: ${exclude}`} onRemove={() => applyFilters({ exclude: "" })} color="#c62828" />}
          {minPrice && <Pill label={`Min $${minPrice}`} onRemove={() => applyFilters({ minPrice: "" })} />}
          {maxPrice && <Pill label={`Max $${maxPrice}`} onRemove={() => applyFilters({ maxPrice: "" })} />}
          {condition && <Pill label={condition} onRemove={() => applyFilters({ condition: "" })} />}
          {listingType && <Pill label={listingType} onRemove={() => applyFilters({ listingType: "" })} />}
          {seller && <Pill label={`Seller: ${seller}`} onRemove={() => applyFilters({ seller: "" })} />}
          {dateFrom && <Pill label={`From: ${dateFrom}`} onRemove={() => applyFilters({ dateFrom: "" })} />}
          {dateTo && <Pill label={`To: ${dateTo}`} onRemove={() => applyFilters({ dateTo: "" })} />}
          {hasImage && <Pill label="Has Image" onRemove={() => applyFilters({ hasImage: "" })} />}
          {richOnly && <Pill label="Detailed Only" onRemove={() => applyFilters({ richOnly: "" })} color="#1565c0" />}
        </div>
      )}

      {/* Toolbar: count, sort, view, tile size */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ color: "#888", fontSize: 13 }}>
          {loading ? "Loading..." : `${total.toLocaleString()} comp${total !== 1 ? "s" : ""}`}
          {keyword && ` matching "${keyword}"`}
          {exclude && ` excluding "${exclude}"`}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Sort */}
          <select value={`${sortBy}:${sortDir}`} onChange={handleSortSelect} style={{ ...input, fontSize: 12, padding: "5px 8px" }}>
            <option value="soldDate:desc">Newest First</option>
            <option value="soldDate:asc">Oldest First</option>
            <option value="soldPrice:desc">Price: High → Low</option>
            <option value="soldPrice:asc">Price: Low → High</option>
            <option value="totalPrice:desc">Total: High → Low</option>
            <option value="totalPrice:asc">Total: Low → High</option>
            <option value="title:asc">Title: A → Z</option>
            <option value="title:desc">Title: Z → A</option>
            <option value="createdAt:desc">Recently Added</option>
          </select>

          {/* Page size */}
          <select value={pageSize} onChange={(e) => handlePageSizeChange(parseInt(e.target.value))} style={{ ...input, fontSize: 12, padding: "5px 8px", width: 70 }}>
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Tile size slider (only in tile mode) */}
          {viewMode === "tiles" && (
            <input
              type="range"
              min="140"
              max="400"
              value={tileSize}
              onChange={(e) => handleTileSize(parseInt(e.target.value))}
              style={{ width: 80, accentColor: "#e94560" }}
              title={`Tile size: ${tileSize}px`}
            />
          )}

          {/* View toggle */}
          <div style={{ display: "flex", gap: 2 }}>
            <button onClick={() => { setViewMode("table"); localStorage.setItem("comptool_view", "table"); }}
              style={{ ...viewBtn, ...(viewMode === "table" ? viewBtnActive : {}) }} title="Table">&#9776;</button>
            <button onClick={() => { setViewMode("tiles"); localStorage.setItem("comptool_view", "tiles"); }}
              style={{ ...viewBtn, ...(viewMode === "tiles" ? viewBtnActive : {}) }} title="Tiles">&#9638;</button>
          </div>
        </div>
      </div>

      {/* Results */}
      {viewMode === "tiles" ? (
        <CompTiles comps={comps} tileSize={tileSize} />
      ) : (
        <CompTable comps={comps} onSort={handleSort} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={pagination}>
          <button onClick={() => handlePageChange(1)} disabled={page <= 1} style={pageBtn}>First</button>
          <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1} style={pageBtn}>Prev</button>

          {generatePageNumbers(page, totalPages).map((p, i) =>
            p === "..." ? (
              <span key={`dot-${i}`} style={{ color: "#555" }}>...</span>
            ) : (
              <button key={p} onClick={() => handlePageChange(p)}
                style={{ ...pageBtn, ...(p === page ? { borderColor: "#e94560", color: "#e94560" } : {}) }}>{p}</button>
            )
          )}

          <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages} style={pageBtn}>Next</button>
          <button onClick={() => handlePageChange(totalPages)} disabled={page >= totalPages} style={pageBtn}>Last</button>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      {children}
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

function generatePageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

// Styles
const input = { padding: "7px 10px", background: "#16213e", border: "1px solid #0f3460", borderRadius: 5, color: "#eee", fontSize: 13, outline: "none" };
const btnPrimary = { padding: "8px 20px", background: "#e94560", color: "white", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 600, fontSize: 13 };
const btnGhost = { padding: "8px 14px", background: "transparent", color: "#888", border: "1px solid #333", borderRadius: 5, cursor: "pointer", fontSize: 13 };
const badge = { position: "absolute", top: -6, right: -6, background: "#e94560", color: "white", borderRadius: "50%", width: 18, height: 18, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" };
const filterPanel = { background: "#111827", border: "1px solid #0f3460", borderRadius: 8, padding: "14px 16px", marginBottom: 12 };
const filterGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "10px" };
const viewBtn = { padding: "5px 9px", background: "#16213e", color: "#555", border: "1px solid #0f3460", borderRadius: 4, cursor: "pointer", fontSize: 15, lineHeight: 1 };
const viewBtnActive = { color: "#e94560", borderColor: "#e94560" };
const pagination = { display: "flex", gap: 6, alignItems: "center", justifyContent: "center", marginTop: 16, paddingTop: 16, borderTop: "1px solid #222", flexWrap: "wrap" };
const pageBtn = { padding: "5px 12px", background: "#16213e", color: "#aaa", border: "1px solid #0f3460", borderRadius: 4, cursor: "pointer", fontSize: 12 };
