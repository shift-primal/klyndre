// plain values, no db imports, so the web client can use them too

// self: the life the bot makes up for itself, server: the group's running jokes
export const loreKinds = ["self", "server"] as const;
export type LoreKind = (typeof loreKinds)[number];

export const LORE_KEY_MAX = 80;
export const LORE_NOTES_MAX = 1000;
