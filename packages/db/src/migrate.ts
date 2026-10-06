import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

await migrate(db, {
	migrationsFolder: new URL("../drizzle", import.meta.url).pathname,
});
await db.$client.end();
console.log("Migrations applied");
