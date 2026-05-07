// ===========================================================================
// Shared Type Definitions
//
// Common type aliases and enums used across all domains.
// Domain-specific types belong in their respective domain modules.
// ===========================================================================

/** UUID string type alias for clarity */
export type UUID = string;

/** ISO 8601 timestamp string type alias */
export type ISOTimestamp = string;

/** Generic JSON value type */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Business membership role */
export enum BusinessRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}

/** Audit log severity */
export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/** Conversation status */
export enum ConversationStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}

/** Owner type for routing */
export enum OwnerType {
  AI = 'ai',
  HUMAN = 'human',
  UNASSIGNED = 'unassigned',
}
