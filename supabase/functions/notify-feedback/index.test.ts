import { strict as assert } from "node:assert";
import type { AdminEmailDeliveryClient } from "../_shared/admin-email-delivery.ts";
import {
  createFeedbackNotificationHandler,
  type FeedbackHandlerDependencies,
} from "./index.ts";

const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const WEBHOOK_SECRET = "test-webhook-secret";
const SERVICE_KEY = "test-service-role";
const CLAIM_TOKEN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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
            event_type: "user_feedback",
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
  overrides: Partial<FeedbackHandlerDependencies> = {},
): FeedbackHandlerDependencies {
  return {
    webhookSecret: WEBHOOK_SECRET,
    serviceRoleKey: SERVICE_KEY,
    resendApiKey: "test-resend-key",
    deliveryClient: deliveryClient(calls),
    loadFeedback: () =>
      Promise.resolve({
        id: SOURCE_ID,
        user_id: USER_ID,
        feedback_type: "bug",
        message: "Canonical <feedback> body",
        created_at: "2026-09-15T13:00:00.000Z",
      }),
    loadUser: () =>
      Promise.resolve({ id: USER_ID, email: "canonical@example.test" }),
    loadProfile: () => Promise.resolve({ display_name: "Canonical <Sender>" }),
    fetcher: () => Promise.resolve(new Response("{}", { status: 200 })),
    ...overrides,
  };
}

function webhookRequest(
  body: unknown = {
    type: "INSERT",
    schema: "public",
    table: "user_feedback",
    record: {
      id: SOURCE_ID,
      message: "forged body",
      feedback_type: "feature",
      user_id: SOURCE_ID,
    },
  },
  authorization = `Bearer ${WEBHOOK_SECRET}`,
): Request {
  return new Request("https://example.test/notify-feedback", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

Deno.test("feedback handler rejects non-webhook-secret bearer auth before claiming", async () => {
  const calls: RpcCall[] = [];
  const response = await createFeedbackNotificationHandler(
    baseDependencies(calls),
  )(
    webhookRequest(undefined, `Bearer ${SERVICE_KEY}`),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(calls, []);
});

Deno.test("feedback handler rejects malformed and wrong webhook identities", async () => {
  for (
    const body of [
      {
        type: "UPDATE",
        schema: "public",
        table: "user_feedback",
        record: { id: SOURCE_ID },
      },
      {
        type: "INSERT",
        schema: "auth",
        table: "user_feedback",
        record: { id: SOURCE_ID },
      },
      {
        type: "INSERT",
        schema: "public",
        table: "feedback",
        record: { id: SOURCE_ID },
      },
      {
        type: "INSERT",
        schema: "public",
        table: "user_feedback",
        record: null,
      },
    ]
  ) {
    const calls: RpcCall[] = [];
    const response = await createFeedbackNotificationHandler(
      baseDependencies(calls),
    )(
      webhookRequest(body),
    );
    assert.equal(response.status, 400);
    assert.deepEqual(calls, []);
  }
});

Deno.test("feedback handler skips a valid duplicate claim without canonical reads or send", async () => {
  const calls: RpcCall[] = [];
  let read = false;
  let sent = false;
  const handler = createFeedbackNotificationHandler(baseDependencies(calls, {
    deliveryClient: deliveryClient(calls, { duplicate: true }),
    loadFeedback: () => {
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

Deno.test("feedback handler uses canonical data, configured addresses, idempotency header, and completes", async () => {
  const calls: RpcCall[] = [];
  let requestInit: RequestInit | undefined;
  const response = await createFeedbackNotificationHandler(
    baseDependencies(calls, {
      adminEmail: "admin@example.test",
      fromEmail: "from@example.test",
      fetcher: (_input, init) => {
        requestInit = init;
        return Promise.resolve(new Response("{}", { status: 201 }));
      },
    }),
  )(webhookRequest());

  assert.equal(response.status, 200);
  const headers = new Headers(requestInit?.headers);
  assert.equal(
    headers.get("Idempotency-Key"),
    `admin-email:user_feedback:${SOURCE_ID}`,
  );
  const payload = JSON.parse(String(requestInit?.body));
  assert.deepEqual(payload.to, ["admin@example.test"]);
  assert.equal(payload.from, "from@example.test");
  assert.equal(payload.subject.startsWith("🐛 Bug Report"), true);
  assert.equal(payload.html.includes("Canonical &lt;feedback&gt; body"), true);
  assert.equal(payload.html.includes("Canonical &lt;Sender&gt;"), true);
  assert.equal(payload.html.includes("forged body"), false);
  assert.equal(calls.at(-1)?.functionName, "complete_admin_email_delivery");
  assert.equal(calls.at(-1)?.params.p_claim_token, CLAIM_TOKEN);
});

Deno.test("feedback recipient and sender use required fallbacks", async () => {
  const calls: RpcCall[] = [];
  let payload: Record<string, unknown> = {};
  await createFeedbackNotificationHandler(baseDependencies(calls, {
    fetcher: (_input, init) => {
      payload = JSON.parse(String(init?.body));
      return Promise.resolve(new Response("{}", { status: 200 }));
    },
  }))(webhookRequest());

  assert.deepEqual(payload.to, ["samdgammon@gmail.com"]);
  assert.equal(payload.from, "notifications@mail.readyall.org");
});

Deno.test("feedback canonical lookup failure is persisted and returns non-2xx", async () => {
  const calls: RpcCall[] = [];
  const response = await createFeedbackNotificationHandler(
    baseDependencies(calls, {
      loadFeedback: () => Promise.reject(new Error("Feedback lookup failed")),
    }),
  )(webhookRequest());

  assert.equal(response.status, 500);
  assert.equal(calls.at(-1)?.functionName, "fail_admin_email_delivery");
  assert.equal(calls.at(-1)?.params.p_claim_token, CLAIM_TOKEN);
  assert.equal(calls.at(-1)?.params.p_error, "Feedback lookup failed");
});

Deno.test("missing canonical feedback is marked failed and returns 404", async () => {
  const calls: RpcCall[] = [];
  const response = await createFeedbackNotificationHandler(
    baseDependencies(calls, {
      loadFeedback: () => Promise.resolve(null),
    }),
  )(webhookRequest());

  assert.equal(response.status, 404);
  assert.equal(calls.at(-1)?.functionName, "fail_admin_email_delivery");
});

Deno.test("feedback Resend failure is persisted and returns 502", async () => {
  const calls: RpcCall[] = [];
  const response = await createFeedbackNotificationHandler(
    baseDependencies(calls, {
      fetcher: () =>
        Promise.resolve(new Response("provider details", { status: 500 })),
    }),
  )(webhookRequest());

  assert.equal(response.status, 502);
  assert.equal(calls.at(-1)?.functionName, "fail_admin_email_delivery");
  assert.equal(calls.at(-1)?.params.p_error, "Resend returned HTTP 500.");
});

Deno.test("feedback completion failure returns non-2xx after a successful send", async () => {
  const calls: RpcCall[] = [];
  const response = await createFeedbackNotificationHandler(
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
