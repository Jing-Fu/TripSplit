/** @type {import('next').NextConfig} */
const nextConfig = {
  // Accept webhook URLs with or without a trailing slash without issuing a 308.
  skipTrailingSlashRedirect: true,
};

module.exports = nextConfig;
