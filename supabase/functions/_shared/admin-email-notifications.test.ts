import { strict as assert } from "node:assert";
import {
  claimDelivery,
  completeDelivery,
  failDelivery,
} from "./admin-email-delivery.ts";
import {
  buildFeedbackEmail,
  buildSignupEmail,
  isAuthorizedWebhookRequest,
  parseInsertWebhook,
} from "./admin-email-notifications.ts";

const VALID_ID = "11111111-1111-4111-8111-111111111111";
const CLAIM_TOKEN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

Deno.test("parseInsertWebhook accepts only the expected insert event", () => {
  const result = parseInsertWebhook(
    {
      type: "INSERT",
      schema: "auth",
      table: "users",
      record: { id: VALID_ID },
    },
    "auth",
    "users",
  );

  assert.equal(result.sourceId, VALID_ID);
});

for (
  const [name, body] of [
    ["wrong event type", {
      type: "UPDATE",
      schema: "auth",
      table: "users",
      record: { id: VALID_ID },
    }],
    ["wrong schema", {
      type: "INSERT",
      schema: "public",
      table: "users",
      record: { id: VALID_ID },
    }],
    ["wrong table", {
      type: "INSERT",
      schema: "auth",
      table: "profiles",
      record: { id: VALID_ID },
    }],
    ["missing record", {
      type: "INSERT",
      schema: "auth",
      table: "users",
    }],
    ["invalid UUID", {
      type: "INSERT",
      schema: "auth",
      table: "users",
      record: { id: "not-a-uuid" },
    }],
  ] as const
) {
  Deno.test(`parseInsertWebhook rejects ${name}`, () => {
    assert.throws(() => parseInsertWebhook(body, "auth", "users"), Error);
  });
}

Deno.test("isAuthorizedWebhookRequest requires the exact webhook-secret bearer value", () => {
  const secret = "webhook-secret";

  assert.equal(
    isAuthorizedWebhookRequest(
      new Request("https://example.test", {
        headers: { Authorization: `Bearer ${secret}` },
      }),
      secret,
    ),
    true,
  );

  for (
    const authorization of [
      null,
      secret,
      `Bearer user-jwt`,
      `Bearer service-role-key`,
      `bearer ${secret}`,
      `Bearer  ${secret}`,
    ]
  ) {
    const headers = authorization === null
      ? undefined
      : { Authorization: authorization };
    assert.equal(
      isAuthorizedWebhookRequest(
        new Request("https://example.test", { headers }),
        secret,
      ),
      false,
    );
  }
});

Deno.test("isAuthorizedWebhookRequest fails closed for a blank webhook secret", () => {
  for (const secret of ["", " \t "]) {
    const req = {
      headers: { get: () => `Bearer ${secret}` },
    } as unknown as Request;

    assert.equal(isAuthorizedWebhookRequest(req, secret), false);
  }
});

const HTML_ATTACK = `<script>alert("x")</script> & "quoted" 'apostrophe'`;
const ESCAPED_HTML_ATTACK =
  `&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;quoted&quot; &#39;apostrophe&#39;`;

Deno.test("buildSignupEmail uses display name and configured addresses", () => {
  const payload = buildSignupEmail({
    fromEmail: "configured-from@example.test",
    adminEmail: "configured-admin@example.test",
    displayName: "Ada Lovelace",
    email: "ada@example.test",
    createdAt: "2026-09-15T12:34:56.000Z",
  });

  assert.equal(payload.from, "configured-from@example.test");
  assert.deepEqual(payload.to, ["configured-admin@example.test"]);
  assert.equal(payload.subject, "New Logbook Companion signup: Ada Lovelace");
});

Deno.test("buildSignupEmail falls back to email in the subject", () => {
  const payload = buildSignupEmail({
    fromEmail: "from@example.test",
    adminEmail: "admin@example.test",
    displayName: null,
    email: "fallback@example.test",
    createdAt: "2026-09-15T12:34:56.000Z",
  });

  assert.equal(
    payload.subject,
    "New Logbook Companion signup: fallback@example.test",
  );
});

