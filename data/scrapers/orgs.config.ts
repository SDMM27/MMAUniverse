// data/scrapers/orgs.config.ts
import type { OrgScrapeConfig } from './sherdog';

export const ORG_CONFIGS: OrgScrapeConfig[] = [
  { orgKey: 'ufc', organizationId: 1, sherdogOrgPath: 'organizations/Ultimate-Fighting-Championship-UFC-2' },
  { orgKey: 'pfl', organizationId: 2, sherdogOrgPath: 'organizations/Professional-Fighters-League-12241' },
  { orgKey: 'bellator', organizationId: 3, sherdogOrgPath: 'organizations/Bellator-MMA-1960' },
  { orgKey: 'one', organizationId: 4, sherdogOrgPath: 'organizations/ONE-Championship-3877' },
  { orgKey: 'cagewarriors', organizationId: 5, sherdogOrgPath: 'organizations/Cage-Warriors-Fighting-Championship-186' },
  { orgKey: 'rizin', organizationId: 6, sherdogOrgPath: 'organizations/Rizin-Fighting-Federation-10333' },
  { orgKey: 'ksw', organizationId: 7, sherdogOrgPath: 'organizations/Konfrontacja-Sztuk-Walki-668' },
  { orgKey: 'aca', organizationId: 8, sherdogOrgPath: 'organizations/Absolute-Championship-Akhmat-8185' },
  { orgKey: 'invicta', organizationId: 9, sherdogOrgPath: 'organizations/Invicta-Fighting-Championships-4469' },
  { orgKey: 'lfa', organizationId: 10, sherdogOrgPath: 'organizations/Legacy-Fighting-Alliance-LFA-11339' },
];
