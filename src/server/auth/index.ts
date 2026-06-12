import NextAuth from "next-auth";
import { cache } from "react";

import { authConfig } from "./config";

const { auth: uncachedAuth, handlers, signIn, signOut } = NextAuth(authConfig);

const auth = cache(uncachedAuth);

export { auth, handlers, signIn, signOut };

export {
  createServerSupabaseClient,
  createRouteHandlerSupabaseClient,
  createServerSupabaseClientFromRequest,
  createServiceRoleSupabaseClient,
  getAuthenticatedUser,
  getAuthenticatedUserFromRequest,
  type AuthenticatedUser,
  type ServerSupabaseClient,
} from "./supabase-server";

export {
  requireAuthUser,
  requireAuthUserFromRequest,
  getOptionalAuthUserFromRequest,
  verifyReviewPollingToken,
  verifyOpenClawValidationStatusToken,
  unauthorizedResponse,
  forbiddenResponse,
  authErrorToResponse,
  assertUserMatch,
  assertOwnership,
  AuthError,
  type AuthUser,
} from "./require-auth";

export {
  signTrackerToken,
  verifyTrackerToken,
  extractBearerToken,
  TRACKER_TOKEN_VERSION,
  TRACKER_TOKEN_PREFIX,
  TRACKER_TOKEN_DEFAULT_TTL_SECONDS,
  TrackerTokenError,
  type TrackerTokenPayload,
  type VerifiedTrackerToken,
  type SignTrackerTokenOptions,
} from "./tracker-token";
