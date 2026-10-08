// Vercel serverless entry. The Express app is bundled at build time into server-dist/app.mjs
// (see "build:vercel" in package.json); this shim only loads it lazily on first request.
let appPromise;

export default async function handler(req, res) {
  appPromise ??= import("../server-dist/app.mjs").then((module) => module.default);
  const app = await appPromise;
  return app(req, res);
}
