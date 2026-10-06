export type Widget = "textChannel" | "role" | "textarea" | "prompt";

export type Meta<T> = {
	default: T;
	description: string;
	widget?: Widget;
	advanced?: boolean;
};

export const meta = <T>(
	value: T,
	description: string,
	widget?: Widget,
): Meta<T> => ({
	default: value,
	description,
	...(widget && { widget }),
});

// Works fine as is, so the web app tucks it away below the settings worth tuning
export const advanced = <T>(
	value: T,
	description: string,
	widget?: Widget,
): Meta<T> => ({ ...meta(value, description, widget), advanced: true });
