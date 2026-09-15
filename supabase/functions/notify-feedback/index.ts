// deno-lint-ignore no-import-prefix -- Supabase Edge Functions use URL imports.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type AdminEmailDeliveryClient,
  claimDelivery,
  completeDelivery,
  failDelivery,
} from "../_shared/admin-email-delivery.ts";
import {
  buildFeedbackEmail,
  type FeedbackType,
  isAuthorizedWebhookRequest,
  parseInsertWebhook,
} from "../_shared/admin-email-notifications.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const DEFAULT_ADMIN_EMAIL = "samdgammon@gmail.com";
const DEFAULT_FROM_EMAIL = "notifications@mail.readyall.org";
const EVENT_TYPE = "user_feedback" as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CanonicalFeedback {
  id: string;
  user_id: string;
  feedback_type: FeedbackType;
  message: string;
  created_at: string;
}

interface CanonicalFeedbackUser {
  id: string;
  email?: string;
}

interface FeedbackProfile {
  display_name: string | null;
}

export interface FeedbackLogger {
  error(message: string, context: Record<string, unknown>): void;
  info(message: string, context: Record<string, unknown>): void;
}

export interface FeedbackHandlerDependencies {
  webhookSecret: string;
  serviceRoleKey: string;
  resendApiKey: string;
  adminEmail?: string;
  fromEmail?: string;
  deliveryClient: AdminEmailDeliveryClient;
  loadFeedback(sourceId: string): Promise<CanonicalFeedback | null>;
  loadUser(userId: string): Promise<CanonicalFeedbackUser>;
  loadProfile(userId: string): Promise<FeedbackProfile | null>;
  fetcher: typeof fetch;
  logger?: FeedbackLogger;
}

export type FeedbackNotificationHandler = (req: Request) => Promise<Response>;

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
  deps: FeedbackHandlerDependencies,
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
    deps.logger?.error("Feedback failure ledger update failed", {
      eventType: EVENT_TYPE,
      sourceId,
      status: "failure_update_failed",
      error: errorMessage(ledgerError),
    });
    return jsonResponse(500, {
      error: "Failed to record notification failure.",
    });
  }

  deps.logger?.error("Feedback notification failed", {
    eventType: EVENT_TYPE,
    sourceId,
    status: "failed",
    error: message,
  });
  return jsonResponse(responseStatus, {
    error: "Feedback notification failed.",
  });
}

function isFeedbackType(value: unknown): value is FeedbackType {
  return value === "bug" || value === "feature" || value === "other";
}

export function createFeedbackNotificationHandler(
  deps: FeedbackHandlerDependencies,
): FeedbackNotificationHandler {
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
      sourceId = parseInsertWebhook(
        await req.json(),
        "public",
        "user_feedback",
      ).sourceId;
    } catch {
      return jsonResponse(400, {
        error: "Invalid public.user_feedback INSERT webhook.",
      });
    }

    let claimToken: string | null;
    try {
      claimToken = await claimDelivery(
        deps.deliveryClient,
        EVENT_TYPE,
        sourceId,
      );
    } catch (error) {
      deps.logger?.error("Feedback delivery claim failed", {
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
      deps.logger?.info("Feedback notification skipped", {
        eventType: EVENT_TYPE,
        sourceId,
        status: "duplicate",
      });
      return jsonResponse(200, { ok: true, skipped: true });
    }

    let feedback: CanonicalFeedback;
    let user: CanonicalFeedbackUser;
    let profile: FeedbackProfile | null;
    try {
      const canonicalFeedback = await deps.loadFeedback(sourceId);
      if (!canonicalFeedback) {
        return await recordFailure(
          deps,
          sourceId,
          claimToken,
          new Error("Canonical feedback row not found."),
          404,
        );
      }
      if (
        canonicalFeedback.id !== sourceId ||
        !canonicalFeedback.user_id ||
        !isFeedbackType(canonicalFeedback.feedback_type) ||
        typeof canonicalFeedback.message !== "string" ||
        !canonicalFeedback.created_at
      ) {
        throw new Error("Canonical feedback row is incomplete or mismatched.");
      }
      feedback = canonicalFeedback;
      user = await deps.loadUser(feedback.user_id);
      if (user.id !== feedback.user_id || !user.email) {
        throw new Error("Canonical Auth user is incomplete or mismatched.");
      }
      profile = await deps.loadProfile(feedback.user_id);
    } catch (error) {
      return await recordFailure(deps, sourceId, claimToken, error, 500);
    }

    const payload = buildFeedbackEmail({
      fromEmail: deps.fromEmail ?? DEFAULT_FROM_EMAIL,
      adminEmail: deps.adminEmail ?? DEFAULT_ADMIN_EMAIL,
      displayName: profile?.display_name ?? null,
      email: user.email,
      feedbackType: feedback.feedback_type,
      message: feedback.message,
      submittedAt: feedback.created_at,
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
      deps.logger?.error("Feedback delivery completion failed", {
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

    deps.logger?.info("Feedback notification sent", {
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

interface RuntimeFeedbackQuery<T> {
  select(columns: string): RuntimeFeedbackQuery<T>;
  eq(column: string, value: string): RuntimeFeedbackQuery<T>;
  maybeSingle(): Promise<RuntimeQueryResult<T>>;
}

interface RuntimeSupabaseClient extends AdminEmailDeliveryClient {
  auth: {
    admin: {
      getUserById(id: string): Promise<{
        data: { user: CanonicalFeedbackUser | null };
        error: { message: string } | null;
      }>;
    };
  };
  from<T>(table: string): RuntimeFeedbackQuery<T>;
}

function runtimeHandler(): FeedbackNotificationHandler {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const webhookSecret = Deno.env.get("ADMIN_NOTIFICATION_WEBHOOK_SECRET") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as RuntimeSupabaseClient;

  return createFeedbackNotificationHandler({
    webhookSecret,
    serviceRoleKey,
    resendApiKey,
    adminEmail: Deno.env.get("ADMIN_NOTIFICATION_EMAIL"),
    fromEmail: Deno.env.get("RESEND_FROM_EMAIL"),
    deliveryClient: client,
    async loadFeedback(sourceId) {
      const { data, error } = await client.from<CanonicalFeedback>(
        "user_feedback",
      )
        .select("id, user_id, feedback_type, message, created_at")
        .eq("id", sourceId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    async loadUser(userId) {
      const { data, error } = await client.auth.admin.getUserById(userId);
      if (error || !data.user) {
        throw new Error(error?.message ?? "Canonical Auth user not found.");
      }
      return data.user;
    },
    async loadProfile(userId) {
      const { data, error } = await client.from<FeedbackProfile>(
        "user_profiles",
      )
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
