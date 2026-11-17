/**
 * The newer link a retired share link points to, read from the backend's 410 answer.
 *
 * A sender who edits a document after sending it and sends again retires the old link on purpose
 * (decision 0046). The backend then answers the old token with 410 and `code: "SHARE_REPLACED"` and the
 * newer token in `replacedByToken`. Anything else — an older backend that sends neither, a body that is
 * not JSON, a token that is not shaped like ours — is "no pointer", and the page says what it always
 * said. The token is checked here, once, because it ends up inside an `href`.
 */
const TOKEN_SHAPE = /^[a-z2-9]{16}$/;

export function replacedByTokenFrom(body: unknown, requestedToken: string): string | null {
  if (typeof body !== "object" || body === null) return null;
  const { code, replacedByToken } = body as { code?: unknown; replacedByToken?: unknown };
  if (code !== "SHARE_REPLACED" || typeof replacedByToken !== "string") return null;
  if (!TOKEN_SHAPE.test(replacedByToken) || replacedByToken === requestedToken) return null;
  return replacedByToken;
}
