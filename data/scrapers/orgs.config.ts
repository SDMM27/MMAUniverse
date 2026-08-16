// data/scrapers/orgs.config.ts
import type { OrgScrapeConfig } from './sherdog';

export const ORG_CONFIGS: OrgScrapeConfig[] = [
  { orgKey: 'ufc', organizationId: 1, sherdogOrgPath: 'organizations/Ultimate-Fighting-Championship-UFC-2' },
  { orgKey: 'pfl', organizationId: 2, sherdogOrgPath: 'organizations/Professional-Fighters-League-12241' },
  { orgKey: 'bellator', organizationId: 3, sherdogOrgPath: 'organizations/Bellator-MMA-1960' },
];
