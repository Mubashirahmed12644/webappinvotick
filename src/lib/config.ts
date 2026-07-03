export const config = {
  backendUrl: (process.env.BACKEND_URL ?? "http://localhost:8085").replace(/\/$/, ""),
  mockMode: process.env.MOCK_MODE === "true",
  authCookie: process.env.AUTH_COOKIE ?? "invotick_session",

  // Test lockdown: while true, only ALLOWED_EMAILS may log in and signup is disabled.
  // Flip to false to open the app to all users after test cases are verified.
  testMode: process.env.TEST_MODE === "true",
  allowedEmails: (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
} as const;

export function isEmailAllowed(email: string): boolean {
  if (!config.testMode) return true;
  return config.allowedEmails.includes(email.trim().toLowerCase());
}
