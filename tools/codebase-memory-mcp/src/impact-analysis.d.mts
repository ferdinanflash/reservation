export function analyzeImpactGraph(
  graph: { edges?: Array<Record<string, any>>; functions?: Array<{ id: string; file: string }> } | null | undefined,
  seedFiles: string[],
  maxDepth?: number
): {
  seed_files: string[];
  impacted_files: Array<{ file: string; depth: number; relationship: string[]; evidence: Array<Record<string, any>> }>;
  traversed_edges: number;
  limitation: string;
};
export function buildVerificationChecklist(request: string): string[];
