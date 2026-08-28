import { View, Text } from 'react-native';
import type { FighterStats, MethodBreakdown } from '../lib/types';

function pct(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

function MethodRow({
  label,
  count,
  total,
  barColor,
}: {
  label: string;
  count: number;
  total: number;
  barColor: string;
}) {
  const percentage = pct(count, total);
  return (
    <View className="mb-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs uppercase tracking-wide text-ink-secondary">{label}</Text>
        <Text className="text-xs font-semibold text-ink-primary">
          {count} · {percentage}%
        </Text>
      </View>
      <View className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-base-border">
        <View className={`h-full rounded-full ${barColor}`} style={{ width: `${percentage}%` }} />
      </View>
    </View>
  );
}

function RecordColumn({
  label,
  total,
  methods,
  badgeBg,
  badgeText,
  barColor,
}: {
  label: string;
  total: number;
  methods: MethodBreakdown;
  badgeBg: string;
  badgeText: string;
  barColor: string;
}) {
  return (
    <View className="flex-1">
      <View className="mb-2 flex-row items-center gap-2">
        <View className={`rounded px-2 py-0.5 ${badgeBg}`}>
          <Text className={`font-display text-xs uppercase tracking-wide ${badgeText}`}>{label}</Text>
        </View>
        <Text className="font-display text-xl text-ink-primary">{total}</Text>
      </View>
      <MethodRow label="KO/TKO" count={methods.koTko} total={total} barColor={barColor} />
      <MethodRow label="Soumissions" count={methods.submission} total={total} barColor={barColor} />
      <MethodRow label="Décisions" count={methods.decision} total={total} barColor={barColor} />
    </View>
  );
}

export default function FighterRecordCard({ stats }: { stats: FighterStats }) {
  return (
    <View className="rounded-lg border border-base-border bg-base-card p-3">
      {stats.draws > 0 && (
        <Text className="mb-3 text-xs text-ink-secondary">
          {stats.wins}-{stats.losses} · {stats.draws} nul{stats.draws > 1 ? 's' : ''}
        </Text>
      )}
      <View className="flex-row gap-4">
        <RecordColumn
          label="Victoires"
          total={stats.wins}
          methods={stats.winMethods}
          badgeBg="bg-win"
          badgeText="text-base-bg"
          barColor="bg-win"
        />
        <View className="w-px bg-base-border" />
        <RecordColumn
          label="Défaites"
          total={stats.losses}
          methods={stats.lossMethods}
          badgeBg="bg-accent"
          badgeText="text-ink-primary"
          barColor="bg-accent"
        />
      </View>
    </View>
  );
}
