export type AdminEmailEventType = "user_signup" | "user_feedback";

export interface AdminEmailDeliveryRpcError {
  message: string;
}

export interface AdminEmailDeliveryRpcResult {
  data: unknown;
  error: AdminEmailDeliveryRpcError | null;
}

export interface AdminEmailDeliveryClient {
  rpc(
    functionName: string,
    params: Record<string, unknown>,
  ): PromiseLike<AdminEmailDeliveryRpcResult>;
}

function throwRpcError(error: AdminEmailDeliveryRpcError | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

function isValidClaimRow(
  value: unknown,
  eventType: AdminEmailEventType,
  sourceId: string,
): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;
  return row.event_type === eventType &&
    row.source_id === sourceId &&
    row.status === "processing" &&
    typeof row.claim_token === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(row.claim_token) &&
    typeof row.attempt_count === "number" &&
    Number.isInteger(row.attempt_count) &&
    row.attempt_count > 0;
}

export async function claimDelivery(
  client: AdminEmailDeliveryClient,
  eventType: AdminEmailEventType,
  sourceId: string,
): Promise<string | null> {
  const { data, error } = await client.rpc("claim_admin_email_delivery", {
    p_event_type: eventType,
    p_source_id: sourceId,
  });
  throwRpcError(error);

  if (!Array.isArray(data)) {
    throw new Error("Invalid claim_admin_email_delivery response.");
  }
  if (data.length === 0) {
    return null;
  }
  if (
    data.length !== 1 ||
    !isValidClaimRow(data[0], eventType, sourceId)
  ) {
    throw new Error("Invalid claim_admin_email_delivery response.");
  }

  return (data[0] as Record<string, unknown>).claim_token as string;
}

export async function completeDelivery(
  client: AdminEmailDeliveryClient,
  eventType: AdminEmailEventType,
  sourceId: string,
  claimToken: string,
): Promise<void> {
  const { error } = await client.rpc("complete_admin_email_delivery", {
    p_event_type: eventType,
    p_source_id: sourceId,
    p_claim_token: claimToken,
  });
  throwRpcError(error);
}

export async function failDelivery(
  client: AdminEmailDeliveryClient,
  eventType: AdminEmailEventType,
  sourceId: string,
  claimToken: string,
  errorMessage: string,
): Promise<void> {
  const persistedError = Array.from(errorMessage).slice(0, 1000).join("");
  const { error } = await client.rpc("fail_admin_email_delivery", {
    p_event_type: eventType,
    p_source_id: sourceId,
    p_claim_token: claimToken,
    p_error: persistedError,
  });
  throwRpcError(error);
}
