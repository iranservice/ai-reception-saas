// ===========================================================================
// Shared Type Definitions
//
// Common type aliases used across all domains.
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
