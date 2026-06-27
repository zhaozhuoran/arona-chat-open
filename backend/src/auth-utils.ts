import type { AppContext } from "./backend-utils";
import { createClerkClient, verifyToken, type ClerkClient } from "@clerk/backend";

let clerkClient: ClerkClient | null = null;

const getClerkClient = (secretKey: string): ClerkClient => {
  if (!clerkClient) {
    clerkClient = createClerkClient({ secretKey });
  }
  return clerkClient;
};

export const getAdminEmails = (env: { USERS_ADMIN_EMAILS?: string }): string[] => {
  const raw = env.USERS_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

export const isAdminEmail = (email: string, adminEmails: string[]): boolean => {
  const normalizedEmail = email.toLowerCase();
  return adminEmails.some((admin) => admin.toLowerCase() === normalizedEmail);
};

export const verifyClerkToken = async (c: AppContext, token: string) => {
  const clerkSecretKey = c.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    throw new Error("CLERK_SECRET_KEY is not configured.");
  }

  try {
    const sessionClaims = await verifyToken(token, {
      secretKey: clerkSecretKey,
    });
    return sessionClaims;
  } catch (error) {
    console.error("Clerk token verification failed", error);
    return null;
  }
};

export const getClerkUserEmail = async (c: AppContext, userId: string): Promise<string | null> => {
  const clerkSecretKey = c.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    throw new Error("CLERK_SECRET_KEY is not configured.");
  }

  const clerk = getClerkClient(clerkSecretKey);
  try {
    const user = await clerk.users.getUser(userId);
    const primaryEmailId = user.primaryEmailAddressId;
    const emailAddress = user.emailAddresses.find((e) => e.id === primaryEmailId);
    return emailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
  } catch (error) {
    console.error("Failed to fetch Clerk user details", error);
    return null;
  }
};
