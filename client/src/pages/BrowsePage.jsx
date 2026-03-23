import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { apiGet } from "../api";
import CompTable from "../components/CompTable";
import CompTiles from "../components/CompTiles";
import StatsBar from "../components/StatsBar";

const PAGE_SIZE = 50;

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [comps, setComps] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState(localStorage.getItem("comptool_view") || "table");

  // Read filters from URL params
  const keyword = searchParams.get("q") || "";
  const minPrice = searchParams.get("min") || "";
  const maxPrice = searchParams.get("max") || "";
  const condition = searchParams.get("cond") || "";
  const listingType = searchParams.get("type") || "";
  const sortBy = searchParams.get("sort") || "soldDate";
  const sortDir = searchParams.get("dir") || "desc";
  const page = parseInt(searchParams.get("page") || "1");

  // Form state (local until submitted)
  const [formKeyword, setFormKeyword] = useState(keyword);
  const [formMin, setFormMin] = useState(minPrice);
  const [formMax, setFormMax] = useState(maxPrice);
  const [formCond, setFormCond] = useState(condition);
  const [formType, setFormType] = useState(listingType);

  // Sync form state when URL params change (e.g. back/forward)
  useEffect(() => {
    setFormKeyword(keyword);
    setFormMin(minPrice);
    setFormMax(maxPrice);
    setFormCond(condition);
    setFormType(listingType);
  }, [keyword, minPrice, maxPrice, condition, listingType]);

  const fetchComps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set("keyword", keyword);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (condition) params.set("condition", condition);
      if (listingType) params.set("listingType", listingType);
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      params.set("limit", PAGE_SIZE);
      params.set("offset", (page - 1) * PAGE_SIZE);

      const result = await apiGet(`/comps?${params}`);
      setComps(result.comps);
      setTotal(result.total);

      // Fetch stats if keyword is set
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
  }, [keyword, minPrice, maxPrice, condition, listingType, sortBy, sortDir, page]);

  useEffect(() => {
    fetchComps();
  }, [fetchComps]);

  function handleSearch(e) {
    e.preventDefault();
    const params = {};
    if (formKeyword.trim()) params.q = formKeyword.trim();
    if (formMin) params.min = formMin;
    if (formMax) params.max = formMax;
    if (formCond) params.cond = formCond;
    if (formType) params.type = formType;
    // Reset to page 1, keep sort
    params.sort = sortBy;
    params.dir = sortDir;
    setSearchParams(params);
  }

  function handleSort(col, dir) {
    const params = Object.fromEntries(searchParams);
    params.sort = col;
    params.dir = dir;
    params.page = "1";
    setSearchParams(params);
  }

  function handlePageChange(newPage) {
    const params = Object.fromEntries(searchParams);
    params.page = String(newPage);
    setSearchParams(params);
  }

  function handleClear() {
    setFormKeyword("");
    setFormMin("");
    setFormMax("");
    setFormCond("");
    setFormType("");
    setSearchParams({});
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const sorted = [...comps].sort((a, b) => {
    // CompTable does client-side sort; we also do server-side
    return 0;
  });

  return (
    <div>
      <h2 style={{ marginBottom: "16px" }}>Browse Comps</h2>

      <form onSubmit={handleSearch} style={filterBar}>
        <input
          type="text"
          placeholder="Search titles..."
          value={formKeyword}
          onChange={(e) => setFormKeyword(e.target.value)}
          style={inputStyle}
        />
        <input
          type="number"
          placeholder="Min $"
          value={formMin}
          onChange={(e) => setFormMin(e.target.value)}
          style={{ ...inputStyle, width: "90px" }}
          step="0.01"
          min="0"
        />
        <input
          type="number"
          placeholder="Max $"
          value={formMax}
          onChange={(e) => setFormMax(e.target.value)}
          style={{ ...inputStyle, width: "90px" }}
          step="0.01"
          min="0"
        />
        <select value={formCond} onChange={(e) => setFormCond(e.target.value)} style={inputStyle}>
          <option value="">Any Condition</option>
          <option value="new">New</option>
          <option value="used">Used</option>
          <option value="refurbished">Refurbished</option>
          <option value="parts">Parts</option>
        </select>
        <select value={formType} onChange={(e) => setFormType(e.target.value)} style={inputStyle}>
          <option value="">Any Type</option>
          <option value="Fixed price">Buy It Now</option>
          <option value="Auction">Auction</option>
        </select>
        <button type="submit" style={btnStyle}>Search</button>
        {(keyword || minPrice || maxPrice || condition || listingType) && (
          <button type="button" onClick={handleClear} style={clearBtnStyle}>Clear</button>
        )}
      </form>

      {error && <p style={{ color: "#e94560" }}>{error}</p>}

      {stats && <StatsBar stats={stats} />}

      <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "#888", fontSize: "13px" }}>
          {loading ? "Loading..." : `${total} comp${total !== 1 ? "s" : ""} found`}
          {keyword && ` matching "${keyword}"`}
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={() => { setViewMode("table"); localStorage.setItem("comptool_view", "table"); }}
            style={{ ...viewBtn, ...(viewMode === "table" ? viewBtnActive : {}) }}
            title="Table view"
          >
            &#9776;
          </button>
          <button
            onClick={() => { setViewMode("tiles"); localStorage.setItem("comptool_view", "tiles"); }}
            style={{ ...viewBtn, ...(viewMode === "tiles" ? viewBtnActive : {}) }}
            title="Tile view"
          >
            &#9638;
          </button>
        </div>
      </div>

      {viewMode === "tiles" ? (
        <CompTiles comps={comps} />
      ) : (
        <CompTable comps={comps} onSort={handleSort} />
      )}

      {totalPages > 1 && (
        <div style={paginationStyle}>
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            style={pageBtnStyle}
          >
            Prev
          </button>
          <span style={{ color: "#aaa", fontSize: "13px" }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            style={pageBtnStyle}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

const filterBar = {
  display: "flex",
  gap: "8px",
  marginBottom: "16px",
  flexWrap: "wrap",
  alignItems: "center",
};

const inputStyle = {
  padding: "8px 12px",
  background: "#16213e",
  border: "1px solid #0f3460",
  borderRadius: "6px",
  color: "#eee",
  fontSize: "13px",
  outline: "none",
};

const btnStyle = {
  padding: "8px 20px",
  background: "#e94560",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "13px",
};

const clearBtnStyle = {
  padding: "8px 16px",
  background: "transparent",
  color: "#888",
  border: "1px solid #333",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "13px",
};

const paginationStyle = {
  display: "flex",
  gap: "12px",
  alignItems: "center",
  justifyContent: "center",
  marginTop: "16px",
  paddingTop: "16px",
  borderTop: "1px solid #222",
};

const pageBtnStyle = {
  padding: "6px 16px",
  background: "#16213e",
  color: "#eee",
  border: "1px solid #0f3460",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "13px",
};

const viewBtn = {
  padding: "6px 10px",
  background: "#16213e",
  color: "#666",
  border: "1px solid #0f3460",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "16px",
  lineHeight: 1,
};

const viewBtnActive = {
  color: "#e94560",
  borderColor: "#e94560",
};
