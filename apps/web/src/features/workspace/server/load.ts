import "server-only";
import { cache } from "react";
import { loadAtlas } from "../../atlas/server/load";
import {
  loadExplorer,
  loadFormationSelection,
} from "../../formations/server/load";
import { loadOverview, loadSources } from "../../observatory/server/load";
import { loadSpecialties } from "../../specialties/server/load";
import { loadInverseSpecialties } from "../../specialties/server/inverse";
import { createPanelLoader } from "./compose";
export const loadPanel = cache(
  createPanelLoader({
    loadAtlas,
    loadExplorer,
    loadFormationSelection,
    loadOverview,
    loadSources,
    loadSpecialties,
    loadInverseSpecialties,
  }),
);
export type { PanelPayload } from "./compose";
