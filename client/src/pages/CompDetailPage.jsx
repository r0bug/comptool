import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { apiGet } from "../api";

export default function CompDetailPage() {
  const { id } = useParams();
  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComp();
  }, [id]);

  async function loadComp() {
    try {
      const data = await apiGet(`/comps/${id}`);
      setComp(data);
    } catch (err) {
      console.error("Failed to load comp:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p style={{ color: "#888" }}>Loading...</p>;
  if (!comp) return <p style={{ color: "#f44336" }}>Comp not found</p>;

  return (
    <div style={{ maxWidth: "600px" }}>
      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        {comp.imageUrl && (
          <img src={comp.imageUrl} alt="" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 6 }} />
        )}
        <div>
          <h2 style={{ fontSize: "18px", margin: "0 0 8px 0" }}>{comp.title}</h2>
          {comp.itemUrl && (
            <a href={comp.itemUrl} target="_blank" rel="noreferrer" style={{ color: "#7ec8e3", fontSize: "13px" }}>
              View on eBay
            </a>
          )}
        </div>
      </div>

      <table style={{ width: "100%", fontSize: "14px" }}>
        <tbody>
          {row("Sold Price", `$${comp.soldPrice?.toFixed(2)}`)}
          {row("Shipping", comp.shippingPrice === 0 ? "Free" : comp.shippingPrice ? `$${comp.shippingPrice.toFixed(2)}` : "—")}
          {row("Total", `$${(comp.totalPrice || comp.soldPrice)?.toFixed(2)}`, "#4caf50")}
          {row("Condition", comp.condition)}
          {row("Type", comp.listingType === "buy_it_now" ? "Buy It Now" : comp.listingType === "auction" ? "Auction" : comp.listingType)}
          {comp.bidCount && row("Bids", comp.bidCount)}
          {row("Seller", comp.seller)}
          {comp.sellerFeedback && row("Feedback", comp.sellerFeedback)}
          {row("Sold Date", comp.soldDate ? new Date(comp.soldDate).toLocaleDateString() : "—")}
          {row("eBay Item ID", comp.ebayItemId)}
        </tbody>
      </table>

      {comp.searches?.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h3 style={{ fontSize: "14px", color: "#aaa" }}>Found in searches</h3>
          <ul style={{ paddingLeft: "16px", fontSize: "13px" }}>
            {comp.searches.map((sc) => (
              <li key={sc.search.id} style={{ marginBottom: "4px" }}>
                "{sc.search.keyword}" — {new Date(sc.search.createdAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function row(label, value, color) {
  return (
    <tr style={{ borderBottom: "1px solid #222" }}>
      <td style={{ padding: "8px 10px", color: "#888" }}>{label}</td>
      <td style={{ padding: "8px 10px", fontWeight: color ? 600 : 400, color: color || "#eee" }}>
        {value || "—"}
      </td>
    </tr>
  );
}
