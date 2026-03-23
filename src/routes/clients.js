const router = require("express").Router();
const clientStore = require("../services/clientStore");

// Public registration
router.post("/register", async (req, res) => {
  try {
    const { name, email, company } = req.body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ error: "Name is required (min 2 characters)" });
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    const { client, apiKey } = await clientStore.createClient({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company?.trim() || null,
    });

    res.json({
      clientId: client.id,
      name: client.name,
      email: client.email,
      apiKey: apiKey.key,
      message: "Save your API key — it will not be shown again.",
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
