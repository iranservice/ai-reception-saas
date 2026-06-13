// ===========================================================================
// Tests — Dev-Bypass Config-Surface Scan (A-R2 CI assertion)
//
// CI/config guard: scans the COMMITTED real-data configuration surface and
// fails if any of it enables the dev-bypass flags. This catches a dangerous
// flag being committed to a real-data config (the runtime guard catches it
// at boot; this catches it at review/CI time before deploy).
//
// Local-only files (.env.local, *.local) are git-ignored and intentionally
// NOT scanned — that is where developers enable dev headers.
// ===========================================================================

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  ENABLE_AUTHJS_REQUEST_CONTEXT,
  ENABLE_DEV_AUTH_CONTEXT,
  VITE_DEV_BUSINESS_ID,
} from '@/lib/security/dev-bypass-guard';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Committed config files that may describe a real-data environment. */
const CONFIG_FILES = ['.env.example', '.github/workflows/ci.yml'];

/**
 * Strips comments from a config file's text:
 * - dotenv: lines whose first non-whitespace char is '#'
 * - yaml: same '#' rule (sufficient for our flag-name scan)
 * Returns the remaining active lines.
 */
function activeLines(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('#');
    });
}

/**
 * Returns the assigned value for `flag` in an active line, or null if the
 * flag is not actively assigned. Handles `KEY=value` (dotenv) and
 * `KEY: value` (yaml), with optional surrounding quotes.
 */
function assignedValue(line: string, flag: string): string | null {
  const match = line
    .trim()
    .match(new RegExp(`^${flag}\\s*[:=]\\s*(.*)$`));
  if (!match) return null;
  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

describe('dev-bypass config-surface scan', () => {
  for (const relPath of CONFIG_FILES) {
    const absPath = path.join(REPO_ROOT, relPath);

    it(`${relPath}: does not enable ENABLE_DEV_AUTH_CONTEXT`, () => {
      if (!fs.existsSync(absPath)) return; // file optional
      const lines = activeLines(fs.readFileSync(absPath, 'utf8'));
      for (const line of lines) {
        const value = assignedValue(line, ENABLE_DEV_AUTH_CONTEXT);
        expect(
          value === 'true',
          `${relPath} actively sets ${ENABLE_DEV_AUTH_CONTEXT}="true" in committed config`,
        ).toBe(false);
      }
    });

    it(`${relPath}: does not set VITE_DEV_BUSINESS_ID`, () => {
      if (!fs.existsSync(absPath)) return;
      const lines = activeLines(fs.readFileSync(absPath, 'utf8'));
      for (const line of lines) {
        const value = assignedValue(line, VITE_DEV_BUSINESS_ID);
        expect(
          value !== null && value.length > 0,
          `${relPath} actively sets ${VITE_DEV_BUSINESS_ID} in committed config`,
        ).toBe(false);
      }
    });

    it(`${relPath}: never disables ENABLE_AUTHJS_REQUEST_CONTEXT`, () => {
      if (!fs.existsSync(absPath)) return;
      const lines = activeLines(fs.readFileSync(absPath, 'utf8'));
      for (const line of lines) {
        const value = assignedValue(line, ENABLE_AUTHJS_REQUEST_CONTEXT);
        // If actively assigned in committed config, it must be exactly "true".
        if (value !== null) {
          expect(
            value,
            `${relPath} sets ${ENABLE_AUTHJS_REQUEST_CONTEXT} to a non-"true" value`,
          ).toBe('true');
        }
      }
    });
  }
});
