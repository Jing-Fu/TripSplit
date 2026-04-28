import "server-only";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client();

export type VerifiedGoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export async function verifyGoogleCredential(
  credential: string
): Promise<VerifiedGoogleProfile> {
  const audience =
    process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!audience) {
    throw new Error("GOOGLE_CLIENT_ID_MISSING");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience,
  });

  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email) {
    throw new Error("GOOGLE_PROFILE_INCOMPLETE");
  }

  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    emailVerified: payload.email_verified ?? false,
    name: typeof payload.name === "string" ? payload.name.trim() || null : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}
