import "server-only";
import { AppwriteException, ID, Models, Query, TablesDB } from "node-appwrite";
import { getConfig } from "../appwrite/config";
import { ApiError } from "./errors";

export type Table = "products" | "quotations" | "runs" | "activity" | "settings" | "dealers" | "restockOrders";
export type BusinessRow = Models.Row &
  Record<string, unknown> & { owner_user_id: string };

export class BusinessStore {
  readonly config = getConfig();
  constructor(
    readonly db: TablesDB,
    readonly ownerId: string,
  ) {}

  private table(table: Table) {
    return this.config[table];
  }

  async list(
    table: Table,
    queries: string[] = [],
    transactionId?: string,
  ): Promise<BusinessRow[]> {
    const rows: BusinessRow[] = [];
    let cursor: string | undefined;
    while (true) {
      const page = await this.db.listRows<BusinessRow>({
        databaseId: this.config.databaseId,
        tableId: this.table(table),
        queries: [
          Query.equal("owner_user_id", this.ownerId),
          ...queries,
          Query.limit(100),
          ...(cursor ? [Query.cursorAfter(cursor)] : []),
        ],
        transactionId,
        total: false,
        ttl: 0,
      });
      rows.push(...page.rows);
      if (page.rows.length < 100) return rows;
      cursor = page.rows.at(-1)!.$id;
      // Never silently truncate data or pass an unbounded catalog to a model.
      if (rows.length >= 10000)
        throw new ApiError(
          422,
          "This MVP supports fewer than 10,000 records per business table.",
        );
    }
  }

  async latest(table: Table, limit: number): Promise<BusinessRow[]> {
    const result = await this.db.listRows<BusinessRow>({
      databaseId: this.config.databaseId,
      tableId: this.table(table),
      queries: [
        Query.equal("owner_user_id", this.ownerId),
        Query.orderDesc("$createdAt"),
        Query.orderDesc("$id"),
        Query.limit(limit),
      ],
      ttl: 0,
      total: false,
    });
    return result.rows;
  }

  async get(
    table: Table,
    id: string,
    transactionId?: string,
  ): Promise<BusinessRow> {
    let row: BusinessRow;
    try {
      row = await this.db.getRow<BusinessRow>({
        databaseId: this.config.databaseId,
        tableId: this.table(table),
        rowId: id,
        transactionId,
      });
    } catch (error) {
      if (
        error instanceof AppwriteException &&
        error.code === 404 &&
        /row|document/.test(error.type)
      )
        throw new ApiError(404, "Record not found.");
      throw error;
    }
    if (row.owner_user_id !== this.ownerId)
      throw new ApiError(404, "Record not found.");
    return row;
  }

  async create(
    table: Table,
    data: Record<string, unknown>,
    transactionId?: string,
    rowId = ID.unique(),
  ): Promise<BusinessRow> {
    return this.db.createRow<BusinessRow>({
      databaseId: this.config.databaseId,
      tableId: this.table(table),
      rowId,
      data: { ...data, owner_user_id: this.ownerId },
      permissions: [],
      transactionId,
    });
  }

  async update(
    table: Table,
    id: string,
    data: Record<string, unknown>,
    transactionId?: string,
  ): Promise<BusinessRow> {
    await this.get(table, id, transactionId);
    if ("owner_user_id" in data)
      throw new ApiError(422, "Ownership cannot be changed.");
    return this.db.updateRow<BusinessRow>({
      databaseId: this.config.databaseId,
      tableId: this.table(table),
      rowId: id,
      data,
      transactionId,
    });
  }

  async remove(table: Table, id: string, transactionId: string) {
    await this.get(table, id, transactionId);
    return this.db.deleteRow({
      databaseId: this.config.databaseId,
      tableId: this.table(table),
      rowId: id,
      transactionId,
    });
  }

  async activity(
    actor: string,
    action: string,
    target: string,
    transactionId?: string,
  ) {
    return this.create("activity", { actor, action, target }, transactionId);
  }

  async transaction<T>(
    work: (transactionId: string) => Promise<T>,
  ): Promise<T> {
    // Appwrite Cloud requires a transaction TTL of at least 60 seconds.
    const transaction = await this.db.createTransaction({ ttl: 60 });
    try {
      const value = await work(transaction.$id);
      await this.db.updateTransaction({
        transactionId: transaction.$id,
        commit: true,
      });
      return value;
    } catch (error) {
      try {
        await this.db.updateTransaction({
          transactionId: transaction.$id,
          rollback: true,
        });
      } catch {
        /* Preserve the original error; expired transactions are cleaned by Appwrite. */
      }
      throw error;
    }
  }

  async decide(
    id: string,
    status: "approved" | "rejected",
    note: string | undefined,
    transactionId: string,
  ) {
    // Review state is verified from the owner's quotation in this same
    // transaction. Update the one known row by ID instead of making a bulk
    // update request whose filtered row count can report zero in production.
    // Concurrent commits on the same quotation conflict transactionally,
    // so only one approval can commit inventory deductions.
    const current = await this.get("quotations", id, transactionId);
    if (current.status !== "pending")
      throw new ApiError(409, "Quotation has already been reviewed.");
    await this.update(
      "quotations",
      id,
      {
        status,
        reviewerNote: note ?? null,
        reviewer_user_id: this.ownerId,
        reviewed_at: new Date().toISOString(),
      },
      transactionId,
    );
  }

  async decrementStock(id: string, quantity: number, transactionId: string) {
    await this.get("products", id, transactionId);
    return this.db.decrementRowColumn<BusinessRow>({
      databaseId: this.config.databaseId,
      tableId: this.config.products,
      rowId: id,
      column: "stock",
      value: quantity,
      min: 0,
      transactionId,
    });
  }
}