Deno.test("buildSignupEmail removes subject controls while preserving useful text", () => {
  const payload = buildSignupEmail({
    fromEmail: "from@example.test",
    adminEmail: "admin@example.test",
    displayName: "Ada\r\n\0\u0007Lovelace\u007f",
    email: "ada@example.test",
    createdAt: "2026-09-15T12:34:56.000Z",
  });

  assert.equal(/\p{Cc}/u.test(payload.subject), false);
  assert.equal(payload.subject.includes("Ada"), true);
  assert.equal(payload.subject.includes("Lovelace"), true);
});

Deno.test("buildSignupEmail escapes every user-controlled HTML field", () => {
  const payload = buildSignupEmail({
    fromEmail: "from@example.test",
    adminEmail: "admin@example.test",
    displayName: HTML_ATTACK,
    email: HTML_ATTACK,
    createdAt: "2026-09-15T12:34:56.000Z",
  });

  assert.equal(payload.html.includes(HTML_ATTACK), false);
  assert.equal(payload.html.split(ESCAPED_HTML_ATTACK).length - 1, 2);
});

for (
  const [feedbackType, label] of [
    ["bug", "🐛 Bug Report"],
    ["feature", "💡 Feature Request"],
    ["other", "💬 Feedback"],
  ] as const
) {
  Deno.test(`buildFeedbackEmail maps ${feedbackType} subjects consistently`, () => {
    const payload = buildFeedbackEmail({
      fromEmail: "from@example.test",
      adminEmail: "admin@example.test",
      displayName: "Grace Hopper",
      email: "grace@example.test",
      feedbackType,
      message: "Details",
      submittedAt: "2026-09-15T12:34:56.000Z",
    });

    assert.equal(payload.subject, `${label} from Grace Hopper`);
  });
}

Deno.test("buildFeedbackEmail removes subject controls while preserving useful text", () => {
  const payload = buildFeedbackEmail({
    fromEmail: "from@example.test",
    adminEmail: "admin@example.test",
    displayName: null,
    email: "grace\r\n\0\u001fhopper@example.test\u0085",
    feedbackType: "bug",
    message: "Details",
    submittedAt: "2026-09-15T12:34:56.000Z",
  });

  assert.equal(/\p{Cc}/u.test(payload.subject), false);
  assert.equal(payload.subject.includes("grace"), true);
  assert.equal(payload.subject.includes("hopper@example.test"), true);
});

Deno.test("buildFeedbackEmail renders escaped canonical data and admin route", () => {
  const submittedAt = "2026-09-15T12:34:56.000Z";
  const payload = buildFeedbackEmail({
    fromEmail: "configured-from@example.test",
    adminEmail: "configured-admin@example.test",
    displayName: HTML_ATTACK,
    email: HTML_ATTACK,
    feedbackType: "other",
    message: HTML_ATTACK,
    submittedAt,
  });

  assert.equal(payload.from, "configured-from@example.test");
  assert.deepEqual(payload.to, ["configured-admin@example.test"]);
  assert.equal(payload.html.includes(HTML_ATTACK), false);
  assert.equal(payload.html.split(ESCAPED_HTML_ATTACK).length - 1, 3);
  assert.equal(payload.html.includes(submittedAt), true);
  assert.equal(
    payload.html.includes('href="https://log.readyall.org/feedback"'),
    true,
  );
});

type RpcCall = {
  functionName: string;
  params: Record<string, unknown>;
};

function rpcClient(
  response: { data: unknown; error: { message: string } | null },
  calls: RpcCall[],
) {
  return {
    rpc(functionName: string, params: Record<string, unknown>) {
      calls.push({ functionName, params });
      return Promise.resolve(response);
    },
  };
}

Deno.test("claimDelivery calls the claim RPC and reports whether a row was claimed", async () => {
  const claimedCalls: RpcCall[] = [];
  const claimed = await claimDelivery(
    rpcClient({
      data: [{
        event_type: "user_signup",
        source_id: VALID_ID,
        status: "processing",
        claim_token: CLAIM_TOKEN,
        attempt_count: 1,
      }],
      error: null,
    }, claimedCalls),
    "user_signup",
    VALID_ID,
  );

  assert.equal(claimed, CLAIM_TOKEN);
  assert.deepEqual(claimedCalls, [{
    functionName: "claim_admin_email_delivery",
    params: { p_event_type: "user_signup", p_source_id: VALID_ID },
  }]);

  const skipped = await claimDelivery(
    rpcClient({ data: [], error: null }, []),
    "user_signup",
    VALID_ID,
  );
  assert.equal(skipped, null);
});

