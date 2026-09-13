import bcrypt from "bcryptjs";

const ROUNDS = 12;

/** A valid bcrypt hash of a value nobody knows, used to equalise timing. */
const DUMMY_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.VYtBL4x7oaWtJYqQ1IuTlNrYJ6rPm7u";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

/**
 * Compares a password against a stored hash. A `null` hash (no password set
 * yet, e.g. a pending invite) still runs a comparison against a dummy hash so
 * that callers cannot distinguish "no such account" from "wrong password" by
 * response time.
 */
export async function verifyPassword(
  password: string,
  hash: string | null,
): Promise<boolean> {
  const result = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return hash !== null && result;
}

/**
 * Minimum password policy for backoffice and agency accounts. Returned as a
 * list of human-readable problems so the UI can show all of them at once.
 */
export function validatePassword(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 10) {
    problems.push("Password must be at least 10 characters long.");
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    problems.push("Password must contain both lower and upper case letters.");
  }
  if (!/[0-9]/.test(password)) {
    problems.push("Password must contain at least one number.");
  }
  return problems;
}
