import type { Evidence, GraphNode, GraphRepository, GraphService } from "@relic/graph-core";
import { changedRanges, symbolsForRanges } from "@relic/indexer";

export interface PrAffectedRow {
  node: GraphNode;
  relationship: string;
  depth: number;
  confidence: number;
  evidence: Evidence;
}

export interface PrImpact {
  changedFiles: Array<{ filePath: string; changedLines: number }>;
  changedSymbols: GraphNode[];
  affected: PrAffectedRow[];
  tests: GraphNode[];
  risk: number;
  diagnostics: number;
}

/** Aggregate blast radius + related tests for a PR's git diff. */
export function collectPrImpact(
  graph: GraphService,
  repository: GraphRepository,
  repositoryId: string,
  rootPath: string,
  base?: string,
  head?: string,
): PrImpact {
  const ranges = changedRanges(rootPath, base, head);
  const changedNodes = ranges.flatMap((range) =>
    repository.listNodes({ repositoryId, filePath: range.filePath, limit: 2000 }),
  );
  const targets = symbolsForRanges(changedNodes, ranges);
  const affected = new Map<string, PrAffectedRow>();
  const tests = new Map<string, GraphNode>();
  let risk = 0;

  for (const target of targets) {
    if (!affected.has(target.id)) {
      const evidence: Evidence = { source: "static" };
      if (target.filePath) evidence.file = target.filePath;
      if (target.startLine) evidence.line = target.startLine;
      affected.set(target.id, {
        node: target,
        relationship: "CHANGED",
        depth: 0,
        confidence: 1,
        evidence,
      });
    }
    const impact = graph.analyzeImpact(repositoryId, target.id, {
      maxDepth: 5,
      includeTests: true,
    });
    risk = Math.max(risk, impact.summary.risk.score);
    for (const row of impact.affected) {
      const previous = affected.get(row.node.id);
      if (!previous || row.depth < previous.depth) {
        affected.set(row.node.id, {
          node: row.node,
          relationship: row.relationship,
          depth: row.depth,
          confidence: row.confidence,
          evidence: row.evidence,
        });
      }
      if (row.node.type === "test") tests.set(row.node.id, row.node);
    }
    for (const test of graph.findRelatedTests(repositoryId, target.id)) {
      tests.set(test.id, test);
    }
  }

  const diagnostics =
    repository.getRepository(repositoryId)?.diagnostics.filter((d) => d.kind === "unresolved")
      .length ?? 0;

  return {
    changedFiles: ranges.map((range) => ({
      filePath: range.filePath,
      changedLines: range.lines.length,
    })),
    changedSymbols: targets,
    affected: [...affected.values()].sort((a, b) => a.depth - b.depth),
    tests: [...tests.values()].sort((a, b) =>
      (a.filePath ?? a.name).localeCompare(b.filePath ?? b.name),
    ),
    risk,
    diagnostics,
  };
}

const MAX_ROWS = 50;

/** Markdown suitable for a PR comment; never includes source text. */
export function formatPrImpact(report: PrImpact): string {
  const lines = ["## Relic impact", ""];
  lines.push(
    `**Risk:** ${report.risk}/100 · **Changed symbols:** ${report.changedSymbols.length} · ` +
      `**Affected nodes:** ${report.affected.length} · **Related tests:** ${report.tests.length}`,
  );
  if (report.diagnostics > 0) {
    lines.push(
      "",
      `> ${report.diagnostics} unresolved relationship${report.diagnostics === 1 ? "" : "s"} during indexing — coverage is incomplete.`,
    );
  }

  lines.push("", "### Changed files", "");
  if (report.changedFiles.length === 0) lines.push("_No changed files detected._");
  for (const file of report.changedFiles) {
    lines.push(
      `- \`${file.filePath}\` (${file.changedLines} line${file.changedLines === 1 ? "" : "s"})`,
    );
  }

  lines.push("", "### Changed symbols", "");
  if (report.changedSymbols.length === 0) {
    lines.push("_No indexed symbols intersect the changed lines._");
  }
  for (const symbol of report.changedSymbols) {
    lines.push(`- \`${symbol.qualifiedName ?? symbol.name}\` — \`${location(symbol)}\``);
  }

  lines.push("", "### Blast radius", "");
  if (report.affected.length === 0) {
    lines.push("_Nothing depends on the changed symbols._");
  }
  for (const row of report.affected.slice(0, MAX_ROWS)) {
    const confidence = Math.round(row.confidence * 100);
    const evidence = row.evidence.file
      ? `${row.evidence.file}${row.evidence.line ? `:${row.evidence.line}` : ""}`
      : null;
    lines.push(
      `- \`${row.node.qualifiedName ?? row.node.name}\` — ${row.relationship} · depth ${row.depth} · ${confidence}%` +
        (evidence ? ` · \`${evidence}\`` : ""),
    );
  }
  if (report.affected.length > MAX_ROWS) {
    lines.push(`- …and ${report.affected.length - MAX_ROWS} more`);
  }

  lines.push("", "### Related tests", "");
  if (report.tests.length === 0) lines.push("_No related tests indexed._");
  for (const test of report.tests) {
    lines.push(`- \`${test.qualifiedName ?? test.name}\``);
  }

  return `${lines.join("\n")}\n`;
}

function location(node: GraphNode): string {
  if (!node.filePath) return "unknown location";
  return `${node.filePath}${node.startLine ? `:${node.startLine}` : ""}`;
}
