/** @type {import('next').NextConfig} */
function toRemotePattern(rawUrl) {
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    return {
      protocol: url.protocol.replace(":", ""),
      hostname: url.hostname,
      port: url.port || "",
      pathname: "/**",
    };
  } catch {
    return null;
  }
}

const storageRemotePatterns = [
  toRemotePattern(process.env.SUPABASE_URL),
  toRemotePattern(process.env.NEXT_PUBLIC_SUPABASE_URL),
].filter(Boolean);

const nextConfig = {
  // Accept webhook URLs with or without a trailing slash without issuing a 308.
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: storageRemotePatterns,
  },
};

module.exports = nextConfig;
