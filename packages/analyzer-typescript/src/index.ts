export * from "./discovery";
export * from "./extract";
export * from "./ids";
export * from "./manifests";
export * from "./owners";
export * from "./python";
export * from "./resolve";

import type { RepositoryContext } from "./discovery";
import { extractFile, type ExtractedFile } from "./extract";
import { extractPythonFile } from "./python";

/** Language dispatch for the indexer; both analyzers emit the same contract. */
export function extractSourceFile(
  repo: RepositoryContext,
  filePath: string,
  content?: string,
): ExtractedFile {
  return filePath.endsWith(".py")
    ? extractPythonFile(repo, filePath, content)
    : extractFile(repo, filePath, content);
}
