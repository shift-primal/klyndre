import "./env";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export const db = drizzle(process.env.DATABASE_URL ?? "", { schema });
export * from "./lore";
export * from "./schema";
