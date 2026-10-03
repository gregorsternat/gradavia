// Synthetic, deliberately labeled data shared by browser and database tests.
export const fixtureCampaigns = [
  2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018,
];

export function fixtureDataset(campaign: number): string {
  if (campaign === 2025) return "fr-esr-parcoursup";
  return `fr-esr-parcoursup${campaign < 2020 ? "-" : "_"}${campaign}`;
}

export function fixturePayloads(campaign: number): Record<string, unknown>[] {
  const base = {
    session: String(campaign),
    g_ea_lib_vx: "Université de démonstration",
    ville_etab: "Lyon",
    dep_lib: "Rhône",
    region_etab_aff: "Auvergne-Rhône-Alpes",
    fili: "Licence",
    contrat_etab: "Public",
    select_form: "formation non sélective",
    form_lib_voe_acc: "Licence - Droit",
    fil_lib_voe_acc: "Droit",
    detail_forma: "Parcours européen",
    lien_form_psup:
      "https://dossier.parcoursup.fr/Candidats/public/fiches/afficherFicheFormation?g_ta_cod=00042",
  };
  if (campaign < 2021) {
    const historical: Record<string, unknown> = { ...base };
    delete historical.ville_etab;
    if (campaign < 2020) delete historical.select_form;
    else historical.select_form = "formation non selec";
    if (campaign === 2018) delete historical.contrat_etab;
    if (campaign === 2019) historical.g_ea_lib_vx = " \n\t ";
    historical.lien_form_psup = null;
    return [historical];
  }
  if (campaign < 2025) return [{ ...base, lib_for_voe_ins: "Licence - Droit" }];
  const economics = {
    ...base,
    lib_for_voe_ins: "Licence - Économie",
    g_ea_lib_vx: "École de démonstration",
    ville_etab: "Étampes",
    dep_lib: "Essonne",
    region_etab_aff: "Ile-de-France",
  };
  return [
    ...Array.from({ length: 27 }, (_, index) => ({
      ...base,
      lib_for_voe_ins: `Licence - Droit ${String(index + 1).padStart(2, "0")}`,
    })),
    economics,
    { ...economics },
    {
      ...base,
      lib_for_voe_ins: "BTS - Systèmes numériques",
      fili: "BTS",
      contrat_etab: "Privé sous contrat d'association",
      select_form: "formation sélective",
    },
    {
      ...base,
      lib_for_voe_ins: "Autre formation - 100%_réussite!",
      fili: "Autre formation",
      lien_form_psup: "javascript:alert(1)",
    },
  ];
}
