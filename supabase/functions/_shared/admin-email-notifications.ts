const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface InsertWebhookIdentity {
  sourceId: string;
}

export function parseInsertWebhook(
  body: unknown,
  expectedSchema: string,
  expectedTable: string,
): InsertWebhookIdentity {
  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid webhook payload.");
  }

  const event = body as Record<string, unknown>;
  if (
    event.type !== "INSERT" ||
    event.schema !== expectedSchema ||
    event.table !== expectedTable
  ) {
    throw new Error("Unexpected webhook event.");
  }

  if (typeof event.record !== "object" || event.record === null) {
    throw new Error("Webhook record is required.");
  }

  const sourceId = (event.record as Record<string, unknown>).id;
  if (typeof sourceId !== "string" || !UUID_PATTERN.test(sourceId)) {
    throw new Error("Webhook record ID must be a UUID.");
  }

  return { sourceId };
}

export function isAuthorizedWebhookRequest(
  req: Request,
  webhookSecret: string,
): boolean {
  if (webhookSecret.trim().length === 0) {
    return false;
  }

  return req.headers.get("Authorization") === `Bearer ${webhookSecret}`;
}

export interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

export interface SignupEmailInput {
  fromEmail: string;
  adminEmail: string;
  displayName: string | null;
  email: string;
  createdAt: string;
}

export type FeedbackType = "bug" | "feature" | "other";

export interface FeedbackEmailInput {
  fromEmail: string;
  adminEmail: string;
  displayName: string | null;
  email: string;
  feedbackType: FeedbackType;
  message: string;
  submittedAt: string;
}

const FEEDBACK_LABELS: Record<FeedbackType, string> = {
  bug: "🐛 Bug Report",
  feature: "💡 Feature Request",
  other: "💬 Feedback",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function senderName(displayName: string | null, email: string): string {
  return displayName?.trim() || email;
}

function sanitizeSubjectComponent(value: string): string {
  return value.replace(/\p{Cc}+/gu, " ").trim();
}

function subjectSenderName(displayName: string | null, email: string): string {
  const sanitizedDisplayName = sanitizeSubjectComponent(displayName ?? "");
  return sanitizedDisplayName || sanitizeSubjectComponent(email);
}

export function buildSignupEmail(
  input: SignupEmailInput,
): ResendEmailPayload {
  const name = senderName(input.displayName, input.email);
  const subjectName = subjectSenderName(input.displayName, input.email);

  return {
    from: input.fromEmail,
    to: [input.adminEmail],
    subject: `New Logbook Companion signup: ${subjectName}`,
    html: `
      <div>
        <h2>New Logbook Companion Signup</h2>
        <dl>
          <dt>Name</dt><dd>${escapeHtml(name)}</dd>
          <dt>Email</dt><dd>${escapeHtml(input.email)}</dd>
          <dt>Created</dt><dd>${escapeHtml(input.createdAt)}</dd>
        </dl>
      </div>
    `,
  };
}

export function buildFeedbackEmail(
  input: FeedbackEmailInput,
): ResendEmailPayload {
  const name = senderName(input.displayName, input.email);
  const subjectName = subjectSenderName(input.displayName, input.email);
  const typeLabel = FEEDBACK_LABELS[input.feedbackType];

  return {
    from: input.fromEmail,
    to: [input.adminEmail],
    subject: `${typeLabel} from ${subjectName}`,
    html: `
      <div>
        <h2>${typeLabel}</h2>
        <dl>
          <dt>From</dt><dd>${escapeHtml(name)}</dd>
          <dt>Email</dt><dd>${escapeHtml(input.email)}</dd>
          <dt>Submitted</dt><dd>${escapeHtml(input.submittedAt)}</dd>
          <dt>Type</dt><dd>${escapeHtml(input.feedbackType)}</dd>
        </dl>
        <p style="white-space: pre-wrap;">${escapeHtml(input.message)}</p>
        <p><a href="https://log.readyall.org/feedback">Review feedback</a></p>
      </div>
    `,
  };
}
