# Pricing Engine Plan — VERIFIED SCHEMA & CODE

## 1. Verified Findings from Schema & Code

### pricing_settings (00001_phase0_foundations.sql, line 432-442)
**Actual columns:**
- `base_rate` — numeric(12,2) — decimal dollars (not cents!)
- `per_mile_rate` — numeric(12,2)
- `per_cubic_foot_rate` — numeric(12,2)
- `labor_hourly_rate` — numeric(12,2)
- `surcharges` — jsonb, default '[]', structure: `[{ "key": "stairs", "label": "Stairs", "amount": 50.00, "type": "fixed" }, ...]`

**KEY FINDING:** NO `labour_hours_per_cubicft` field exists. Must be added via new migration.

### quotes (00001_phase0_foundations.sql, line 445-473)
**Status enum (line 54-56):** `['draft', 'sent', 'accepted', 'declined', 'expired']`

**Relevant columns:**
- `status` — quote_status enum ✓
- `total_volume` — numeric (cubic feet) ✓
- `travel_distance_miles` — numeric (MILES, not km)
- `subtotal`, `surcharge_total`, `total_price` — numeric(12,2) (decimal dollars)

**KEY FINDINGS:**
- NO `computed_price` or `final_price` columns exist — must be added
- Distance stored in MILES (not kilometers or meters)
- All prices are decimal numeric(12,2), NOT integer cents

### Route Distance Units (src/modules/quotes/server/routing.ts)
- `getRouteDetails()` returns `distanceMeters` (integer, in meters)
- Route cache stores as `distance_meters` (integer)
- **Conversion needed:** meters ÷ 1609.34 = miles (for quotes.travel_distance_miles)

### Labour Hours
**NO `crew_size` field exists anywhere** in schema. Must be dropped entirely from this branch.

---

## 2. Revised Plan Based on Verified Schema

### Labour Hours Derivation

**FINAL DECISION: Volume-Only, Parameterized**

- Add `labour_hours_per_cubicft` to `pricing_settings` via new migration (numeric(12,2), default 0.1)
- Formula: `estimated_labour_hours = total_volume × labour_hours_per_cubicft`
- Do NOT include crew_size adjustments in this branch — mark as future enhancement

**Why:** Crew size doesn't exist in the schema, and adding it is scope creep. The volume-based approach is clean, tenant-configurable, and sufficient for MVP.

### Surcharge Selection & Immutability

**CRITICAL CLARIFICATION:**

Surcharges are applied at calculation time and **become immutable once quote leaves draft status**, same as inventory:

1. **While `status = 'draft'`:** 
   - Dispatcher can recalculate, adjusting selected surcharges
   - `quote_surcharges` table rows are updated
   - `computed_price` is recalculated and stored

2. **Once `status ≠ 'draft'`:**
   - Surcharge selection is locked (read-only in UI)
   - `quote_surcharges` rows are never modified
   - `computed_price` is never recalculated
   - Dispatcher already has `final_price` override from draft phase, immutable

**Mechanism:** Same guard as `saveQuoteInventory` — RPC checks `status = 'draft'` before any calculation/insert/update on `quote_surcharges`.

### Calculation Function

```typescript
interface PricingInput {
  tenantId: string;
  leadId: string;
  totalVolume: number;         // cubic feet, from quote_inventory
  distanceMeters: number;      // from Google Maps (will convert to miles in function)
  selectedSurcharges: string[]; // keys like ['stairs']
}

interface PricingOutput {
  computedPrice: number;       // decimal dollars
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

// Returns numeric(12,2) compatible values (to 2 decimal places)
export async function calculateQuotePrice(
  supabase: SupabaseClient,
  input: PricingInput
): Promise<PricingOutput>
```

**Calculation steps:**
1. Fetch `pricing_settings` for tenant (explicit `.eq('tenant_id', tenantId)`)
2. Convert distance: `distanceMiles = distanceMeters / 1609.34`
3. Compute:
   - `volumeCost = totalVolume × pricing_settings.per_cubic_foot_rate`
   - `distanceCost = distanceMiles × pricing_settings.per_mile_rate`
   - `labourHours = totalVolume × pricing_settings.labour_hours_per_cubicft`
   - `labourCost = labourHours × pricing_settings.labor_hourly_rate`
   - Fetch surcharge amounts for selected keys from `pricing_settings.surcharges` JSONB
   - `surchargeTotal = sum of selected amounts`
   - `subtotal = volumeCost + distanceCost + labourCost + surchargeTotal`
   - `minimumAdjustment = max(0, pricing_settings.base_rate - subtotal)`
   - `total = subtotal + minimumAdjustment` (= max(subtotal, base_rate))
4. Return breakdown with all numeric values as decimal

### Database Schema Additions

**New migration: 00015_phase1_pricing_calculation.sql**

```sql
-- Add labour_hours_per_cubicft to pricing_settings
ALTER TABLE pricing_settings ADD COLUMN labour_hours_per_cubicft numeric(12,2) DEFAULT 0.1;

-- Add computed_price and final_price to quotes
ALTER TABLE quotes 
  ADD COLUMN computed_price numeric(12,2),
  ADD COLUMN final_price numeric(12,2);

-- Create quote_surcharges table (audit trail + snapshot)
CREATE TABLE quote_surcharges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  surcharge_key text NOT NULL,
  surcharge_label text,
  amount numeric(12,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(quote_id, surcharge_key)
);

CREATE INDEX idx_quote_surcharges_quote ON quote_surcharges(quote_id);
```

