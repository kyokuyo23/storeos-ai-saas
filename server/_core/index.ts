import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleAutomatedMonthlyReport } from "../automatedMonthlyReports";
import { canAccessMonthlyReportArtifacts, readVerifiedMonthlyReportArtifact, type ArtifactKind } from "../monthlyReportArtifacts";
import { sdk } from "./sdk";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/scheduled/monthly-management-report", handleAutomatedMonthlyReport);
  app.get("/api/reports/monthly-artifacts/:year/:month/:kind", async (req, res) => {
    const year = Number(req.params.year);
    const month = Number(req.params.month);
    const kind = req.params.kind as ArtifactKind;
    if (!Number.isInteger(year) || !Number.isInteger(month) || !["csv", "html", "pdf"].includes(kind)) {
      res.status(400).send("Invalid artifact request");
      return;
    }
    try {
      const user = await sdk.authenticateRequest(req);
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
        "Content-Disposition": `attachment; filename="storeos-management-report-${year}-${String(month).padStart(2, "0")}.${extension}"`,
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
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
