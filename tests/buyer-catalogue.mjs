import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import {
  emptyFilters,
  validateFilters,
  applyBuyerFilters,
  formatPrice,
} from "../src/services/buyerFilters.js";
const client = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
let count = 0;
async function query(options = {}) {
  const { data, error } = await applyBuyerFilters(
    client.from("properties").select("*"),
    options,
  ).order("id");
  assert.ifError(error);
  return data;
}
function pass(name) {
  count++;
  console.log(`PASS ${name}`);
}
const rows = await query();
assert.ok(rows.length > 0);
assert.ok(rows.every((p) => p.status === "active"));
pass("Live Supabase returns persisted active properties");
for (const type of ["sale", "rent"]) {
  const result = await query({ quickType: type });
  assert.deepEqual(
    result,
    rows.filter((p) => p.listing_type === type),
  );
  pass(`Quick ${type}`);
}
for (const search of [
  "Paris",
  "maison",
  "Lille",
  "zzzz-no-property",
  '%,_"()\\',
]) {
  const result = await query({ search });
  const lower = search.toLowerCase();
  assert.deepEqual(
    result,
    rows.filter(
      (p) =>
        `${p.title}`.toLowerCase().includes(lower) ||
        p.location.toLowerCase().includes(lower),
    ),
  );
  pass(`Text search ${JSON.stringify(search)}`);
}
const cases = [
  { minPrice: "1000" },
  { maxPrice: "2000" },
  { minPrice: "650", maxPrice: "1150" },
  { location: "lille" },
  { propertyTypes: ["house"] },
  { propertyTypes: ["flat", "studio"] },
  { propertyTypes: ["other"] },
  { listingTypes: ["sale"] },
  { listingTypes: ["rent"] },
  { listingTypes: ["sale", "rent"] },
  {
    minPrice: "600",
    maxPrice: "1500",
    propertyTypes: ["studio", "flat"],
    listingTypes: ["rent"],
    location: "France",
  },
];
for (const changes of cases) {
  const f = { ...emptyFilters(), ...changes };
  const result = await query({ filters: f });
  const expected = rows.filter(
    (p) =>
      (!f.minPrice || Number(p.price) >= Number(f.minPrice)) &&
      (!f.maxPrice || Number(p.price) <= Number(f.maxPrice)) &&
      p.location.toLowerCase().includes(f.location.toLowerCase()) &&
      (!f.listingTypes.length || f.listingTypes.includes(p.listing_type)) &&
      (!f.propertyTypes.length ||
        f.propertyTypes.includes(p.property_type) ||
        (f.propertyTypes.includes("other") &&
          !["house", "flat", "studio"].includes(p.property_type))),
  );
  assert.deepEqual(result, expected);
  pass(`Live filters ${JSON.stringify(changes)}`);
}
assert.equal(
  (
    await query({
      quickType: "sale",
      filters: { ...emptyFilters(), listingTypes: ["rent"] },
    })
  ).length,
  0,
);
pass("Contradictory quick and advanced filters return empty");
assert.deepEqual(await query({ filters: emptyFilters() }), rows);
pass("Reset filter values restore full result");
for (const [minPrice, maxPrice] of [
  ["-1", ""],
  ["abc", ""],
  ["NaN", ""],
  ["1.234", ""],
  ["2", "1"],
  ["", "Infinity"],
])
  assert.ok(validateFilters({ ...emptyFilters(), minPrice, maxPrice }));
assert.equal(
  validateFilters({ ...emptyFilters(), minPrice: "0", maxPrice: "1.25" }),
  "",
);
pass("Invalid and inverted prices rejected; zero and decimals accepted");
for (const p of rows) {
  const result = await client
    .from("properties")
    .select("*")
    .eq("id", p.id)
    .eq("status", "active")
    .maybeSingle();
  assert.ifError(result.error);
  assert.equal(result.data.title, p.title);
  assert.match(formatPrice(p), p.listing_type === "rent" ? /month/ : /£/);
}
pass("Every detail UUID matches catalogue and sale/rent price formatting");
const invisible = await client.from("profiles").select("id");
assert.ok(
  invisible.error?.code === "42501" ||
    (!invisible.error && invisible.data.length === 0),
);
pass("RLS hides profiles from anonymous client");
const forbidden = await client
  .from("properties")
  .insert({
    title: "Forbidden",
    price: 1,
    location: "Paris",
    listing_type: "sale",
    property_type: "flat",
    seller_id: rows[0].seller_id,
  });
assert.ok(forbidden.error);
pass("RLS denies anonymous listing insertion");
console.log(`${count} checks passed; no existing row modified.`);
