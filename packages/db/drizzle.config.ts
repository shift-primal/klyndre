import { defineConfig } from "drizzle-kit";
import "./src/env";

export default defineConfig({
	schema: "./src/schema",
	dialect: "postgresql",
	dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