for (
  const [name, data] of [
    ["null", null],
    ["a non-array", {}],
    ["a null row", [null]],
    ["an empty object row", [{}]],
    ["multiple rows", [
      {
        event_type: "user_signup",
        source_id: VALID_ID,
        status: "processing",
        claim_token: CLAIM_TOKEN,
        attempt_count: 1,
      },
      {
        event_type: "user_signup",
        source_id: VALID_ID,
        status: "processing",
        claim_token: CLAIM_TOKEN,
        attempt_count: 2,
      },
    ]],
    ["a mismatched event type", [{
      event_type: "user_feedback",
      source_id: VALID_ID,
      status: "processing",
      claim_token: CLAIM_TOKEN,
      attempt_count: 1,
    }]],
    ["a mismatched source ID", [{
      event_type: "user_signup",
      source_id: "22222222-2222-4222-8222-222222222222",
      status: "processing",
      claim_token: CLAIM_TOKEN,
      attempt_count: 1,
    }]],
    ["a non-processing status", [{
      event_type: "user_signup",
      source_id: VALID_ID,
      status: "sent",
      attempt_count: 1,
    }]],
    ["a missing claim token", [{
      event_type: "user_signup",
      source_id: VALID_ID,
      status: "processing",
      attempt_count: 1,
    }]],
    ["a non-positive attempt count", [{
      event_type: "user_signup",
      source_id: VALID_ID,
      status: "processing",
      claim_token: CLAIM_TOKEN,
      attempt_count: 0,
    }]],
  ] as const
) {
  Deno.test(`claimDelivery rejects ${name}`, async () => {
    await assert.rejects(
      () =>
        claimDelivery(
          rpcClient({ data, error: null }, []),
          "user_signup",
          VALID_ID,
        ),
      Error,
      "Invalid claim_admin_email_delivery response.",
    );
  });
}

Deno.test("claimDelivery converts RPC errors into Error objects", async () => {
  await assert.rejects(
    () =>
      claimDelivery(
        rpcClient({ data: null, error: { message: "claim failed" } }, []),
        "user_feedback",
        VALID_ID,
      ),
    Error,
    "claim failed",
  );
});

Deno.test("completeDelivery calls the completion RPC and converts errors", async () => {
  const calls: RpcCall[] = [];
  await completeDelivery(
    rpcClient({ data: null, error: null }, calls),
    "user_feedback",
    VALID_ID,
    CLAIM_TOKEN,
  );
  assert.deepEqual(calls, [{
    functionName: "complete_admin_email_delivery",
    params: {
      p_event_type: "user_feedback",
      p_source_id: VALID_ID,
      p_claim_token: CLAIM_TOKEN,
    },
  }]);

  await assert.rejects(
    () =>
      completeDelivery(
        rpcClient({ data: null, error: { message: "complete failed" } }, []),
        "user_feedback",
        VALID_ID,
        CLAIM_TOKEN,
      ),
    Error,
    "complete failed",
  );
});

Deno.test("failDelivery truncates errors and converts RPC errors", async () => {
  const calls: RpcCall[] = [];
  await failDelivery(
    rpcClient({ data: null, error: null }, calls),
    "user_signup",
    VALID_ID,
    CLAIM_TOKEN,
    "x".repeat(1001),
  );
  assert.deepEqual(calls, [{
    functionName: "fail_admin_email_delivery",
    params: {
      p_event_type: "user_signup",
      p_source_id: VALID_ID,
      p_claim_token: CLAIM_TOKEN,
      p_error: "x".repeat(1000),
    },
  }]);

  await assert.rejects(
    () =>
      failDelivery(
        rpcClient(
          { data: null, error: { message: "failure update failed" } },
          [],
        ),
        "user_signup",
        VALID_ID,
        CLAIM_TOKEN,
        "resend failed",
      ),
    Error,
    "failure update failed",
  );
});
