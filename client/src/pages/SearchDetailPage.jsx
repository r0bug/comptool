import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { apiGet } from "../api";
import StatsBar from "../components/StatsBar";
import CompTable from "../components/CompTable";

export default function SearchDetailPage() {
  const { id } = useParams();
  const [search, setSearch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSearch();
  }, [id]);

  async function loadSearch() {
    try {
      const data = await apiGet(`/search/${id}`);
      setSearch(data);
    } catch (err) {
      console.error("Failed to load search:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p style={{ color: "#888" }}>Loading...</p>;
  if (!search) return <p style={{ color: "#f44336" }}>Search not found</p>;

  const comps = search.comps?.map((sc) => sc.comp) || [];
  const stats = {
    avg: search.avgPrice,
    median: search.medianPrice,
    min: search.minPrice,
    max: search.maxPrice,
    count: search.resultCount,
  };

  return (
    <div>
      <h2 style={{ fontSize: "18px", marginBottom: "4px" }}>
        "{search.keyword}"
      </h2>
      <p style={{ color: "#888", fontSize: "13px", marginBottom: "16px" }}>
        {search.resultCount} results via {search.source === "seller_hub" ? "Seller Hub" : "public search"} — {new Date(search.createdAt).toLocaleString()}
      </p>
      <StatsBar stats={stats} />
      <CompTable comps={comps} />
    </div>
  );
}
