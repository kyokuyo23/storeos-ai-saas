import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerOwnerLoginRoutes } from "./ownerLogin";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { handleAutomatedMonthlyReport, handleVercelCronMonthlyReport } from "../automatedMonthlyReports";
import { canAccessMonthlyReportArtifacts, readVerifiedMonthlyReportArtifact, type ArtifactKind } from "../monthlyReportArtifacts";
import { sdk } from "./sdk";
import { ENV } from "./env";
import { getShiftCheckPhoto } from "../shiftChecks";
import { getBranding, getStoreLogo } from "../branding";
import { canManageStore } from "../userAccounts";

/** Builds the API-only Express app (no listen, no static/Vite). Shared by the Node server and Vercel. */
export function createApp() {
  const app = express();
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerOwnerLoginRoutes(app);
  app.post("/api/scheduled/monthly-management-report", handleAutomatedMonthlyReport);
  app.get("/api/scheduled/monthly-management-report", handleVercelCronMonthlyReport);
  // Store name + logo are public so the login page can show them before sign-in.
  app.get("/api/branding", async (_req, res) => {
    try { res.setHeader("Cache-Control", "no-cache"); res.json(await getBranding()); }
    catch { res.status(503).json({ error: "Branding tidak tersedia." }); }
  });
  app.get("/api/branding/logo", async (req, res) => {
    try {
      const logo = await getStoreLogo();
      if (!logo) { res.status(404).send("No logo"); return; }
      res.setHeader("Content-Type", logo.contentType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      // Versioned URLs (?v=updatedAt) are immutable; the bare URL revalidates.
      res.setHeader("Cache-Control", req.query.v ? "public, max-age=31536000, immutable" : "no-cache");
      res.send(Buffer.from(logo.data));
    } catch (error) {
      console.error("[Branding] logo failed", error);
      res.status(503).send("Logo temporarily unavailable");
    }
  });

  // Phase 2.24 shift-check photo evidence: owner/sysadmin or the cashier who submitted it.
  app.get("/api/shift-checks/photos/:photoId", async (req, res) => {
    const photoId = Number(req.params.photoId);
    if (!Number.isInteger(photoId) || photoId <= 0) { res.status(400).send("Invalid photo"); return; }
    let user: Awaited<ReturnType<typeof sdk.authenticateRequest>> | null = null;
    try { user = await sdk.authenticateRequest(req); } catch { user = null; }
    if (!user) { res.status(401).send("Authentication required"); return; }
    try {
      const photo = await getShiftCheckPhoto(photoId);
      if (!photo) { res.status(404).send("Not found"); return; }
      if (photo.submittedByUserId !== user.id && !canManageStore(user, ENV.ownerOpenId)) { res.status(403).send("Forbidden"); return; }
      res.setHeader("Content-Type", photo.contentType);
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(Buffer.from(photo.data));
    } catch (error) {
      console.error("[ShiftCheckPhoto] failed", error);
      res.status(503).send("Photo temporarily unavailable");
    }
  });
  app.get("/api/reports/monthly-artifacts/:year/:month/:kind", async (req, res) => {
    const year = Number(req.params.year);
    const month = Number(req.params.month);
    const kind = req.params.kind as ArtifactKind;
    if (!Number.isInteger(year) || !Number.isInteger(month) || !["csv", "html", "pdf"].includes(kind)) {
      res.status(400).send("Invalid artifact request");
      return;
    }
    try {
      let user: Awaited<ReturnType<typeof sdk.authenticateRequest>> | null = null;
      try { user = await sdk.authenticateRequest(req); } catch { user = null; }
      if (!user) {
        res.status(401).send("Authentication required");
        return;
      }
      if (!canAccessMonthlyReportArtifacts(user)) {
        res.status(403).send("Artifact access denied");
        return;
      }
      const result = await readVerifiedMonthlyReportArtifact(year, month, kind, user.openId);
      if (!result) {
        res.status(404).send("Stored artifact not found");
        return;
      }
      if (!result.data || result.availability.status !== "available") {
        res.status(409).json({ error: "Artifact integrity validation failed", status: result.availability.status });
        return;
      }
      const extension = kind === "html" ? "html" : kind;
      const contentType = kind === "csv" ? "text/csv; charset=utf-8" : kind === "pdf" ? "application/pdf" : "text/html; charset=utf-8";
      res.set({
        "Content-Type": contentType,
        "Content-Length": String(result.data.byteLength),
        "Content-Disposition": `attachment; filename="StoreOS_Monthly_Report_${year}-${String(month).padStart(2, "0")}.${extension}"`,
        "Cache-Control": "no-store",
      });
      res.status(200).send(result.data);
    } catch (error) {
      console.error("[MonthlyReportArtifactDownload]", error);
      res.status(502).send("Artifact retrieval failed");
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  return app;
}
