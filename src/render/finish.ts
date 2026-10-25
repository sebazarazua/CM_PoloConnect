import { readFileSync } from "node:fs";
export interface Finish {
  depth_level: number;
  accent_intensity: number;
  graphic_density: number;
  brand_energy: number;
  background_complexity: number;
}
export type RenderMode = "study" | "production";
export function resolveFinish(
  mode: RenderMode = "production",
  override?: Partial<Finish>,
): Finish {
  const tokens = JSON.parse(
    readFileSync("brand/tokens/finish.json", "utf8"),
  ) as Record<RenderMode, Finish>;
  return { ...tokens[mode], ...override };
}
