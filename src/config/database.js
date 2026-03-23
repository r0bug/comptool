const { PrismaClient } = require("../generated/prisma");

let prisma;

if (!prisma) {
  prisma = new PrismaClient();
}

module.exports = prisma;
