// a setting's default value and what it does, kept apart from its validation rules

export type Meta<T> = { default: T; description: string };

export const meta = <T>(value: T, description: string): Meta<T> => ({
	default: value,
	description,
});
