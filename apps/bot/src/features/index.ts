import type { Feature } from "#/core/feature";
import { chat } from "#/features/chat";
import { general } from "#/features/general";
import { music } from "#/features/music";

export const features: Feature[] = [general, music, chat];
