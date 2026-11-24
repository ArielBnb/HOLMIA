export const emptyFilters = () => ({
  minPrice: "",
  maxPrice: "",
  location: "",
  propertyTypes: [],
  listingTypes: [],
});
export function validateFilters(filters) {
  for (const key of ["minPrice", "maxPrice"]) {
    const value = filters[key].trim();
    if (
      value &&
      (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value)))
    )
      return "Enter a valid positive price (up to two decimals).";
  }
  if (
    filters.minPrice.trim() &&
    filters.maxPrice.trim() &&
    Number(filters.minPrice) > Number(filters.maxPrice)
  )
    return "Minimum price must not exceed maximum price.";
  return "";
}
// Escape user text before passing it to PostgREST's ilike pattern and or grammar.
export function searchPattern(value) {
  return `%${value.trim().replace(/[\\%_]/g, "\\$&")}%`;
}
export function applyBuyerFilters(
  query,
  { search = "", quickType = "all", filters = emptyFilters() } = {},
) {
  const error = validateFilters(filters);
  if (error) throw new Error(error);
  query = query.eq("status", "active");
  if (search.trim()) {
    const pattern = JSON.stringify(searchPattern(search));
    query = query.or(`title.ilike.${pattern},location.ilike.${pattern}`);
  }
  if (quickType !== "all") query = query.eq("listing_type", quickType);
  if (filters.listingTypes.length)
    query = query.in("listing_type", filters.listingTypes);
  if (filters.location.trim())
    query = query.ilike("location", searchPattern(filters.location));
  if (filters.minPrice.trim())
    query = query.gte("price", Number(filters.minPrice));
  if (filters.maxPrice.trim())
    query = query.lte("price", Number(filters.maxPrice));
  if (filters.propertyTypes.length) {
    const known = ["house", "flat", "studio", "loft", "villa", "land", "office"];
    const parts = filters.propertyTypes
      .map((x) => String(x || "").toLowerCase())
      .filter((x) => known.includes(x))
      .map((x) => `property_type.eq.${x}`);
    if (filters.propertyTypes.includes("other"))
      parts.push("property_type.not.in.(house,flat,studio)");
    if (parts.length) query = query.or(parts.join(","));
  }
  return query;
}
export function formatPrice(property) {
  const num = Number(property?.price);
  const formatted = Number.isFinite(num)
    ? num.toLocaleString("en-GB", { maximumFractionDigits: 2 })
    : "0";
  return `£${formatted}${property?.listing_type === "rent" ? " / month" : ""}`;
}
