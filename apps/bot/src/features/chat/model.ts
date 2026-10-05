import { createXai } from "@ai-sdk/xai";
import { env } from "#/env";

const xai = createXai({ apiKey: env.XAI_API_KEY });
export const chatModel = (id: string) => xai(id);
