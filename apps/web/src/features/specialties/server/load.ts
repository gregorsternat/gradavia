import "server-only";
import { readApi } from "../../formations/server/load";
import type { SearchParams } from "../../formations/domain/explorer";
import {
  specialtyResponse,
  type SpecialtyResult,
} from "../domain/api-contract";

export async function loadSpecialties(
  params: SearchParams,
): Promise<SpecialtyResult> {
  try {
    const search = new URLSearchParams();
    for (const key of ["paire", "groupe"]) {
      const value = params[key];
      const first = Array.isArray(value) ? value[0] : value;
      if (first) search.set(key, Array.from(first).slice(0, 1200).join(""));
    }
    const response = await readApi("/v1/specialties", search);
    if (response.status !== 200) throw new Error("Specialty API unavailable");
    return specialtyResponse.parse(response.body);
  } catch {
    console.error("Specialty API unavailable.");
    return { status: "unavailable" };
  }
}
