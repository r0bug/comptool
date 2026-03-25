const { PrismaClient } = require("../generated/prisma");

let prisma;

if (!prisma) {
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Increase pool for enrichers + API serving concurrently
    // Default is connection_limit=3 which exhausts quickly
  });
}

module.exports = prisma;
