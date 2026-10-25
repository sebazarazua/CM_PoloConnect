import { it, expect } from "vitest";
import { countingCM } from "./ai-helpers.js";
import { runAIDemo } from "../src/workflows/demo.js";
import { DeterministicQualityGate } from "../src/qa/deterministic-gate.js";
import { current } from "../src/domain/models.js";

it("deterministic QA checks declared dates, times, canonical names, CTA destinations and active version counters", async () => {
  const { cm } = countingCM(),
    c = await runAIDemo(cm),
    s = await cm.repository.read(),
    event = Object.values(s.events)[0]!.data;
  const gate = new DeterministicQualityGate(cm.runner.validator);
  const date = structuredClone(c);
  current(date.copies)!.data.outputs.caption =
    "Partido el 2027-01-01 a las 09:43";
  const dates = gate.inspect(s, date, event);
  expect(dates.issues.some((i) => i.code === "date_mismatch")).toBe(true);
  expect(dates.issues.some((i) => i.code === "time_mismatch")).toBe(true);
  const names = structuredClone(c);
  current(names.metadata)!.data.entityRefs = [
    { canonical_name: "Equipo inventado" },
  ];
  expect(
    gate
      .inspect(s, names, event)
      .issues.some((i) => i.code === "canonical_name_mismatch"),
  ).toBe(true);
  const link = structuredClone(c);
  current(link.copies)!.data.outputs.cta =
    "Mirá https://not-approved.example.invalid/replay";
  expect(
    gate
      .inspect(s, link, event)
      .issues.some((i) => i.code === "unapproved_link"),
  ).toBe(true);
  const version = structuredClone(c);
  version.versions.copy++;
  expect(
    gate
      .inspect(s, version, event)
      .issues.some((i) => i.code === "version_mismatch"),
  ).toBe(true);
});
