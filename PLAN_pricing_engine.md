# Pricing Engine Plan (feature/phase1-quoting-pricing)

## Overview
Build a configurable pricing calculation engine that reads per-tenant rate variables from `pricing_settings`, accepts quote-specific inputs (volume, distance, surcharges), and produces both a computed price and an overridable final price. All calculation in one function, zero per-tenant code branching.

---

## 1. Labour Hours Derivation (PROPOSED)

### Current State Investigation Needed
- Does `quote_inventory` track item quantities/weights? ✓ (confirmed — has `quantity`, `unit` fields)
- Does a "crew size" or "team size" field exist anywhere? (to check)
- Does the DB model time estimates for move categories?

### Proposed Approach (if no existing labour-hours field)

**Simple: Volume → Hours via Tenant-Configurable Rate**

Instead of inventing a complex formula, add a single `pricing_settings` field:
- `labour_hours_per_cubicft` (default 0.1 hours per cubic foot as a starting point)

Then: `estimated_labour_hours = total_volume × labour_hours_per_cubicft`

**Why this works:**
- Dispatcher can tune it per tenant without code changes
- Scales with move complexity (bigger moves = more volume = more hours)
- Simple to understand and override if needed
- Can be refined later if needed (e.g., multipliers for "long carry" surcharge, floor counts, etc.)

**Fallback if volume alone isn't enough:**
- Add an optional `quote.crew_size` field (default 2, configurable per quote in UI)
- Then: `estimated_labour_hours = total_volume × labour_hours_per_cubicft × (crew_size / 2)`
  - Accounts for smaller/larger teams scaling the hours

**Recommendation: Start with volume-only (`labour_hours_per_cubicft`), flag as open if testing shows it's insufficient.**

---

## 2. Surcharge Selection Mechanism (PROPOSED)

### Current State
- `pricing_settings` likely defines available surcharges (stairs, long carry, weekend, etc.)
- Need a way for dispatcher to indicate which apply to THIS specific quote

### Proposed Solution: `quote_surcharges` Table

**New table: `quote_surcharges`**
```sql
CREATE TABLE quote_surcharges (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  quote_id uuid NOT NULL REFERENCES quotes(id),
  surcharge_key text NOT NULL,  -- e.g., 'stairs', 'long_carry', 'weekend'
  amount_cents integer NOT NULL, -- computed from pricing_settings + quote at insert
  created_at timestamptz DEFAULT now(),
  UNIQUE(quote_id, surcharge_key)  -- one per surcharge per quote
);
```

**UI Implementation:**
- In Quote Workspace, show a **surcharge selector** (checkboxes or toggles)
- List all available surcharges from `pricing_settings` for this tenant
- User checks/unchecks which ones apply
- On save, `POST /office/quotes/[id]/calculate-price` upserts `quote_surcharges` rows
- Calculation reads those rows and sums the amounts

**Why this design:**
- Surcharges are audit-tracked (which ones were applied to this quote)
- Amounts are snapshotted at calculation time (if rates change later, this quote's price doesn't silently shift)
- Simple for dispatcher: click checkboxes, hit "recalculate"
- Dispatcher can see each surcharge's contribution to the final price

---

## 3. Calculation Function Signature

```typescript
// src/modules/quotes/server/pricing.ts

interface PricingInput {
  tenantId: string;
  leadId: string;
  totalVolume: number;        // from quote_inventory
  distanceKm: number;          // from Google Maps cache
  selectedSurcharges: string[]; // keys like ['stairs', 'long_carry']
  crewSize?: number;           // optional, defaults to 2
}

interface PricingOutput {
  computedPrice: number;       // cents
  breakdown: {
    volumeCost: number;
    distanceCost: number;
    labourCost: number;
    surcharges: { key: string; amount: number }[];
    subtotal: number;
    minimumChargeAdjustment: number; // 0 if >= minimum
    total: number;
  };
}

export async function calculateQuotePrice(
  supabase: SupabaseClient,
  input: PricingInput
): Promise<PricingOutput>
```

**Function behavior:**
1. Fetch `pricing_settings` for tenant (with explicit `.eq('tenant_id', tenantId)`)
2. Fetch surcharge amounts from `pricing_settings.surcharges` JSON for selected keys
3. Compute:
   - `volumeCost = totalVolume × pricing_settings.rate_per_sqft` (or per-cubic-ft, confirm actual field name)
   - `distanceCost = distanceKm × pricing_settings.rate_per_km`
   - `labourHours = totalVolume × pricing_settings.labour_hours_per_cubicft`
   - `labourCost = labourHours × pricing_settings.labour_rate_per_hour`
   - `surchargeTotal = sum of selected surcharge amounts`
   - `subtotal = volumeCost + distanceCost + labourCost + surchargeTotal`
   - `total = max(subtotal, pricing_settings.minimum_charge)`
4. Return breakdown + total

---

## 4. Storage in `quotes` Table

Add two columns to `quotes` (if not already present):
```sql
ALTER TABLE quotes ADD COLUMN computed_price integer; -- cents, NULL until calculated
ALTER TABLE quotes ADD COLUMN final_price integer;    -- cents, defaults to computed_price, can be overridden
```

**Semantics:**
- `computed_price`: The result of `calculateQuotePrice()`, never manually edited
- `final_price`: The actual price agreed on; can differ from computed (dispatcher override)
- Quote's "official" price is always `final_price` (or computed if not yet overridden)

---

## 5. API Endpoint: Calculate/Recalculate Price

**POST /office/quotes/[id]/calculate-price**

