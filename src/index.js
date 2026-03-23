require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const browser = require("./services/browser");

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Cached images
app.use("/comp/images", express.static(path.join(__dirname, "../data/images")));

// Serve extension files for self-update
app.use("/comp/extension", express.static(path.join(__dirname, "../extension")));

// API routes
app.use("/comp/api", require("./routes/api"));

// Serve React frontend in production
const clientDist = path.join(__dirname, "../client/dist");
app.use("/comp", express.static(clientDist));
app.get("/comp/*splat", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`CompTool server running on port ${PORT}`);
});

// Graceful shutdown
async function shutdown() {
  console.log("\nShutting down...");
  await browser.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
