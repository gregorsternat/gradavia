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
    cod_aff_form: "00042",
    cod_uai: "0690001A",
    capa_fin: 100 + (campaign - 2018) * 10,
    voe_tot: 900 + (campaign - 2018) * 120,
    prop_tot: 400 + (campaign - 2018) * 40,
    acc_tot: 95 + (campaign - 2018) * 10,
    taux_acces_ens: 42.5,
    pct_f: 58.2,
    pct_bours: 21.4,
    pct_bg: 72,
    pct_bt: 18,
    pct_bp: 10,
    pct_aca_orig: 60,
    g_olocalisation_des_formations: { lat: 45.75, lon: 4.85 },
    acc_neobac: 150,
    acc_mention_nonrenseignee: 1,
    acc_sansmention: 20,
    acc_ab: 50,
    acc_b: 45,
    acc_tb: 30,
    acc_tbf: 4,
    acc_debutpp: 80,
    acc_datebac: 110,
    acc_finpp: 150,
    lib_grp1: "Tous les candidats",
    ran_grp1: 850,

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
    if (campaign === 2018) {
      delete historical.contrat_etab;
      delete historical.taux_acces_ens;
    }
    if (campaign === 2019) historical.g_ea_lib_vx = " \n\t ";
    historical.lien_form_psup = null;
    return [historical];
  }
  if (campaign < 2025) return [{ ...base, lib_for_voe_ins: "Licence - Droit" }];
  const economics = {
    ...base,
    lib_for_voe_ins: "Licence - Économie",
    cod_aff_form: "00043",
    cod_uai: "0910002B",
    capa_fin: 80,
    voe_tot: 1220,
    acc_tot: 75,
    taux_acces_ens: 27.8,
    g_ea_lib_vx: "École de démonstration",
    ville_etab: "Étampes",
    dep_lib: "Essonne",
    region_etab_aff: "Ile-de-France",
  };
  return [
    ...Array.from({ length: 27 }, (_, index) => ({
      ...base,
      lib_for_voe_ins: `Licence - Droit ${String(index + 1).padStart(2, "0")}`,
      cod_aff_form: index === 0 ? "00042" : `00042-${index + 1}`,
      capa_fin: 170 + index * 5,
      voe_tot: 1740 + index * 60,
      acc_tot: index === 1 ? 0 : 165 + index * 5,
      taux_acces_ens:
        index === 2 ? "*" : index === 3 ? "invalid" : 42.5 + index,
      pct_bours: index === 2 ? "*" : 21.4,
    })),
    economics,
    { ...economics },
    {
      ...base,
      lib_for_voe_ins: "BTS - Systèmes numériques",
      cod_aff_form: "00044",
      capa_fin: 32,
      voe_tot: 487,
      acc_tot: 30,
      taux_acces_ens: 65.7,
      fili: "BTS",
      contrat_etab: "Privé sous contrat d'association",
      select_form: "formation sélective",
    },
    {
      ...base,
      lib_for_voe_ins: "Autre formation - 100%_réussite!",
      cod_aff_form: "00045",
      capa_fin: null,
      voe_tot: null,
      acc_tot: "*",
      fili: "Autre formation",
      lien_form_psup: "javascript:alert(1)",
    },
  ];
}
