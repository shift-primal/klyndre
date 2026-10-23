-- hand edited (spec 0002): the old data is reset, and these deletes must run before
-- the kind column and its index go, or the new unique index can hit duplicate keys
DELETE FROM "lore_entries" WHERE "kind" = 'self';--> statement-breakpoint
DELETE FROM "guild_settings" WHERE "module" IN ('chat', 'channels', 'personality', 'character');--> statement-breakpoint
DELETE FROM "prompt_presets";--> statement-breakpoint
CREATE TABLE "character_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"guildId" text NOT NULL,
	"field" text NOT NULL,
	"text" text NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_fields" (
	"guildId" text NOT NULL,
	"field" text NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "character_fields_guildId_field_pk" PRIMARY KEY("guildId","field")
);
--> statement-breakpoint
DROP INDEX "lore_entries_guild_kind_key";--> statement-breakpoint
CREATE INDEX "character_entries_guild_field" ON "character_entries" USING btree ("guildId","field");--> statement-breakpoint
CREATE UNIQUE INDEX "lore_entries_guild_key" ON "lore_entries" USING btree ("guildId",lower("key"));--> statement-breakpoint
ALTER TABLE "lore_entries" DROP COLUMN "kind";