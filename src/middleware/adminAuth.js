function requireAdmin(req, res, next) {
  const password =
    req.headers["x-admin-password"] ||
    (req.headers.authorization || "").replace("Bearer ", "");

  const expected = process.env.COMPTOOL_ADMIN_PASSWORD;

  if (!expected) {
    return res.status(500).json({ error: "Admin password not configured" });
  }

  if (!password || password !== expected) {
    return res.status(401).json({ error: "Invalid admin credentials" });
  }

  next();
}

module.exports = requireAdmin;
