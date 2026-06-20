export const MUST_CHANGE_PASSWORD_METADATA_KEY = "must_change_password";

export function userMustChangePassword(
  metadata: Record<string, unknown> | null | undefined
): boolean {
  return metadata?.[MUST_CHANGE_PASSWORD_METADATA_KEY] === true;
}

export const MIN_PASSWORD_LENGTH = 8;
