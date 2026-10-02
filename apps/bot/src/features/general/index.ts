import type { Feature } from "#/core/feature";
import { ping } from "#/features/general/ping";

export const general: Feature = { name: "general", commands: [ping] };
