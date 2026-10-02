import { z } from "zod";

export const guildInput = z.object({
	guildId: z.string().regex(/^\d{15,25}$/),
});
