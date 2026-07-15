<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:form-pattern-rules -->
# Forms Standard Pattern

All edit/create forms in the CRM must use eact-hook-form integrated with @hookform/resolvers/zod mapping directly to the Zod schemas in the module's schemas.ts file. This provides instant client-side feedback and prevents round-trip-per-typo experiences. Use Server Actions for the actual submission.
<!-- END:form-pattern-rules -->
