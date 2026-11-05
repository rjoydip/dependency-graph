import { describe, expect, it } from "bun:test";
import { shouldIgnoreWatchPath } from "../../../apps/api/src/watch";

describe("watch path filter", () => {
  it("ignores dependencies, build output, and VCS metadata", () => {
    for (const path of [
      "node_modules/pkg/index.ts",
      ".git/HEAD",
      "apps/dashboard/dist/index.js",
      "coverage/lcov.info",
      ".next/cache/x",
      "test-results/x",
      "relic.db",
      "relic.db-wal",
      "relic.db-shm",
    ]) {
      expect(shouldIgnoreWatchPath(path)).toBe(true);
    }
  });

  it("re-indexes source and docs changes", () => {
    for (const path of ["src/index.ts", "docs/index.md", "package.json"]) {
      expect(shouldIgnoreWatchPath(path)).toBe(false);
    }
  });
});
