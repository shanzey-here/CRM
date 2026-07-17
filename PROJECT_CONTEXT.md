# Project Context — Quoting & Pricing Decisions

## Surcharge Types (feature/phase1-quoting-pricing)

**Status: MVP only supports fixed-amount surcharges. Percentage surcharges are NOT implemented.**

### Findings from Schema Audit (verified 2026-07-17)

The `pricing_settings.surcharges` JSONB field includes a `type` field in its structure, with the comment noting "MVP flexibility":

```json
[
  { "key": "stairs", "label": "Stairs", "amount": 50.00, "type": "fixed" },
  { "key": "long_carry", "label": "Long Carry", "amount": 200.00, "type": "fixed" }
]
```

- Only `"type": "fixed"` is mentioned in schema comments and example data
- No percentage-type surcharges exist in migrations, code, or test fixtures
- The `type` field is reserved for future use (architecture decision)

### MVP Limitations

- **Fixed surcharges only:** All surcharges apply as flat dollar amounts added to the subtotal
- **No percentage surcharges:** 15% surcharges, tax percentages, etc. are not supported
- **Calculation:** Fixed amounts are summed directly; no percentage-of-subtotal logic exists

### Future Enhancement

Percentage-type surcharges (applying as a percentage of subtotal) should be:
1. Added as a new `type: "percentage"` in surcharge definitions
2. Handled in `calculateQuotePrice()` with branch logic: `if (surcharge.type === "percentage") { amount = subtotal * (surcharge.amount / 100) }`
3. Tested with test cases covering both fixed and percentage surcharges combined

**Do not add this to the MVP pricing engine.** Mark surcharge-type branching as a known future task.

---

## Related Pricing Decisions

### Rate Fields & Data Types
- All pricing rates stored as `numeric(12,2)` — decimal dollars, NOT cents
- Fields in `pricing_settings`: `base_rate`, `per_mile_rate`, `per_cubic_foot_rate`, `labor_hourly_rate`
- Distance units: converted from meters (Google Maps API) to miles for calculation; stored as `travel_distance_miles` in quotes table

### Labour Hours (MVP)
- Estimated via `labour_hours_per_cubicft` (numeric, configurable per tenant)
- Simple volume-based: `hours = total_volume × labour_hours_per_cubicft`
- Crew-size adjustments NOT supported in MVP (no crew_size field exists in schema)

### Mutability & Overrides
- Pricing can only be calculated/recalculated while quote `status = 'draft'`
- Two separate columns: `computed_price` (read-only, recalculated by engine) and `final_price` (dispatcher override)
- Both values persist independently; recalculation never overwrites a manual override

---
