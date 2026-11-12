import { serve } from "@hono/node-server";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "./app";

const dbPath = process.env.DEPENDENCY_GRAPH_DB ?? join(tmpdir(), "dependency-graph.db");
const allowedRoots = process.env.DEPENDENCY_GRAPH_ALLOWED_ROOTS
  ? process.env.DEPENDENCY_GRAPH_ALLOWED_ROOTS.split(";").filter(Boolean)
  : undefined;
const port = Number(process.env.PORT ?? 8787);

const app = buildApp({ dbPath, ...(allowedRoots ? { allowedRoots } : {}) });

console.error(`dependency-graph API listening on http://127.0.0.1:${port}`);

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" });
