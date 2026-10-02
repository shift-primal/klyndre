export type Widget = "textChannel" | "role" | "textarea" | "prompt";

export type Meta<T> = { default: T; description: string; widget?: Widget };

export const meta = <T>(
	value: T,
	description: string,
	widget?: Widget,
): Meta<T> => ({
	default: value,
	description,
	...(widget && { widget }),
});
