<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:form-pattern-rules -->
# Forms Standard Pattern

All edit/create forms in the CRM must use eact-hook-form integrated with @hookform/resolvers/zod mapping directly to the Zod schemas in the module's schemas.ts file. This provides instant client-side feedback and prevents round-trip-per-typo experiences. Use Server Actions for the actual submission.
<!-- END:form-pattern-rules -->

<!-- BEGIN:verification-rules -->
# Verification Before Reporting Completion

**Critical rule:** Never report a page, route, file, or feature as created/working without first confirming it actually renders, executes, or functions as expected. This applies to:

- **Pages/routes:** Build the project, then actually navigate to the route (via `curl`, `fetch`, browser session, or code that executes it) and confirm it renders without 404 or errors. Report the real output.
- **Test files:** Run the test and paste the actual pass/fail results. Don't claim tests are ready until they've executed.
- **Server Actions & API endpoints:** Call the endpoint with a real request and confirm the response. Don't assume it works based on code review.
- **Database migrations:** After pushing migrations, run a query that exercises them (not just "should work").
- **Auth-gated routes:** Log in as the required role and confirm the route renders with correct claims/data, not just that the code looks right.

**Why:** Several items in recent branches were reported as complete but failed when actually tested (e.g. a page reported as created that returned 404, test files marked as ready but never run). This rule prevents silent failures.

**How to report:** Always include evidence:
- Pages: "Confirmed rendering via curl/browser session: [output]"
- Tests: "Test run output: [real output with pass/fail counts]"
- API/Actions: "[Actual response from request]"
- Auth routes: "Logged in as [role], verified claims [actual values], page rendered [heading shown]"

This is not about verbose reporting—it's about catching broken code before merging. A single line of evidence is sufficient: "✓ Build passed, /customer page renders (logged in as customer, shows tenant_role: customer)".
<!-- END:verification-rules -->
