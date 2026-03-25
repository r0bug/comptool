const prisma = require("../config/database");

// Default settings
const DEFAULTS = {
  saas_mode: "false",                    // "true" = full SaaS with email verification, limits, billing
  require_email_verification: "false",   // require email verification on registration
  max_free_searches: "1000",             // monthly search limit for free tier
  max_free_comps: "10000",               // total comp limit for free tier
  max_free_keys: "3",                    // API keys per free client
  registration_open: "true",             // allow new registrations
  stripe_enabled: "false",               // enable Stripe billing
  stripe_publishable_key: "",
  stripe_secret_key: "",
  pro_price_monthly: "19",
  enterprise_price_monthly: "49",
};

async function get(key) {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting?.value ?? DEFAULTS[key] ?? null;
}

async function getAll() {
  const settings = await prisma.setting.findMany();
  const result = { ...DEFAULTS };
  for (const s of settings) {
    result[s.key] = s.value;
  }
  return result;
}

async function set(key, value) {
  return prisma.setting.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value) },
  });
}

async function setMany(pairs) {
  const ops = Object.entries(pairs).map(([key, value]) =>
    prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    })
  );
  return prisma.$transaction(ops);
}

async function isSaasMode() {
  return (await get("saas_mode")) === "true";
}

module.exports = { get, getAll, set, setMany, isSaasMode, DEFAULTS };
