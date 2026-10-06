import { type ModuleName, moduleSchemas } from "@klyndre/config/schemas";

export type FieldKind =
	| "switch"
	| "number"
	| "text"
	| "textarea"
	| "prompt"
	| "channels"
	| "role";

export type FieldSpec = {
	key: string;
	label: string;
	description: string;
	kind: FieldKind;
	min?: number;
	max?: number;
	integer?: boolean;
	advanced: boolean;
};

type Node = {
	def: { type: string };
	unwrap?: () => Node;
	meta():
		| { description?: string; widget?: string; advanced?: boolean }
		| undefined;
	minValue?: number | null;
	maxValue?: number | null;
	isInt?: boolean;
};

const ACRONYMS: Record<string, string> = { ai: "AI" };
const UNBOUNDED = 1e12;

export const moduleNames = Object.keys(moduleSchemas) as ModuleName[];

export const labelFor = (key: string) => {
	const plural = key.endsWith("Ids") ? "s" : "";
	const unit = key.endsWith("Ms") ? " (ms)" : "";
	const words = key
		.replace(/(Ids?|Ms)$/, "")
		.replace(/([A-Z])/g, " $1")
		.toLowerCase()
		.split(" ")
		.filter(Boolean)
		.map((word, i) => {
			if (ACRONYMS[word]) return ACRONYMS[word];
			return i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
		});
	return `${words.join(" ")}${plural}${unit}`;
};

const kindOf = (widget: string | undefined, inner: Node): FieldKind => {
	if (widget === "textarea") return "textarea";
	if (widget === "prompt") return "prompt";
	if (widget === "textChannel") return "channels";
	if (widget === "role") return "role";
	if (inner.def.type === "boolean") return "switch";
	if (inner.def.type === "number") return "number";
	return "text";
};

const bound = (value: number | null | undefined) =>
	value != null && Math.abs(value) < UNBOUNDED ? value : undefined;

export const fieldsFor = (module: ModuleName): FieldSpec[] =>
	Object.entries(moduleSchemas[module].shape).map(([key, schema]) => {
		const field = schema as unknown as Node;
		const meta = field.meta();
		const inner = field.unwrap?.() ?? field;
		return {
			key,
			label: labelFor(key),
			description: meta?.description ?? "",
			kind: kindOf(meta?.widget, inner),
			min: bound(inner.minValue),
			max: bound(inner.maxValue),
			integer: inner.isInt,
			advanced: meta?.advanced ?? false,
		};
	});

export const sameValue = (a: unknown, b: unknown) =>
	JSON.stringify(a) === JSON.stringify(b);

export const defaultsFor = (module: ModuleName) =>
	moduleSchemas[module].parse({}) as Record<string, unknown>;

export const moduleLabel = (module: ModuleName) =>
	module.charAt(0).toUpperCase() + module.slice(1);
