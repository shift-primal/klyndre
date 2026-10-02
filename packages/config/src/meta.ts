/** How the web app should render a setting: a Discord object picker, a multi-line box, or a prompt editor with saved presets. */
export type Widget = "textChannel" | "role" | "textarea" | "prompt";

/** A setting's default value and what it does, kept apart from its validation rules. */
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
