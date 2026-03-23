const prisma = require("../config/database");
const { generateApiKey } = require("./keyGenerator");

// ─── Client CRUD ─────────────────────────────────────────

async function createClient({ name, email, company }) {
  const client = await prisma.client.create({
    data: { name, email, company },
  });

  // Generate first API key
  const apiKey = await createApiKey(client.id, "Default");

  return { client, apiKey };
}

async function getClient(id) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      apiKeys: {
        include: { machines: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

async function listClients({ limit = 50, offset = 0, search } = {}) {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { company: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        apiKeys: { select: { id: true, isActive: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.client.count({ where }),
  ]);

  return { clients, total };
}

async function updateClient(id, data) {
  const allowed = ["name", "email", "company", "planTier", "billingStatus", "isActive", "usageLimitMonthly"];
  const filtered = {};
  for (const key of allowed) {
    if (data[key] !== undefined) filtered[key] = data[key];
  }
  return prisma.client.update({ where: { id }, data: filtered });
}

// ─── API Key CRUD ────────────────────────────────────────

async function createApiKey(clientId, label = "Default") {
  const key = generateApiKey();
  return prisma.apiKey.create({
    data: { clientId, key, label },
  });
}

async function revokeApiKey(id) {
  return prisma.apiKey.update({
    where: { id },
    data: { isActive: false },
  });
}

async function lookupApiKey(key) {
  return prisma.apiKey.findUnique({
    where: { key },
    include: { client: true },
  });
}

async function trackApiKeyUsage(apiKeyId) {
  return prisma.apiKey.update({
    where: { id: apiKeyId },
    data: {
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  }).catch(() => {}); // fire-and-forget
}

// ─── Machine tracking ────────────────────────────────────

async function upsertMachine(apiKeyId, machineId, browserInfo) {
  if (!machineId) return null;
  return prisma.machine.upsert({
    where: {
      apiKeyId_machineId: { apiKeyId, machineId },
    },
    update: {
      browserInfo,
      requestCount: { increment: 1 },
    },
    create: {
      apiKeyId,
      machineId,
      browserInfo,
    },
  }).catch(() => null);
}

// ─── Dashboard stats ─────────────────────────────────────

async function getDashboardStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [
    totalClients,
    activeClients,
    totalKeys,
    activeKeys,
    totalMachines,
    totalComps,
    totalSearches,
    searchesToday,
    compsThisWeek,
    recentSearches,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.client.count({ where: { isActive: true } }),
    prisma.apiKey.count(),
    prisma.apiKey.count({ where: { isActive: true } }),
    prisma.machine.count(),
    prisma.soldComp.count(),
    prisma.search.count(),
    prisma.search.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.soldComp.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.search.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        clientId: true,
        keyword: true,
        resultCount: true,
        source: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    totalClients,
    activeClients,
    totalKeys,
    activeKeys,
    totalMachines,
    totalComps,
    totalSearches,
    searchesToday,
    compsThisWeek,
    recentSearches,
  };
}

async function getClientStats(clientId) {
  const [searchCount, compCount, recentSearches] = await Promise.all([
    prisma.search.count({ where: { clientId } }),
    prisma.soldComp.count({ where: { clientId } }),
    prisma.search.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  return { searchCount, compCount, recentSearches };
}

module.exports = {
  createClient,
  getClient,
  listClients,
  updateClient,
  createApiKey,
  revokeApiKey,
  lookupApiKey,
  trackApiKeyUsage,
  upsertMachine,
  getDashboardStats,
  getClientStats,
};
