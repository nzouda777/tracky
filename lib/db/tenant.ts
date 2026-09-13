import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { getDb } from "./index";

/**
 * Tenant-scoped data access.
 *
 * Every table that holds store data carries a `store_id`. Going through this
 * class is the only sanctioned way to read or write those tables from
 * application code: the `store_id` predicate is injected by the layer rather
 * than remembered by each call site, so a forgotten filter cannot leak another
 * store's rows.
 *
 * Tables without a `store_id` (`users`, `webhook_events`) are global by
 * definition and are queried directly through `db`.
 */

/** Any table that is owned by exactly one store. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TenantTable = PgTable & { storeId: PgColumn<any> };

export class TenantDb {
  constructor(readonly storeId: string) {
    if (!storeId) {
      throw new Error("TenantDb requires a storeId.");
    }
  }

  private get db() {
    return getDb();
  }

  /**
   * Builds the tenant predicate for a table, optionally AND-ed with extra
   * conditions. Exposed so hand-written queries (joins, aggregates) can still
   * opt into the same guarantee.
   */
  scope(table: TenantTable, ...conditions: Array<SQL | undefined>): SQL {
    return and(
      eq(table.storeId, this.storeId),
      ...conditions.filter(Boolean),
    ) as SQL;
  }

  /** `SELECT * FROM table WHERE store_id = $1 AND <where>`. */
  async findMany<T extends TenantTable>(
    table: T,
    options: {
      where?: SQL;
      orderBy?: SQL | SQL[];
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<T["$inferSelect"][]> {
    // Drizzle's `from()` cannot narrow a generic table parameter, so the
    // builder is assembled untyped here and the result is cast back to the
    // table's own select type on the way out.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = this.db
      .select()
      .from(table as PgTable)
      .where(this.scope(table, options.where))
      .$dynamic();

    if (options.orderBy) {
      const order = Array.isArray(options.orderBy)
        ? options.orderBy
        : [options.orderBy];
      query = query.orderBy(...order);
    }
    if (options.limit !== undefined) query = query.limit(options.limit);
    if (options.offset !== undefined) query = query.offset(options.offset);

    return (await query) as T["$inferSelect"][];
  }

  /** First matching row, or `null`. */
  async findFirst<T extends TenantTable>(
    table: T,
    options: { where?: SQL; orderBy?: SQL | SQL[] } = {},
  ): Promise<T["$inferSelect"] | null> {
    const rows = await this.findMany(table, { ...options, limit: 1 });
    return rows[0] ?? null;
  }

  /** Looks a row up by primary key, still constrained to this store. */
  async findById<T extends TenantTable & { id: PgColumn }>(
    table: T,
    id: string,
  ): Promise<T["$inferSelect"] | null> {
    return this.findFirst(table, { where: eq(table.id, id) });
  }

  /** Inserts rows, overwriting any caller-supplied `storeId`. */
  async insert<T extends TenantTable>(
    table: T,
    values: Omit<T["$inferInsert"], "storeId"> | Omit<T["$inferInsert"], "storeId">[],
  ): Promise<T["$inferSelect"][]> {
    const rows = (Array.isArray(values) ? values : [values]).map((value) => ({
      ...value,
      storeId: this.storeId,
    })) as T["$inferInsert"][];

    return (await this.db
      .insert(table)
      .values(rows)
      .returning()) as T["$inferSelect"][];
  }

  /** Inserts a single row and returns it. */
  async insertOne<T extends TenantTable>(
    table: T,
    values: Omit<T["$inferInsert"], "storeId">,
  ): Promise<T["$inferSelect"]> {
    const [row] = await this.insert(table, values);
    return row;
  }

  /** Updates rows inside this store only. `storeId` can never be reassigned. */
  async update<T extends TenantTable>(
    table: T,
    values: Partial<Omit<T["$inferInsert"], "storeId" | "id">>,
    where?: SQL,
  ): Promise<T["$inferSelect"][]> {
    // Drop any storeId from the payload: a row can never change tenant.
    const safe = { ...(values as Record<string, unknown>) };
    delete safe.storeId;
    return (await this.db
      .update(table)
      .set(safe as Partial<T["$inferInsert"]>)
      .where(this.scope(table, where))
      .returning()) as T["$inferSelect"][];
  }

  /** Updates one row by id, scoped to this store. */
  async updateById<T extends TenantTable & { id: PgColumn }>(
    table: T,
    id: string,
    values: Partial<Omit<T["$inferInsert"], "storeId" | "id">>,
  ): Promise<T["$inferSelect"] | null> {
    const [row] = await this.update(table, values, eq(table.id, id));
    return row ?? null;
  }

  /** Deletes rows inside this store only. */
  async delete<T extends TenantTable>(
    table: T,
    where?: SQL,
  ): Promise<T["$inferSelect"][]> {
    return (await this.db
      .delete(table)
      .where(this.scope(table, where))
      .returning()) as T["$inferSelect"][];
  }

  async deleteById<T extends TenantTable & { id: PgColumn }>(
    table: T,
    id: string,
  ): Promise<boolean> {
    const rows = await this.delete(table, eq(table.id, id));
    return rows.length > 0;
  }

  /**
   * Escape hatch for read-only queries the helpers above cannot express
   * (joins, aggregates). Callers MUST add `scope(table)` to the WHERE clause.
   */
  get raw() {
    return this.db;
  }
}

/** Creates a tenant-scoped client for a store. */
export function forStore(storeId: string): TenantDb {
  return new TenantDb(storeId);
}
