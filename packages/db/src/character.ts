// plain values, no db imports, so the web client can use them too

export const characterFields = [
	{
		field: "basics",
		kind: "text",
		cap: 1,
		description: "Age, gender, what they look like",
	},
	{
		field: "home",
		kind: "text",
		cap: 1,
		description: "Where they live, who with, and where they grew up",
	},
	{
		field: "work",
		kind: "text",
		cap: 1,
		description: "Job or school, and what they think of it",
	},
	{
		field: "routine",
		kind: "text",
		cap: 1,
		description: "A normal week: when they work, sleep, train, game and go out",
	},
	{
		field: "family",
		kind: "list",
		cap: 6,
		description: "Family, with names",
	},
	{
		field: "friends",
		kind: "list",
		cap: 6,
		description: "Friends and love life outside this server, with names",
	},
	{
		field: "interests",
		kind: "list",
		cap: 6,
		description:
			"Hobbies, favourite music, games, shows and food, and what they know a lot about",
	},
	{
		field: "opinions",
		kind: "list",
		cap: 6,
		description: "Hot takes, pet peeves and things they can't stand",
	},
	{
		field: "quirks",
		kind: "list",
		cap: 6,
		description: "Habits, and things they say now and then",
	},
	{
		field: "stories",
		kind: "list",
		cap: 20,
		description: "Things that happened to them, stories they can tell",
	},
] as const;

export type CharacterFieldDefinition = (typeof characterFields)[number];
export type CharacterField = CharacterFieldDefinition["field"];

export const characterFieldNames = characterFields.map(
	({ field }) => field,
) as [CharacterField, ...CharacterField[]];

export const characterSources = ["manual", "filled", "chat"] as const;
export type CharacterSource = (typeof characterSources)[number];

export const CHARACTER_TEXT_MAX = 300;

export const characterField = (field: string) =>
	characterFields.find((definition) => definition.field === field);

export const isCharacterField = (field: string): field is CharacterField =>
	characterField(field) !== undefined;
