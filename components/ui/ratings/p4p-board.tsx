'use client';

import { useState } from 'react';
import { FighterRatingWithFighter } from '@/data/lib/definitions';
import PoundForPoundList from './pound-for-pound-list';

type Tab = 'Hommes' | 'Femmes';

// Homepage pound-for-pound: men's / women's lists behind two tabs. Switching
// remounts the list so its cascade plays again.
export default function P4PBoard({ men, women, heading }: { men: FighterRatingWithFighter[]; women: FighterRatingWithFighter[]; heading: React.ReactNode }) {
  const tabs = (['Hommes', 'Femmes'] as Tab[]).filter((tab) => (tab === 'Hommes' ? men : women).length > 0);
  const [tab, setTab] = useState<Tab>(tabs[0] ?? 'Hommes');
  const fighters = tab === 'Hommes' ? men : women;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        {heading}
        {tabs.length > 1 && (
          <div role="tablist" aria-label="Classement pound-for-pound" className="flex border-2 border-ink">
            {tabs.map((label) => {
              const on = label === tab;
              return (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  id={`p4p-tab-${label}`}
                  aria-selected={on}
                  aria-controls="p4p-panel"
                  onClick={() => setTab(label)}
                  className={`min-h-11 px-5 font-display text-lg uppercase tracking-[0.04em] transition-colors ${
                    on ? 'bg-ink text-bg' : 'text-ink hover:bg-surface-2'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div id="p4p-panel" role="tabpanel" aria-labelledby={`p4p-tab-${tab}`}>
        <PoundForPoundList key={tab} fighters={fighters} />
      </div>
    </div>
  );
}
