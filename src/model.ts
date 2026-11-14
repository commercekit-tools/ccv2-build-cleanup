/** Projected, validated endpoint data; absent safety flags remain unknown. */
export interface Build {
  readonly code: string;
  readonly subscriptionCode: string;
  readonly applicationCode?: string | undefined;
  readonly status: string;
  readonly buildStartTimestamp?: string | undefined;
  readonly buildEndTimestamp?: string | undefined;
  readonly deployed?: boolean | undefined;
  readonly hasSnapshot?: boolean | undefined;
  readonly markedForDeletion?: boolean | undefined;
}
export interface Policy {
  readonly retentionDays: number;
  readonly keepLatest: number;
  readonly maxDeletions: number;
  readonly excludeBuildCodes: readonly string[];
  readonly applicationCode?: string | undefined;
}
export interface SafetyEvidence {
  readonly inventoryComplete: boolean;
  readonly protectionComplete: boolean;
  /** Set only by a supported production contract or isolated sandbox adapter. */
  readonly eligibilityVerified: boolean;
  readonly activeDeploymentBuildCodes: ReadonlySet<string>;
  readonly snapshotOrBackupBuildCodes: ReadonlySet<string>;
}
export type ReasonCode =
  | "retained-latest"
  | "retained-age"
  | "explicitly-excluded"
  | "active-build"
  | "deployed"
  | "active-deployment-reference"
  | "snapshot-or-backup-reference"
  | "already-marked-for-deletion"
  | "missing-timestamp"
  | "eligibility-unverified"
  | "incomplete-inventory"
  | "invalid-api-response";
export interface Decision {
  readonly build: Build;
  readonly reasons: readonly ReasonCode[];
  /** Meets both retention thresholds, independently of operational safety. */
  readonly retentionCandidate: boolean;
  readonly eligible: boolean;
  readonly selected: boolean;
}
export interface RetentionPlan {
  readonly decisions: readonly Decision[];
  readonly candidateCodes: readonly string[];
  readonly plannedCodes: readonly string[];
  readonly deferredCodes: readonly string[];
  readonly rankable: boolean;
  readonly cutoff: string;
}
