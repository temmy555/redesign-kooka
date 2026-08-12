export interface StaffSession {
  user: { id: string };
}

export type ReviewDecision = "APPROVE" | "REJECT";
export type VersionAction = "PUBLISH" | "RETIRE";

export interface MutationResult {
  id: string;
  parentId?: string;
  versionNumber?: number;
  lifecycleStatus?: string;
  approvalStatus?: string;
}

export interface ImpactPreview {
  severity: "LOW" | "MEDIUM" | "HIGH";
  blockers: string[];
  warnings: string[];
  references: Record<string, number>;
}
