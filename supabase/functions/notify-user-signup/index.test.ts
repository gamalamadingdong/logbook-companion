import { strict as assert } from "node:assert";
import type { AdminEmailDeliveryClient } from "../_shared/admin-email-delivery.ts";
import {
  createSignupNotificationHandler,
  type SignupHandlerDependencies,
} from "./index.ts";

const SOURCE_ID = "11111111-1111-4111-8111-111111111111";
const WEBHOOK_SECRET = "test-webhook-secret";
const SERVICE_KEY = "test-service-role";
const CLAIM_TOKEN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type RpcCall = { functionName: string; params: Record<string, unknown> };

function deliveryClient(
  calls: RpcCall[],
  options: { duplicate?: boolean; completeError?: boolean } = {},
): AdminEmailDeliveryClient {
  return {
    rpc(functionName, params) {
      calls.push({ functionName, params });
      if (functionName === "claim_admin_email_delivery") {
        return Promise.resolve({
          data: options.duplicate ? [] : [{
            event_type: "user_signup",
            source_id: SOURCE_ID,
            status: "processing",
            claim_token: CLAIM_TOKEN,
            attempt_count: 1,
          }],
          error: null,
        });
      }
      if (
        functionName === "complete_admin_email_delivery" &&
        options.completeError
      ) {
        return Promise.resolve({
          data: null,
          error: { message: "complete failed" },
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
}

function baseDependencies(
  calls: RpcCall[],
  overrides: Partial<SignupHandlerDependencies> = {},
): SignupHandlerDependencies {
  return {
    webhookSecret: WEBHOOK_SECRET,
    serviceRoleKey: SERVICE_KEY,
    resendApiKey: "test-resend-key",
    deliveryClient: deliveryClient(calls),
    loadUser: () =>
      Promise.resolve({
        id: SOURCE_ID,
        email: "canonical@example.test",
        created_at: "2026-09-15T12:00:00.000Z",
      }),
    loadProfile: () => Promise.resolve({ display_name: "Canonical <Name>" }),
    fetcher: () => Promise.resolve(new Response("{}", { status: 200 })),
    ...overrides,
  };
}

function webhookRequest(
  body: unknown = {
    type: "INSERT",
    schema: "auth",
    table: "users",
    record: { id: SOURCE_ID, email: "forged@example.test" },
  },
  authorization = `Bearer ${WEBHOOK_SECRET}`,
): Request {
  return new Request("https://example.test/notify-user-signup", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

Deno.test("signup handler rejects non-webhook-secret bearer auth before claiming", async () => {
  const calls: RpcCall[] = [];
  const handler = createSignupNotificationHandler(baseDependencies(calls));

  const response = await handler(
    webhookRequest(undefined, `Bearer ${SERVICE_KEY}`),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(calls, []);
});

Deno.test("signup handler rejects malformed and wrong webhook identities", async () => {
  for (
    const body of [
      {
        type: "UPDATE",
        schema: "auth",
        table: "users",
        record: { id: SOURCE_ID },
      },
      {
        type: "INSERT",
        schema: "public",
        table: "users",
        record: { id: SOURCE_ID },
      },
      {
        type: "INSERT",
        schema: "auth",
        table: "profiles",
        record: { id: SOURCE_ID },
      },
      { type: "INSERT", schema: "auth", table: "users", record: { id: "bad" } },
    ]
  ) {
    const calls: RpcCall[] = [];
    const response = await createSignupNotificationHandler(
      baseDependencies(calls),
    )(
      webhookRequest(body),
    );
    assert.equal(response.status, 400);
    assert.deepEqual(calls, []);
  }
});

Deno.test("signup handler skips a valid duplicate claim without canonical reads or send", async () => {
  const calls: RpcCall[] = [];
  let read = false;
  let sent = false;
  const handler = createSignupNotificationHandler(baseDependencies(calls, {
    deliveryClient: deliveryClient(calls, { duplicate: true }),
    loadUser: () => {
      read = true;
      throw new Error("should not load");
    },
    fetcher: () => {
      sent = true;
      throw new Error("should not send");
    },
  }));

  const response = await handler(webhookRequest());

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, skipped: true });
  assert.equal(read, false);
  assert.equal(sent, false);
  assert.equal(calls.length, 1);
});

Deno.test("signup handler uses canonical data, fallbacks, idempotency header, and completes", async () => {
  const calls: RpcCall[] = [];
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const handler = createSignupNotificationHandler(baseDependencies(calls, {
    loadProfile: () => Promise.resolve({ display_name: "Canonical <Name>" }),
    fetcher: (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return Promise.resolve(new Response("{}", { status: 200 }));
    },
  }));

  const response = await handler(webhookRequest());

  assert.equal(response.status, 200);
  assert.equal(requestUrl, "https://api.resend.com/emails");
  const headers = new Headers(requestInit?.headers);
  assert.equal(
    headers.get("Idempotency-Key"),
    `admin-email:user_signup:${SOURCE_ID}`,
  );
  const payload = JSON.parse(String(requestInit?.body));
  assert.deepEqual(payload.to, ["samdgammon@gmail.com"]);
  assert.equal(payload.from, "notifications@mail.readyall.org");
  assert.equal(payload.subject.includes("Canonical <Name>"), true);
  assert.equal(payload.subject.includes("forged@example.test"), false);
  assert.equal(payload.html.includes("Canonical &lt;Name&gt;"), true);
  assert.equal(payload.html.includes("canonical@example.test"), true);
  assert.equal(calls.at(-1)?.functionName, "complete_admin_email_delivery");
  assert.equal(calls.at(-1)?.params.p_claim_token, CLAIM_TOKEN);
});

Deno.test("signup canonical lookup failure is persisted and returns non-2xx", async () => {
  const calls: RpcCall[] = [];
  const response = await createSignupNotificationHandler(
    baseDependencies(calls, {
      loadUser: () => Promise.reject(new Error("Auth lookup failed")),
    }),
  )(webhookRequest());

  assert.equal(response.status, 500);
  assert.equal(calls.at(-1)?.functionName, "fail_admin_email_delivery");
  assert.equal(calls.at(-1)?.params.p_claim_token, CLAIM_TOKEN);
  assert.equal(calls.at(-1)?.params.p_error, "Auth lookup failed");
});

Deno.test("signup Resend failure is persisted and returns 502", async () => {
  const calls: RpcCall[] = [];
  const response = await createSignupNotificationHandler(
    baseDependencies(calls, {
      fetcher: () =>
        Promise.resolve(new Response("provider details", { status: 503 })),
    }),
  )(webhookRequest());

  assert.equal(response.status, 502);
  assert.equal(calls.at(-1)?.functionName, "fail_admin_email_delivery");
  assert.equal(calls.at(-1)?.params.p_error, "Resend returned HTTP 503.");
});

Deno.test("signup completion failure returns non-2xx after a successful send", async () => {
  const calls: RpcCall[] = [];
  const response = await createSignupNotificationHandler(
    baseDependencies(calls, {
      deliveryClient: deliveryClient(calls, { completeError: true }),
    }),
  )(webhookRequest());

  assert.equal(response.status, 500);
  assert.equal(calls.at(-1)?.functionName, "complete_admin_email_delivery");
  assert.equal(
    calls.some((call) => call.functionName === "fail_admin_email_delivery"),
    false,
  );
});
