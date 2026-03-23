import { useState, useRef } from "react";
import { apiPost, apiGet } from "../api";
import StatsBar from "../components/StatsBar";
import CompTable from "../components/CompTable";

export default function SearchPage() {
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [comps, setComps] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!keyword.trim()) return;

    setSearching(true);
    setError(null);
    setComps([]);
    setStats(null);

    try {
      const { searchId } = await apiPost("/search", { keyword: keyword.trim() });
      pollForResults(searchId);
    } catch (err) {
      setError(err.message);
      setSearching(false);
    }
  }

  function pollForResults(searchId) {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const status = await apiGet(`/search/${searchId}/status`);

        if (status.status === "done" || status.status === "error") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setSearching(false);

          if (status.status === "error") {
            setError("Search failed");
            return;
          }

          // Load full results
          const search = await apiGet(`/search/${searchId}`);
          const items = search.comps?.map((sc) => sc.comp) || [];
          setComps(items);
          setStats({
            avg: search.avgPrice,
            median: search.medianPrice,
            min: search.minPrice,
            max: search.maxPrice,
            count: search.resultCount,
          });
        }
      } catch {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setSearching(false);
        setError("Lost connection while polling");
      }
    }, 2000);
  }

  return (
    <div>
      <form onSubmit={handleSearch} style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search sold comps..."
          style={{
            flex: 1,
            padding: "10px 14px",
            background: "#16213e",
            border: "1px solid #0f3460",
            borderRadius: "6px",
            color: "#eee",
            fontSize: "15px",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={searching}
          style={{
            padding: "10px 24px",
            background: searching ? "#333" : "#e94560",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: searching ? "not-allowed" : "pointer",
            fontSize: "15px",
            fontWeight: 600,
          }}
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </form>

      {error && (
        <div style={{ padding: "10px", background: "#4a1525", borderRadius: "6px", marginBottom: "16px", color: "#ff6b8a" }}>
          {error}
        </div>
      )}

      {searching && (
        <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>
          Scraping eBay sold listings... this takes a few seconds.
        </div>
      )}

      <StatsBar stats={stats} />
      <CompTable comps={comps} />
    </div>
  );
}
