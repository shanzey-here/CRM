// =============================================================================
// handle-auth-claims — Supabase Edge Function
// =============================================================================
// The SINGLE POINT OF TRUTH for writing tenant claims into JWT app_metadata.
// Without this function, newly signed-up users have no tenant_id in their
// token and every RLS check returns nothing.
//
// Operations:
//   1. set_tenant_claims  — On signup/invite: writes { tenant_id, tenant_role, is_super_admin }
//   2. update_role        — On role change: updates tenant_role claim
//   3. set_super_admin    — On platform-admin provisioning: sets is_super_admin = true
//
// Security:
//   - Uses SUPABASE_SERVICE_ROLE_KEY from env (never exposed to client code)
//   - Invoked server-to-server or via protected admin routes only
//   - Validates all inputs before writing to auth
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SetTenantClaimsPayload {
  action: "set_tenant_claims";
  user_id: string;
  tenant_id: string;
  tenant_role: "tenant_admin" | "dispatcher" | "crew" | "customer";
}

interface UpdateRolePayload {
  action: "update_role";
  user_id: string;
  tenant_role: "tenant_admin" | "dispatcher" | "crew" | "customer";
}

interface SetSuperAdminPayload {
  action: "set_super_admin";
  user_id: string;
}

type RequestPayload =
  | SetTenantClaimsPayload
  | UpdateRolePayload
  | SetSuperAdminPayload;

const VALID_TENANT_ROLES = [
  "tenant_admin",
  "dispatcher",
  "crew",
  "customer",
] as const;

/**
 * Validate that a string is a valid UUID v4 format.
 */
function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

Deno.serve(async (req: Request): Promise<Response> => {
  // ── Only accept POST ──────────────────────────────────────────────────
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Parse request body ────────────────────────────────────────────────
  let body: RequestPayload;
  try {
    body = (await req.json()) as RequestPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Validate common fields ────────────────────────────────────────────
  if (!body.action || !body.user_id) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: action, user_id" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!isValidUuid(body.user_id)) {
    return new Response(
      JSON.stringify({ error: "user_id must be a valid UUID" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Build Supabase Admin client (service_role) ────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured: missing env vars" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    switch (body.action) {
      // ──────────────────────────────────────────────────────────────────
      // ACTION: set_tenant_claims
      // Called on user signup / tenant invitation.
      // Writes tenant_id, tenant_role, is_super_admin into app_metadata.
      // ──────────────────────────────────────────────────────────────────
      case "set_tenant_claims": {
        const { user_id, tenant_id, tenant_role } =
          body as SetTenantClaimsPayload;

        if (!tenant_id || !isValidUuid(tenant_id)) {
          return new Response(
            JSON.stringify({ error: "tenant_id must be a valid UUID" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        if (
          !tenant_role ||
          !VALID_TENANT_ROLES.includes(
            tenant_role as (typeof VALID_TENANT_ROLES)[number]
          )
        ) {
          return new Response(
            JSON.stringify({
              error: `tenant_role must be one of: ${VALID_TENANT_ROLES.join(", ")}`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const { error } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          {
            app_metadata: {
              tenant_id,
              tenant_role,
              is_super_admin: false,
            },
          }
        );

        if (error) {
          throw error;
        }

        // Also upsert the public.users row to keep it in sync
        const { error: upsertError } = await supabaseAdmin
          .from("users")
          .upsert(
            {
              id: user_id,
              tenant_id,
              role: tenant_role,
              // full_name and email will be set by the caller or signup hook
            },
            { onConflict: "id", ignoreDuplicates: false }
          );

        if (upsertError) {
          console.error(
            "Warning: users table upsert failed (non-fatal):",
            upsertError.message
          );
          // Non-fatal: the critical auth metadata was already written.
          // The users row may need to be created separately.
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Tenant claims set for user ${user_id}`,
            claims: { tenant_id, tenant_role, is_super_admin: false },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // ──────────────────────────────────────────────────────────────────
      // ACTION: update_role
      // Called by tenant_admin when changing a user's role within the tenant.
      // Updates only the tenant_role claim in app_metadata.
      // ──────────────────────────────────────────────────────────────────
      case "update_role": {
        const { user_id, tenant_role } = body as UpdateRolePayload;

        if (
          !tenant_role ||
          !VALID_TENANT_ROLES.includes(
            tenant_role as (typeof VALID_TENANT_ROLES)[number]
          )
        ) {
          return new Response(
            JSON.stringify({
              error: `tenant_role must be one of: ${VALID_TENANT_ROLES.join(", ")}`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Fetch current app_metadata to preserve other fields
        const { data: userData, error: fetchError } =
          await supabaseAdmin.auth.admin.getUserById(user_id);

        if (fetchError || !userData?.user) {
          return new Response(
            JSON.stringify({ error: `User not found: ${user_id}` }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }

        const currentMeta = userData.user.app_metadata || {};

        const { error } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          {
            app_metadata: {
              ...currentMeta,
              tenant_role,
            },
          }
        );

        if (error) {
          throw error;
        }

        // Sync to public.users table
        const { error: updateError } = await supabaseAdmin
          .from("users")
          .update({ role: tenant_role })
          .eq("id", user_id);

        if (updateError) {
          console.error(
            "Warning: users table update failed (non-fatal):",
            updateError.message
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Role updated to '${tenant_role}' for user ${user_id}`,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // ──────────────────────────────────────────────────────────────────
      // ACTION: set_super_admin
      // Called by platform operator to provision a super-admin.
      // Sets is_super_admin = true and tenant_id = null.
      // ──────────────────────────────────────────────────────────────────
      case "set_super_admin": {
        const { user_id } = body as SetSuperAdminPayload;

        const { error } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          {
            app_metadata: {
              tenant_id: null,
              tenant_role: null,
              is_super_admin: true,
            },
          }
        );

        if (error) {
          throw error;
        }

        // Sync to public.users table
        const { error: updateError } = await supabaseAdmin
          .from("users")
          .update({ tenant_id: null, role: null })
          .eq("id", user_id);

        if (updateError) {
          console.error(
            "Warning: users table update failed (non-fatal):",
            updateError.message
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Super-admin provisioned for user ${user_id}`,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({
            error: `Unknown action: ${(body as Record<string, unknown>).action}. Valid actions: set_tenant_claims, update_role, set_super_admin`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(`handle-auth-claims error [${body.action}]:`, message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
