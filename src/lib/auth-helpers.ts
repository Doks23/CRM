import { auth } from "@/auth";

export type Role = "owner" | "sales" | "production";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError("not signed in");
  if (!session.user.active) throw new UnauthorizedError("account deactivated");
  return session;
}

export async function requireRole(...allowed: Role[]) {
  const session = await requireSession();
  if (!allowed.includes(session.user.role)) {
    throw new ForbiddenError(`role ${session.user.role} not permitted`);
  }
  return session;
}

export const requireOwner = () => requireRole("owner");

export class UnauthorizedError extends Error {
  status = 401;
}
export class ForbiddenError extends Error {
  status = 403;
}
