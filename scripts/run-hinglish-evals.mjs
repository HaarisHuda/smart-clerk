import fs from "node:fs";
import path from "node:path";

const fixturePath = path.join(process.cwd(), "evals", "hinglish.json");
const cases = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const failures = [];

if (cases.length < 40) {
  failures.push(`Expected at least 40 eval cases, found ${cases.length}.`);
}

const requiredIntents = new Set([
  "price_query",
  "stock_query",
  "reserve_item",
  "bulk_discount",
  "greeting",
  "ambiguous",
]);

for (const [index, item] of cases.entries()) {
  if (!item.message || typeof item.message !== "string") {
    failures.push(`Case ${index} is missing a message.`);
  }
  if (!item.expected || !requiredIntents.has(item.expected.intent)) {
    failures.push(`Case ${index} has invalid expected intent.`);
  }
  if (typeof item.expected.shouldReserve !== "boolean") {
    failures.push(`Case ${index} must include expected.shouldReserve.`);
  }
  if (
    item.expected.shouldReserve &&
    item.expected.intent !== "reserve_item" &&
    !String(item.expected.contextBehavior ?? "").startsWith("reserve")
  ) {
    failures.push(`Case ${index} reserves without reserve_item intent.`);
  }
  if (!item.expected.shouldReserve && item.expected.intent !== "reserve_item" && item.expected.quantity && /pack|rakh|reserve/i.test(item.message)) {
    failures.push(`Case ${index} may be an unsafe false negative: ${item.message}`);
  }
}

if (failures.length) {
  console.error("Hinglish eval fixture failed validation:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const reserveCases = cases.filter((item) => item.expected.shouldReserve).length;
const nonReserveCases = cases.length - reserveCases;
console.log(`Hinglish eval fixture OK: ${cases.length} cases (${reserveCases} reserve, ${nonReserveCases} non-reserve).`);
