---
description: Build a new module end-to-end in small, reviewable, isolation-safe, decoupled steps. Usage: /new-module <module name>
---

# /new-module

Build the named module following this sequence. Pause for review at step 1 before writing code.

1. **Plan (Planning mode).** Read the relevant part of the project spec and any modules this one depends on. Produce a numbered implementation plan — the tables it owns, the events it emits/consumes, the API surface, the UI, and how it wires into the dashboard. Wait for approval before coding.
2. **Schema slice + RLS.** Add only this module's own tables. Load and follow the `tenant-isolation` skill: `tenant_id` everywhere, RLS enabled, per-role policies. Do NOT read or write other modules' tables directly — depend on their service interfaces or on domain events. Keep it a small migration.
3. **Isolation tests first.** Write the cross-tenant and cross-role tests for the new tables and confirm they fail correctly. Do not proceed until they pass.
4. **Server / API logic.** Repository pattern, TypeScript strict, secrets from env only. Emit domain events for anything other modules may care about; consume events rather than calling into other modules.
5. **Async for external calls.** Any call to an external service (social, WhatsApp, AI, Maps, accounting) runs as a background job via the queue, with timeouts and retries — never inline in the request path.
6. **UI.** Build the screens; keep the module self-contained and degrade gracefully if its data fails to load.
7. **Wire into the dashboard** only after the module works on its own. Register it in the per-tenant module registry so it can be toggled.
8. **Self-verify in the browser**, then summarize what changed and list any decisions you assumed so I can confirm.

Keep each step a small, separately reviewable change. Do not pull in other phases' features. New modules must attach via events and the module registry without editing existing modules.
