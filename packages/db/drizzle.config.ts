import { defineConfig } from "drizzle-kit";
import "./src/env";

export default defineConfig({
	schema: "./src/schema.ts",
	dialect: "postgresql",
	dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