```typescript
export async function calculatePriceAction(
  quoteId: string,
  selectedSurcharges: string[],
  crewSize?: number
): Promise<{ success: boolean; computed_price?: number; breakdown?: PricingOutput['breakdown'] }>
```

**Logic:**
1. Fetch quote, enforce `status === 'draft'` (same guard as `saveQuoteInventory`)
2. Fetch lead (for tenant scoping)
3. Fetch route distance from cache
4. Call `calculateQuotePrice()`
5. Update `quotes.computed_price` (NOT final_price)
6. Upsert rows in `quote_surcharges` with the selected ones
7. Return the breakdown for UI display

**Mutability guard:** If status is not `draft`, return error (same as inventory save).

---

## 6. UI in Quote Workspace

**New section in `/office/quotes/[id]` (alongside Volume and Distance cards):**

```
┌─────────────────────────────────┐
│         Pricing Calculation     │
├─────────────────────────────────┤
│ ☐ Stairs      (+$150)           │
│ ☐ Long Carry  (+$200)           │
│ ☐ Weekend     (+$250)           │
├─────────────────────────────────┤
│ Volume Cost:    1,500 cu-ft     │
│   @ $2.50/cu-ft = $3,750.00    │
│                                 │
│ Distance Cost:  47 km           │
│   @ $1.20/km = $56.40          │
│                                 │
│ Labour Cost:    15 hours        │
│   @ $45/hr = $675.00           │
│                                 │
│ Surcharges:                     │
│   Stairs: +$150.00             │
│                                 │
│ ─────────────────────────────   │
│ Subtotal:      $4,631.40       │
│ Minimum Charge: $3,500 (N/A)   │
│ ─────────────────────────────   │
│ COMPUTED PRICE: $4,631.40      │
│                                 │
│ [Manual Override]               │
│ Final Price: [$4631.40]         │
│              [Save Override]    │
│                                 │
│ [Recalculate]  [Reset Override] │
└─────────────────────────────────┘
```

---

## 7. File Structure

```
src/modules/quotes/
├── server/
│   ├── pricing.ts              (NEW) — calculateQuotePrice() function
│   └── repository.ts           (MODIFY) — add savePricingOverride(), getPricing()
├── schemas.ts                  (MODIFY) — add PricingInput schema + surcharge validation
└── calculations.test.ts        (NEW) — tests

src/app/office/quotes/[id]/
└── components/
    └── pricing-calculator.tsx  (NEW) — UI component (client)
```

---

## 8. Open Items to Confirm

1. **Labour hours:** Does `pricing_settings` already have a `labour_hours_per_cubicft` field, or do we add it?
   - If it doesn't exist, OK to add as a new optional field (default 0.1)?

2. **Surcharge storage:** Does `pricing_settings.surcharges` already exist as JSONB with charge amounts?
   - e.g., `{ "stairs": 15000, "long_carry": 20000, "weekend": 25000 }` (in cents)?
   - If yes, confirm the exact JSON structure.

3. **Unit confirmation:** Are the rate fields in `pricing_settings` in cents or dollars?
   - Assuming all prices are stored as integers (cents) for precision.

4. **Distance unit:** Route distance from Google Maps — is it in km or miles?
   - (Will adjust calculation accordingly.)

5. **Quote status enforcement:** Confirm `status` field on `quotes` table and its enum values.

---

## Testing Plan

### Test 1: Known-input calculation
```typescript
// Tenant A config:
// - rate_per_cubicft: 250 (cents)
// - rate_per_km: 120 (cents)
// - labour_rate_per_hour: 4500 (cents)
// - labour_hours_per_cubicft: 10 (hundredths of hour)
// - minimum_charge: 350000 (cents)
// - surcharges: { stairs: 15000, long_carry: 20000 }

// Input:
// - volume: 1500 cu-ft
// - distance: 47 km
// - selectedSurcharges: ['stairs']

// Expected:
// - volumeCost: 1500 * 250 = 375,000 cents
// - distanceCost: 47 * 120 = 5,640 cents
// - labourHours: 1500 * 10 = 15,000 hundredths = 150 hours
// - labourCost: 150 * 4500 = 675,000 cents
// - surcharges: 15,000 cents
// - subtotal: 1,070,640 cents
// - minimumCharge: 350,000 (doesn't apply)
// - total: 1,070,640 cents ($10,706.40)
```

### Test 2: Cross-tenant comparison
```typescript
// Tenant A (above): 1,070,640 cents
// Tenant B config (different rates):
// - rate_per_cubicft: 300
// - rate_per_km: 100
// - labour_rate_per_hour: 3500
// - labour_hours_per_cubicft: 8
// - surcharges: { stairs: 20000 }

// Same input → different price (proves no code branching)
```

### Test 3: Mutability guard
```typescript
// Quote with status 'sent' → attempt calculatePrice() → should error
// "Cannot recalculate price for non-draft quote"
```

### Test 4: Override persistence
```typescript
// Calculate price → computed_price = 1,070,640
// Set final_price = 1,200,000 (override)
// Recalculate → computed_price updates, final_price remains 1,200,000
```

---

## Summary

| Item | Decision |
|------|----------|
| Labour hours | Volume-based: `labour_hours_per_cubicft` in `pricing_settings` |
| Surcharge selection | New `quote_surcharges` table + checkboxes in UI |
| Calculation | Single function in `src/modules/quotes/server/pricing.ts` |
| Storage | `quotes.computed_price` (read-only) + `quotes.final_price` (overridable) |
| UI | Pricing breakdown card in Quote Workspace, with surcharge toggles + override input |
| Mutability guard | Status must be `draft` to calculate, same as inventory |

**Ready for review before implementation.**