### API Endpoint: Calculate Price

**POST /office/quotes/[id]/calculate-price**

```typescript
export async function calculatePriceAction(
  quoteId: string,
  selectedSurcharges: string[]
): Promise<{
  success: boolean;
  computed_price?: number;
  breakdown?: PricingOutput['breakdown'];
  error?: string;
}>
```

**Logic:**
1. Fetch quote, enforce `status = 'draft'` (reject with error if not)
2. Fetch lead + tenant_id for scoping
3. Fetch route distance from cache OR Google Maps
4. Call `calculateQuotePrice()`
5. Update `quotes.computed_price`
6. Upsert `quote_surcharges` rows for selected surcharges (with amounts snapshotted from calculation)
7. Return breakdown for UI display

### Manual Override

**PUT /office/quotes/[id]/final-price**

```typescript
export async function setFinalPriceAction(
  quoteId: string,
  finalPrice: number
): Promise<{ success: boolean; error?: string }>
```

**Logic:**
1. Fetch quote
2. Update `quotes.final_price = finalPrice` (allow at any status)
3. `computed_price` is never touched
4. Both values visible in UI for audit trail

### UI in Quote Workspace

**Pricing card (read-only until draft):**

```
┌─────────────────────────────────┐
│         Pricing                 │
├─────────────────────────────────┤
│ Volume:    1,500 cu-ft          │
│  @ $2.50/cu-ft = $3,750.00     │
│                                 │
│ Distance:  29.2 miles           │
│  @ $1.20/mile = $35.04         │
│                                 │
│ Labour:    15 hours             │
│  @ $45.00/hr = $675.00         │
│                                 │
│ Surcharges:                     │
│ ☐ Stairs (+$150.00)            │ (only if draft)
│ ☐ Long Carry (+$200.00)        │
│ ☐ Weekend (+$250.00)           │
│                                 │
│ Subtotal:     $4,660.04        │
│ Min charge:   $3,500 (N/A)    │
│ COMPUTED:     $4,660.04        │
│                                 │
│ ─────────────────────────────   │
│ Override Final Price:           │
│ [$4,660.04]  [Save]  [Reset]  │
│                                 │
│ [Recalculate] (only if draft)  │
└─────────────────────────────────┘
```

---

## 3. Testing Plan

### Test 1: Known-Input Calculation
```typescript
// Tenant A pricing_settings:
{
  per_cubic_foot_rate: 2.50,
  per_mile_rate: 1.20,
  labor_hourly_rate: 45.00,
  labour_hours_per_cubicft: 0.1,
  base_rate: 3500.00, // minimum
  surcharges: [
    { key: "stairs", label: "Stairs", amount: 150.00 },
    { key: "long_carry", label: "Long Carry", amount: 200.00 }
  ]
}

// Input:
{
  totalVolume: 1500,
  distanceMeters: 47000,  // ~29.2 miles
  selectedSurcharges: ['stairs']
}

// Expected output:
{
  volumeCost: 3750.00,
  distanceCost: 35.04,
  labourCost: 675.00,
  surcharges: [{ key: 'stairs', amount: 150.00 }],
  subtotal: 4610.04,
  minimumAdjustment: 0,
  total: 4610.04
}
```

### Test 2: Cross-Tenant Comparison
```typescript
// Tenant B with different rates → same input → different price
// Verifies zero code branching, purely parameterized by pricing_settings
```

### Test 3: Mutability Guard (Draft Only)
```typescript
// Quote with status='draft' → calculate succeeds
// Quote with status='sent' → calculate fails with error
// Quote with status='accepted' → calculate fails with error
```

### Test 4: Surcharge Immutability
```typescript
// While status='draft':
//   - Add surcharge → persists to quote_surcharges
//   - Recalculate with different surcharges → quote_surcharges updates
//
// After status='sent':
//   - Attempt to recalculate → fails with guard error
//   - quote_surcharges is immutable (no API endpoint to modify)
//   - UI shows surcharges read-only
```

### Test 5: Manual Override Persistence
```typescript
// Calculate → computed_price = 4610.04
// Set final_price = 5000.00
// Recalculate (if draft) → computed_price updates, final_price stays 5000.00
// Verify both stored independently
```

---

## 4. Files to Create/Modify

**New files:**
- `supabase/migrations/00015_phase1_pricing_calculation.sql` — schema additions
- `src/modules/quotes/server/pricing.ts` — `calculateQuotePrice()` function
- `src/modules/quotes/server/pricing.test.ts` — unit tests (5 scenarios above)
- `src/modules/quotes/schemas.ts` — extend with PricingInput/Output types
- `src/app/office/quotes/[id]/components/pricing-calculator.tsx` — client component

**Modified files:**
- `src/modules/quotes/server/repository.ts` — add `calculatePriceAction()`, `setFinalPriceAction()`

---

## 5. Open Items Resolved

✓ Labour hours: Added `labour_hours_per_cubicft` to pricing_settings  
✓ Surcharge structure: Confirmed JSONB array with `{ key, label, amount, type }`  
✓ Data types: All numeric(12,2) — decimal dollars, not cents  
✓ Distance unit: meters from API, convert to miles for quotes table  
✓ Quote status enum: ['draft', 'sent', 'accepted', 'declined', 'expired'] ✓  
✓ Crew size: Does not exist, dropped from this branch entirely  
✓ Surcharge immutability: Enforced by same draft-status guard as inventory, tested explicitly

---

## READY FOR IMPLEMENTATION

All ambiguities resolved. Ready to proceed.
