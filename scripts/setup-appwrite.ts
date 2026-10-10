import {
  AppwriteException,
  TablesDB,
  Models,
  TablesDBIndexType,
  OrderBy,
} from "node-appwrite";
import { businessSchema, Column } from "./schema";
import { scriptEnvironment, reportScriptFailure } from "./environment";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const notFound = (error: unknown) =>
  error instanceof AppwriteException && error.code === 404;

async function createColumn(
  db: TablesDB,
  databaseId: string,
  tableId: string,
  column: Column,
) {
  const args = {
    databaseId,
    tableId,
    key: column.key,
    required: column.required,
    array: false,
  };
  switch (column.type) {
    case "varchar":
      return db.createVarcharColumn({ ...args, size: column.size! });
    case "text":
      return db.createTextColumn(args);
    case "mediumtext":
      return db.createMediumtextColumn(args);
    case "integer":
      return db.createIntegerColumn({
        ...args,
        min: column.min,
        max: column.max,
      });
    case "float":
      return db.createFloatColumn({
        ...args,
        min: column.min,
        max: column.max,
      });
    case "enum":
      return db.createEnumColumn({ ...args, elements: column.elements! });
    case "datetime":
      return db.createDatetimeColumn(args);
  }
}

async function waitAvailable(load: () => Promise<{ status: string }>) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const value = await load();
    if (value.status === "available") return;
    if (["failed", "stuck"].includes(value.status))
      throw new Error("A schema resource failed to become available.");
    await wait(500);
  }
  throw new Error("Schema provisioning timed out.");
}

async function main() {
  const { config, db } = scriptEnvironment(true);
  try {
    await db.get({ databaseId: config.databaseId });
  } catch (error) {
    if (!notFound(error)) throw error;
    await db.create({ databaseId: config.databaseId, name: "AgentForce" });
  }
  for (const schema of businessSchema) {
    const tableId = config[schema.configKey];
    const args = { databaseId: config.databaseId, tableId };
    try {
      const table = await db.getTable(args);
      if (table.$permissions.length || !table.rowSecurity)
        throw new Error(
          "Existing table has unsafe permissions. Remove table grants and enable Row Security before provisioning.",
        );
    } catch (error) {
      if (!notFound(error)) throw error;
      await db.createTable({
        ...args,
        name: tableId,
        permissions: [],
        rowSecurity: true,
      });
    }
    const existing = (await db.listColumns({ ...args, queries: [] })).columns;
    for (const column of schema.columns) {
      const old = existing.find((value) => value.key === column.key);
      if (old) {
        const details = old as typeof old & {
          size?: number;
          min?: number;
          max?: number;
          elements?: string[];
        };
        if (
          old.type !== column.type ||
          old.required !== column.required ||
          old.array ||
          (column.size && details.size !== column.size) ||
          (column.elements &&
            JSON.stringify(details.elements) !==
              JSON.stringify(column.elements)) ||
          (column.min !== undefined && details.min !== column.min) ||
          (column.max !== undefined && details.max !== column.max)
        )
          throw new Error(
            "Existing schema is incompatible; migrate it explicitly rather than overwriting it.",
          );
      } else await createColumn(db, config.databaseId, tableId, column);
      await waitAvailable(() => db.getColumn({ ...args, key: column.key }));
    }
    if (
      existing.some(
        (column) =>
          column.required &&
          !schema.columns.some((expected) => expected.key === column.key),
      )
    )
      throw new Error(
        "An unexpected required column exists. Use a separate MVP database or coordinate a migration.",
      );
    for (const index of schema.indexes) {
      let old: Models.ColumnIndex | undefined;
      try {
        old = await db.getIndex({ ...args, key: index.key });
      } catch (error) {
        if (!notFound(error)) throw error;
      }
      if (old) {
        if (
          old.type !== index.type ||
          JSON.stringify(old.columns) !== JSON.stringify(index.columns) ||
          (index.orders &&
            JSON.stringify(
              (old.orders ?? []).map((order) => order.toUpperCase()),
            ) !== JSON.stringify(index.orders))
        )
          throw new Error(
            "An existing index is incompatible with the required schema.",
          );
      } else
        await db.createIndex({
          ...args,
          ...index,
          type:
            index.type === "unique"
              ? TablesDBIndexType.Unique
              : TablesDBIndexType.Key,
          orders: index.orders?.map((order) =>
            order === "ASC" ? OrderBy.Asc : OrderBy.Desc,
          ),
        });
      await waitAvailable(() => db.getIndex({ ...args, key: index.key }));
    }
    console.log(`Ready: ${tableId} (server-only permissions).`);
  }
  console.log(
    "TablesDB setup complete. Seed privately with SEED_OWNER_USER_ID, then configure the Site runtime scopes.",
  );
}

main().catch(reportScriptFailure);
