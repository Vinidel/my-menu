/**
 * Tests for delete_entregue_orders_from_previous_day (delete-orders feature).
 * Brief: docs/briefs/delete-orders.md
 *
 * The function is invoked by pg_cron only — no app code path. We test:
 * 1. Migration content: required SQL patterns (status filter, timezone, security)
 * 2. Cutoff semantics: half-open interval, previous calendar day in America/Sao_Paulo
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = resolve(
  __dirname,
  "../supabase/migrations/20260311000000_add_delete_entregue_orders_function.sql"
);

describe("delete_entregue_orders_from_previous_day — migration content (brief: delete-orders)", () => {
  let migrationSql: string;

  it("migration file exists", () => {
    migrationSql = readFileSync(MIGRATION_PATH, "utf-8");
    expect(migrationSql.length).toBeGreaterThan(0);
  });

  it("deletes only orders with status entregue (brief: success criteria)", () => {
    expect(migrationSql).toContain("status = 'entregue'");
  });

  it("uses updated_at for cutoff (brief: decisions locked)", () => {
    expect(migrationSql).toContain("updated_at");
  });

  it("uses America/Sao_Paulo timezone explicitly (brief: unhappy path timezone drift)", () => {
    expect(migrationSql).toContain("America/Sao_Paulo");
  });

  it("uses half-open interval [start, end) (brief: edge case midnight boundary)", () => {
    expect(migrationSql).toMatch(/updated_at\s*>=\s*v_start/);
    expect(migrationSql).toMatch(/updated_at\s*<\s*v_end/);
  });

  it("uses single transactional DELETE (brief: unhappy path job fails mid-run)", () => {
    expect(migrationSql).toContain("delete from public.orders");
    expect(migrationSql).not.toMatch(/delete from public\.orders[\s\S]*delete from/);
  });

  it("runs with SECURITY DEFINER for DELETE privilege (brief: security constraints)", () => {
    expect(migrationSql).toContain("security definer");
  });

  it("sets search_path to public (brief: security)", () => {
    expect(migrationSql).toContain("search_path = public");
  });

  it("returns count of deleted rows (brief: observability)", () => {
    expect(migrationSql).toContain("returns integer");
    expect(migrationSql).toContain("return v_deleted");
  });
});

describe("delete_entregue_orders — cutoff interval semantics (brief: edge cases)", () => {
  /**
   * Replicates the brief's cutoff logic for regression testing.
   * Previous calendar day in America/Sao_Paulo, half-open [start, end).
   * BRT = UTC-3; Brazil has no DST since 2019.
   * Used only for test assertions — production logic is in the migration.
   */
  function getPreviousDayRangeSaoPaulo(referenceDate: Date): {
    start: Date;
    end: Date;
  } {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(referenceDate);
    const year = Number(parts.find((p) => p.type === "year")!.value);
    const month = Number(parts.find((p) => p.type === "month")!.value);
    const day = Number(parts.find((p) => p.type === "day")!.value);

    // Midnight BRT = 03:00 UTC (BRT is UTC-3)
    const start = new Date(Date.UTC(year, month - 1, day - 1, 3, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
    return { start, end };
  }

  function isInRange(ts: Date, start: Date, end: Date): boolean {
    return ts.getTime() >= start.getTime() && ts.getTime() < end.getTime();
  }

  it("includes start of previous day (brief: half-open interval start inclusive)", () => {
    const ref = new Date("2026-03-12T03:05:00Z"); // 00:05 BRT March 12
    const { start, end } = getPreviousDayRangeSaoPaulo(ref);
    expect(isInRange(start, start, end)).toBe(true);
  });

  it("includes 23:59:59.999 on previous day (brief: midnight boundary)", () => {
    const ref = new Date("2026-03-12T03:05:00Z"); // 00:05 BRT March 12
    const { start, end } = getPreviousDayRangeSaoPaulo(ref);
    const lastMoment = new Date("2026-03-12T02:59:59.999Z"); // 23:59:59.999 BRT March 11
    expect(isInRange(lastMoment, start, end)).toBe(true);
  });

  it("excludes 00:00:00 of next day (brief: half-open interval end exclusive)", () => {
    const ref = new Date("2026-03-12T03:05:00Z");
    const { start, end } = getPreviousDayRangeSaoPaulo(ref);
    const midnightNextDay = new Date("2026-03-12T03:00:00Z"); // 00:00 BRT = 03:00 UTC
    expect(isInRange(midnightNextDay, start, end)).toBe(false);
  });

  it("excludes orders from earlier than previous day (brief: legacy orders)", () => {
    const ref = new Date("2026-03-12T03:05:00Z");
    const { start, end } = getPreviousDayRangeSaoPaulo(ref);
    const twoDaysAgo = new Date("2026-03-10T12:00:00Z");
    expect(isInRange(twoDaysAgo, start, end)).toBe(false);
  });

  it("excludes orders from today (brief: only previous day)", () => {
    const ref = new Date("2026-03-12T03:05:00Z");
    const { start, end } = getPreviousDayRangeSaoPaulo(ref);
    const todayNoon = new Date("2026-03-12T15:00:00Z");
    expect(isInRange(todayNoon, start, end)).toBe(false);
  });
});
