/**
 * Bulk category backfill — assigns categories to uncategorized comps
 * based on title keyword matching. These are "best guess" categories
 * that get replaced with the real eBay category when the item is
 * re-scraped or enriched via the API.
 *
 * Run: node src/services/categorizer.js
 */

require("dotenv").config();
const prisma = require("../config/database");

// Category rules — ordered most specific first
// Each rule: [keywords (all must match), category path]
const RULES = [
  // Motorcycle specific
  [["motorcycle", "helmet"], "eBay Motors > Parts & Accessories > Apparel, Protective Gear & Merchandise > Helmets"],
  [["motorcycle", "exhaust"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories > Exhaust"],
  [["motorcycle", "carburetor"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories > Air Intake & Fuel Delivery"],
  [["motorcycle", "fuel tank"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories > Body & Frame > Fuel Tanks"],
  [["motorcycle"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],

  // Motorcycle brands → motorcycle parts
  [["bultaco"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "motorcycle"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "bantam"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "a65"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "a50"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "b44"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "gold star"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["triumph", "motorcycle"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["triumph", "bonneville"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["norton", "commando"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["norton", "motorcycle"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["harley", "davidson"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["ducati"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["kawasaki", "motorcycle"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["yamaha", "motorcycle"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["suzuki", "motorcycle"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["montesa"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["ossa"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["husqvarna", "motorcycle"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],

  // BSA — if title has BSA + any parts keyword, it's motorcycle parts
  [["bsa", "engine"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "gearbox"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "frame"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "tank"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "wheel"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "brake"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "clutch"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "gasket"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "piston"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "cylinder"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "fork"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "seat"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "exhaust"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["bsa", "carb"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],

  // Triumph — same approach
  [["triumph", "engine"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["triumph", "frame"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["triumph", "tank"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["triumph", "wheel"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["triumph", "fork"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["triumph", "seat"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],

  // Norton
  [["norton", "engine"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["norton", "frame"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],
  [["norton", "tank"], "eBay Motors > Parts & Accessories > Motorcycle & Scooter Parts & Accessories"],

  // Vintage helmets (not brand-specific motorcycle)
  [["bell", "helmet"], "eBay Motors > Parts & Accessories > Apparel, Protective Gear & Merchandise > Helmets"],
  [["buco", "helmet"], "eBay Motors > Parts & Accessories > Apparel, Protective Gear & Merchandise > Helmets"],
  [["shoei", "helmet"], "eBay Motors > Parts & Accessories > Apparel, Protective Gear & Merchandise > Helmets"],
  [["arai", "helmet"], "eBay Motors > Parts & Accessories > Apparel, Protective Gear & Merchandise > Helmets"],
  [["simpson", "helmet"], "eBay Motors > Parts & Accessories > Apparel, Protective Gear & Merchandise > Helmets"],
  [["vintage", "helmet"], "eBay Motors > Parts & Accessories > Apparel, Protective Gear & Merchandise > Helmets"],

  // Car parts (generic)
  [["ford", "model a"], "eBay Motors > Parts & Accessories > Car & Truck Parts & Accessories"],
  [["ford", "model t"], "eBay Motors > Parts & Accessories > Car & Truck Parts & Accessories"],
  [["porsche"], "eBay Motors > Parts & Accessories > Car & Truck Parts & Accessories"],
  [["volkswagen"], "eBay Motors > Parts & Accessories > Car & Truck Parts & Accessories"],
  [["mercedes"], "eBay Motors > Parts & Accessories > Car & Truck Parts & Accessories"],
  [["bmw", "car"], "eBay Motors > Parts & Accessories > Car & Truck Parts & Accessories"],
  [["chevy"], "eBay Motors > Parts & Accessories > Car & Truck Parts & Accessories"],
  [["chevrolet"], "eBay Motors > Parts & Accessories > Car & Truck Parts & Accessories"],
  [["dodge"], "eBay Motors > Parts & Accessories > Car & Truck Parts & Accessories"],

  // Railroad
  [["railroad", "lock"], "Collectibles > Transportation > Railroadiana & Trains > Hardware"],
  [["railroad", "padlock"], "Collectibles > Transportation > Railroadiana & Trains > Hardware"],
  [["railroad", "lantern"], "Collectibles > Transportation > Railroadiana & Trains > Lanterns & Lighting"],
  [["railroad", "key"], "Collectibles > Transportation > Railroadiana & Trains > Hardware"],
  [["railroad"], "Collectibles > Transportation > Railroadiana & Trains"],
  [["railroadiana"], "Collectibles > Transportation > Railroadiana & Trains"],

  // Electronics / Audio
  [["technics"], "Consumer Electronics > Vintage Electronics > Vintage Audio & Video"],
  [["marantz"], "Consumer Electronics > Vintage Electronics > Vintage Audio & Video"],
  [["pioneer", "receiver"], "Consumer Electronics > Vintage Electronics > Vintage Audio & Video"],
  [["pioneer", "turntable"], "Consumer Electronics > Vintage Electronics > Vintage Audio & Video"],

  // Computers
  [["commodore 64"], "Computers/Tablets & Networking > Vintage Computing"],
  [["commodore"], "Computers/Tablets & Networking > Vintage Computing"],
  [["atari"], "Computers/Tablets & Networking > Vintage Computing"],

  // Broad vehicle parts fallback — must be last
  [["carburetor"], "eBay Motors > Parts & Accessories"],
  [["exhaust"], "eBay Motors > Parts & Accessories"],
  [["radiator"], "eBay Motors > Parts & Accessories"],
  [["fuel tank"], "eBay Motors > Parts & Accessories"],
  [["headlight"], "eBay Motors > Parts & Accessories"],
  [["fender"], "eBay Motors > Parts & Accessories"],
  [["bumper"], "eBay Motors > Parts & Accessories"],
  [["starter motor"], "eBay Motors > Parts & Accessories"],
  [["alternator"], "eBay Motors > Parts & Accessories"],
];

function matchCategory(title) {
  const lower = title.toLowerCase();
  for (const [keywords, category] of RULES) {
    if (keywords.every((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return null;
}

async function run() {
  const total = await prisma.soldComp.count({ where: { category: null } });
  console.log(`${total} comps without category. Processing...`);

  let updated = 0;
  let offset = 0;
  const BATCH = 500;

  while (true) {
    const comps = await prisma.soldComp.findMany({
      where: { category: null },
      select: { id: true, title: true },
      take: BATCH,
      skip: 0, // always 0 since we're updating and removing from the null pool
    });

    if (comps.length === 0) break;

    let batchUpdated = 0;
    let batchSkipped = 0;

    for (const comp of comps) {
      const cat = matchCategory(comp.title);
      if (cat) {
        await prisma.soldComp.update({ where: { id: comp.id }, data: { category: cat } });
        batchUpdated++;
      } else {
        batchSkipped++;
      }
    }

    updated += batchUpdated;
    offset += batchSkipped;
    console.log(`  Batch: ${batchUpdated} categorized, ${batchSkipped} skipped (${updated} total updated)`);

    // If entire batch was skipped, we need to offset past them
    if (batchUpdated === 0) {
      // Move past uncategorizable items
      const remaining = await prisma.soldComp.count({ where: { category: null } });
      if (remaining === comps.length) break; // No progress, stop
    }
  }

  const remaining = await prisma.soldComp.count({ where: { category: null } });
  console.log(`\nDone: ${updated} categorized. ${remaining} still uncategorized.`);
  await prisma.$disconnect();
}

run().catch(console.error);
