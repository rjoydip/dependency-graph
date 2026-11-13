import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { initProject } from "../../../apps/api/src/init";

const tempRoot = () => mkdtempSync(join(tmpdir(), "dependency-graph-init-"));

describe("dependency-graph init", () => {
  it("writes an MCP config and a skill idempotently", () => {
    const root = tempRoot();
    try {
      const first = initProject(root);
      const config = JSON.parse(readFileSync(first.mcpConfig, "utf8")) as {
        mcpServers: Record<
          string,
          { command: string; env: { DEPENDENCY_GRAPH_REPOSITORY: string } }
        >;
      };
      expect(config.mcpServers["dependency-graph"]?.command).toBe("npx");
      expect(config.mcpServers["dependency-graph"]?.env.DEPENDENCY_GRAPH_REPOSITORY).toBe(root);
      expect(readFileSync(first.skill, "utf8")).toContain("Dependency Graph");

      const second = initProject(root);
      expect(second.changed).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves other MCP servers and existing skill edits", () => {
    const root = tempRoot();
    try {
      writeFileSync(
        join(root, ".mcp.json"),
        JSON.stringify({ mcpServers: { other: { command: "other" } } }),
      );
      const first = initProject(root);
      const config = JSON.parse(readFileSync(first.mcpConfig, "utf8")) as {
        mcpServers: Record<string, unknown>;
      };
      expect(config.mcpServers.other).toEqual({ command: "other" });
      expect(config.mcpServers["dependency-graph"]).toBeDefined();

      writeFileSync(first.skill, "custom skill");
      initProject(root);
      expect(readFileSync(first.skill, "utf8")).toBe("custom skill");
      initProject(root, { force: true });
      expect(readFileSync(first.skill, "utf8")).not.toBe("custom skill");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
