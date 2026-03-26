require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const browser = require("./services/browser");

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(require("compression")());
app.use(express.json({ limit: "5mb" }));

// Thumbnails — on-demand generation, 30-day cache
const { getThumb, THUMB_DIR } = require("./services/thumbnailer");
app.use("/comp/images/thumbs", express.static(THUMB_DIR, { maxAge: "30d", immutable: true }));
app.get("/comp/images/thumb/:filename", async (req, res) => {
  const thumbPath = await getThumb(req.params.filename);
  if (thumbPath) {
    res.set("Cache-Control", "public, max-age=2592000, immutable");
    res.sendFile(thumbPath);
  } else {
    // Fallback to original
    res.redirect(`/comp/images/${req.params.filename}`);
  }
});

// Full-size images — 30-day browser cache, immutable
app.use("/comp/images", express.static(path.join(__dirname, "../data/images"), {
  maxAge: "30d",
  immutable: true,
}));

// Android app download
app.get("/comp/android/download", (req, res) => {
  const apkPath = path.join(__dirname, "../comptool-capture.apk");
  if (require("fs").existsSync(apkPath)) {
    res.download(apkPath, "comptool-capture.apk");
  } else {
    res.status(404).send("APK not built");
  }
});

// Extension download (zip) and files
app.get("/comp/extension/download", (req, res) => {
  const zipPath = path.join(__dirname, "../comptool-extension.zip");
  if (require("fs").existsSync(zipPath)) {
    res.download(zipPath, "comptool-extension.zip");
  } else {
    res.status(404).send("Extension zip not built. Run: cd extension && zip -r ../comptool-extension.zip .");
  }
});
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
