// deno-lint-ignore no-import-prefix -- Supabase Edge Functions use URL imports.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type AdminEmailDeliveryClient,
  claimDelivery,
  completeDelivery,
  failDelivery,
} from "../_shared/admin-email-delivery.ts";
import {
  buildSignupEmail,
  isAuthorizedWebhookRequest,
  parseInsertWebhook,
} from "../_shared/admin-email-notifications.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const DEFAULT_ADMIN_EMAIL = "samdgammon@gmail.com";
const DEFAULT_FROM_EMAIL = "notifications@mail.readyall.org";
const EVENT_TYPE = "user_signup" as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CanonicalSignupUser {
  id: string;
  email?: string;
  created_at: string;
}

interface SignupProfile {
  display_name: string | null;
}

export interface SignupLogger {
  error(message: string, context: Record<string, unknown>): void;
  info(message: string, context: Record<string, unknown>): void;
}

export interface SignupHandlerDependencies {
  webhookSecret: string;
  serviceRoleKey: string;
  resendApiKey: string;
  adminEmail?: string;
  fromEmail?: string;
  deliveryClient: AdminEmailDeliveryClient;
  loadUser(sourceId: string): Promise<CanonicalSignupUser>;
  loadProfile(userId: string): Promise<SignupProfile | null>;
  fetcher: typeof fetch;
  logger?: SignupLogger;
}

export type SignupNotificationHandler = (req: Request) => Promise<Response>;

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

async function recordFailure(
  deps: SignupHandlerDependencies,
  sourceId: string,
  claimToken: string,
  failure: unknown,
  responseStatus: number,
): Promise<Response> {
  const message = errorMessage(failure);
  try {
    await failDelivery(
      deps.deliveryClient,
      EVENT_TYPE,
      sourceId,
      claimToken,
      message,
    );
  } catch (ledgerError) {
    deps.logger?.error("Signup failure ledger update failed", {
      eventType: EVENT_TYPE,
      sourceId,
      status: "failure_update_failed",
      error: errorMessage(ledgerError),
    });
    return jsonResponse(500, {
      error: "Failed to record notification failure.",
    });
  }

  deps.logger?.error("Signup notification failed", {
    eventType: EVENT_TYPE,
    sourceId,
    status: "failed",
    error: message,
  });
  return jsonResponse(responseStatus, { error: "Signup notification failed." });
}

export function createSignupNotificationHandler(
  deps: SignupHandlerDependencies,
): SignupNotificationHandler {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return jsonResponse(405, { error: "Method not allowed." });
    }
    if (!deps.webhookSecret || !deps.serviceRoleKey || !deps.resendApiKey) {
      return jsonResponse(500, {
        error: "Missing required server configuration.",
      });
    }
    if (!isAuthorizedWebhookRequest(req, deps.webhookSecret)) {
      return jsonResponse(401, { error: "Unauthorized." });
    }

    let sourceId: string;
    try {
      sourceId = parseInsertWebhook(await req.json(), "auth", "users").sourceId;
    } catch {
      return jsonResponse(400, { error: "Invalid auth.users INSERT webhook." });
    }

    let claimToken: string | null;
    try {
      claimToken = await claimDelivery(
        deps.deliveryClient,
        EVENT_TYPE,
        sourceId,
      );
    } catch (error) {
      deps.logger?.error("Signup delivery claim failed", {
        eventType: EVENT_TYPE,
        sourceId,
        status: "claim_failed",
        error: errorMessage(error),
      });
      return jsonResponse(500, {
        error: "Failed to claim notification delivery.",
      });
    }
    if (!claimToken) {
      deps.logger?.info("Signup notification skipped", {
        eventType: EVENT_TYPE,
        sourceId,
        status: "duplicate",
      });
      return jsonResponse(200, { ok: true, skipped: true });
    }

    let user: CanonicalSignupUser;
    let profile: SignupProfile | null;
    try {
      user = await deps.loadUser(sourceId);
      if (user.id !== sourceId || !user.email || !user.created_at) {
        throw new Error("Canonical Auth user is incomplete or mismatched.");
      }
      profile = await deps.loadProfile(sourceId);
    } catch (error) {
      return await recordFailure(deps, sourceId, claimToken, error, 500);
    }

    const payload = buildSignupEmail({
      fromEmail: deps.fromEmail ?? DEFAULT_FROM_EMAIL,
      adminEmail: deps.adminEmail ?? DEFAULT_ADMIN_EMAIL,
      displayName: profile?.display_name ?? null,
      email: user.email,
      createdAt: user.created_at,
    });
    const idempotencyKey = `admin-email:${EVENT_TYPE}:${sourceId}`;

    let resendResult: Response;
    try {
      resendResult = await deps.fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${deps.resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      return await recordFailure(deps, sourceId, claimToken, error, 502);
    }
    if (!resendResult.ok) {
      return await recordFailure(
        deps,
        sourceId,
        claimToken,
        new Error(`Resend returned HTTP ${resendResult.status}.`),
        502,
      );
    }

    try {
      await completeDelivery(
        deps.deliveryClient,
        EVENT_TYPE,
        sourceId,
        claimToken,
      );
    } catch (error) {
      deps.logger?.error("Signup delivery completion failed", {
        eventType: EVENT_TYPE,
        sourceId,
        status: "completion_failed",
        resendStatus: resendResult.status,
        error: errorMessage(error),
      });
      return jsonResponse(500, {
        error: "Email sent but delivery completion failed.",
      });
    }

    deps.logger?.info("Signup notification sent", {
      eventType: EVENT_TYPE,
      sourceId,
      status: "sent",
      resendStatus: resendResult.status,
    });
    return jsonResponse(200, { ok: true });
  };
}

interface RuntimeQueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

interface RuntimeProfileQuery {
  select(columns: string): RuntimeProfileQuery;
  eq(column: string, value: string): RuntimeProfileQuery;
  maybeSingle(): Promise<RuntimeQueryResult<SignupProfile>>;
}

interface RuntimeSupabaseClient extends AdminEmailDeliveryClient {
  auth: {
    admin: {
      getUserById(id: string): Promise<
        {
          data: { user: CanonicalSignupUser | null };
          error: { message: string } | null;
        }
      >;
    };
  };
  from(table: string): RuntimeProfileQuery;
}

function runtimeHandler(): SignupNotificationHandler {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const webhookSecret = Deno.env.get("ADMIN_NOTIFICATION_WEBHOOK_SECRET") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as RuntimeSupabaseClient;

  return createSignupNotificationHandler({
    webhookSecret,
    serviceRoleKey,
    resendApiKey,
    adminEmail: Deno.env.get("ADMIN_NOTIFICATION_EMAIL"),
    fromEmail: Deno.env.get("RESEND_FROM_EMAIL"),
    deliveryClient: client,
    async loadUser(sourceId) {
      const { data, error } = await client.auth.admin.getUserById(sourceId);
      if (error || !data.user) {
        throw new Error(error?.message ?? "Canonical Auth user not found.");
      }
      return data.user;
    },
    async loadProfile(userId) {
      const { data, error } = await client.from("user_profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    fetcher: fetch,
    logger: console,
  });
}

if (import.meta.main) {
  Deno.serve(runtimeHandler());
}
