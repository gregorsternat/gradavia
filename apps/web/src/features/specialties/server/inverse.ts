import "server-only";
import { readApi } from "../../formations/server/load";
import type { SearchParams } from "../../formations/domain/explorer";
import { inverseResponse, type InverseResult } from "../domain/inverse";

export async function loadInverseSpecialties(
  params: SearchParams,
): Promise<InverseResult> {
  try {
    const search = new URLSearchParams();
    const value = Array.isArray(params.formation)
      ? params.formation[0]
      : params.formation;
    if (value)
      search.set("formation", Array.from(value).slice(0, 1600).join(""));
    const response = await readApi("/v1/specialties/inverse", search);
    if (response.status !== 200) throw new Error("Specialty API unavailable");
    return inverseResponse.parse(response.body);
  } catch {
    console.error("Inverse specialty API unavailable.");
    return { status: "unavailable" };
  }
}
