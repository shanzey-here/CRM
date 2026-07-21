# Phase 1 Settings — Manual E2E Verification Guide

This document provides step-by-step instructions for verifying the four critical end-to-end flows that require browser interaction.

## Prerequisites

- Dev server running: `npm run dev` (http://localhost:3000)
- Credentials from seed-dev-accounts.ts:
  - Admin: `admin@devtest.local` / `DevTest123!`
  - Dispatcher: `dispatcher@devtest.local` / `DevTest123!`
  - Tenant: "Dev Test Removals"

---

## Test 4: Dispatcher Redirect from /office/settings/staff

**Objective**: Verify that a dispatcher user cannot access `/office/settings/staff` and is redirected

**Steps**:
1. Open browser DevTools (F12)
2. Navigate to http://localhost:3000/login
3. Log in as: `dispatcher@devtest.local` / `DevTest123!`
4. After login, you should be on /office/leads dashboard
5. In URL bar, manually navigate to: `http://localhost:3000/office/settings/staff`
6. **EXPECTED RESULT**: 
   - Page redirects to `http://localhost:3000/office/settings`
   - You see the Settings page with only "Inventory Catalog", "Branding", and "Pricing" sections
   - NO "Staff" option visible in the sidebar

**PASTE EVIDENCE**:
```
Actual URL after navigation: [PASTE RESULTING URL]
Page content visible: [PASTE SCREENSHOT OR TEXT OF WHAT RENDERED]
"Staff" link visible in sidebar: YES / NO
```

---

## Test 6: Invite Staff & Verify JWT Claims

**Objective**: Invite a new staff member, log in as them, verify their JWT contains correct tenant_id and tenant_role

**Steps**:

### Part A: Invite Staff Member
1. Open browser, navigate to http://localhost:3000/login
2. Log in as: `admin@devtest.local` / `DevTest123!`
3. Navigate to: `http://localhost:3000/office/settings/staff`
4. You should see "Leads to Follow Up" with existing staff list + invite form on right
5. In the invite form, enter:
   - Full Name: `E2E Test Dispatcher`
   - Email: `e2e-test-dispatcher-TIMESTAMP@test.local` (use current timestamp)
   - Role: Select "Dispatcher"
6. Click "Invite Staff Member"
7. **EXPECTED**: Success message appears showing temporary password
8. **PASTE EVIDENCE**:
   ```
   Email invited: [PASTE EMAIL]
   Temporary password shown: [PASTE PASSWORD]
   ```

### Part B: Log In as New Staff Member
1. Open a new private/incognito browser window (to avoid session conflicts)
2. Navigate to http://localhost:3000/login
3. Log in with:
   - Email: [PASTE EMAIL FROM PART A]
   - Password: [PASTE TEMP PASSWORD FROM PART A]
4. After successful login, you should land on the /office/leads dashboard
5. Open browser DevTools (F12) → Console tab
6. Paste this command to inspect JWT claims:
   ```javascript
   (async () => {
     const { data: { user } } = await supabase.auth.getUser();
     console.log("User JWT Claims:");
     console.log("  sub:", user.id);
     console.log("  email:", user.email);
     console.log("  app_metadata.tenant_id:", user.app_metadata?.tenant_id);
     console.log("  app_metadata.tenant_role:", user.app_metadata?.tenant_role);
   })()
   ```
7. **EXPECTED**: Console output shows:
   - `tenant_id`: matches the dev-test-removals tenant ID
   - `tenant_role`: "dispatcher"

**PASTE EVIDENCE**:
```
Console output:
[PASTE FULL CONSOLE OUTPUT]

Verify:
- tenant_id is valid UUID: YES / NO
- tenant_role = "dispatcher": YES / NO
```

---

## Test 7: Surcharge Edit Round-Trip to Quote Engine

**Objective**: Edit a surcharge amount, generate a quote, verify pricing engine uses the new value

**Steps**:

### Part A: Edit Surcharge
1. Log in as admin: `admin@devtest.local` / `DevTest123!`
2. Navigate to: `http://localhost:3000/office/settings/pricing`
3. Scroll to "Surcharges" section
4. Add a new surcharge:
   - Key: `stairs`
   - Label: `Stairs Surcharge`
   - Amount: `50`
5. Click "Save Pricing Settings"
6. **EXPECTED**: Success message shows
7. **PASTE EVIDENCE**:
   ```
   Surcharge added:
   - Key: stairs
   - Label: Stairs Surcharge
   - Amount: £50
   Success message: [PASTE TEXT]
   ```

### Part B: Generate Quote with Surcharge
1. Navigate to: `http://localhost:3000/office/leads`
2. Select any existing lead (or create a new one)
3. Create a quote for that lead with inventory including "Stairs Surcharge"
4. On the quote preview, look for the surcharge line item
5. Note the surcharge amount in the quote total
6. **EXPECTED**: Quote shows £50 for stairs surcharge
7. **PASTE EVIDENCE**:
   ```
   Quote Total Line Items:
   [PASTE ALL LINE ITEMS FROM QUOTE]
   
   Stairs Surcharge line: YES / NO
   Amount shown: £[PASTE]
   Matches saved amount (£50): YES / NO
   ```

### Part C: Edit Surcharge & Verify New Quote Uses It
1. Go back to `/office/settings/pricing`
2. Find the "Stairs Surcharge" row
3. Change amount from `50` to `75`
4. Click "Save Pricing Settings"
5. Go back to `/office/leads` and create a NEW quote for a different lead
6. Add the same stairs surcharge to this new quote
7. **EXPECTED**: New quote shows £75 for surcharge, old quote still shows £50
8. **PASTE EVIDENCE**:
   ```
   Old quote (created with £50):
   Stairs Surcharge: £50
   
   New quote (created with £75):
   Stairs Surcharge: £75
   
   Proves quotes snapshot pricing at creation: YES / NO
   ```

---

## Test 8: Logo Upload & Live Preview

**Objective**: Upload a logo image, verify URL is stored, fetch it successfully, see it in live preview

**Steps**:

### Part A: Upload Logo
1. Log in as admin: `admin@devtest.local` / `DevTest123!`
2. Navigate to: `http://localhost:3000/office/settings/branding`
3. In "Live Preview" panel on right: logo area should be empty
4. Scroll to "Logo" section at top of form
5. Click file input, select any image file (PNG/JPG, 100x100px or larger recommended)
6. **EXPECTED**: Image preview appears immediately in the form (client-side, before save)
7. Click "Save Branding Settings"
8. **EXPECTED**: Success message appears
9. **PASTE EVIDENCE**:
   ```
   File uploaded: [PASTE FILENAME]
   Client-side preview appeared before save: YES / NO
   Save succeeded: YES / NO
   ```

### Part B: Verify Logo URL in Database
1. Open browser console (F12)
2. Paste:
   ```javascript
   (async () => {
     const { data: settings } = await supabase
       .from('tenant_settings')
       .select('logo_url')
       .single();
     console.log("Logo URL from DB:", settings.logo_url);
   })()
   ```
3. Note the full URL that appears
4. **EXPECTED**: URL is like `https://.../storage/v1/object/public/tenant-logos/...`
5. **PASTE EVIDENCE**:
   ```
   Console output - Logo URL:
   [PASTE FULL URL]
   
   URL format valid (contains tenant-logos, public, etc.): YES / NO
   ```

### Part C: Fetch Logo URL & Verify HTTP Response
1. Copy the URL from Part B
2. In console, paste:
   ```javascript
   (async () => {
     const logoUrl = "[PASTE THE URL FROM PART B]";
     const response = await fetch(logoUrl);
     console.log("Fetch Response:");
     console.log("  Status:", response.status);
     console.log("  Content-Type:", response.headers.get('content-type'));
   })()
   ```
3. **EXPECTED**:
   - Status: 200
   - Content-Type: image/png (or image/jpeg, etc.)
4. **PASTE EVIDENCE**:
   ```
   Fetch response:
   - Status: [PASTE]
   - Content-Type: [PASTE]
   
   Is 200 OK: YES / NO
   Is image content-type: YES / NO
   ```

### Part D: Verify Live Preview Updated
1. Scroll to "Live Preview" panel on right side of branding form
2. Look at the mock proposal header section
3. **EXPECTED**: Your uploaded logo image appears in the preview
4. **PASTE EVIDENCE**:
   ```
   Live Preview panel shows logo: YES / NO
   Logo matches uploaded file: YES / NO
   Screenshot of preview: [PASTE OR DESCRIBE]
   ```

---

## Summary

After completing all four tests, paste results in the following format:

```
TEST 4 - Dispatcher Redirect:
  ✓ or ✗: [PASS/FAIL]
  Evidence: [URL + Screenshot]

TEST 6 - Invite & JWT:
  ✓ or ✗: [PASS/FAIL]
  Evidence: [Console output with tenant_id and tenant_role]

TEST 7 - Surcharge Round-Trip:
  ✓ or ✗: [PASS/FAIL]
  Evidence: [Quote line items showing surcharge with correct amount]

TEST 8 - Logo Upload:
  ✓ or ✗: [PASS/FAIL]
  Evidence: [DB URL + HTTP 200 response + Live Preview screenshot]
```

All four must show ✓ PASS before feature is considered complete.
