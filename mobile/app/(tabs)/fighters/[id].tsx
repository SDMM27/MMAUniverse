import { View, Text, Image, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getFighter } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../../components/state';

const RESULT_LABEL: Record<string, string> = { win: 'V', loss: 'D', draw: 'N', upcoming: 'À venir' };
const RESULT_COLOR: Record<string, string> = {
  win: 'text-accent',
  loss: 'text-ink-secondary',
  draw: 'text-ink-secondary',
  upcoming: 'text-ink-secondary',
};

export default function FighterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, reload] = useApi(() => getFighter(id), [id]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const { fighter, fights, stats } = state.data;

  return (
    <FlatList
      className="flex-1 bg-base-bg"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={fights}
      keyExtractor={(fight) => String(fight.id)}
      ListHeaderComponent={
        <View className="mb-4 gap-4">
          <View className="flex-row items-center gap-4">
            <Image source={{ uri: fighter.image_url }} className="h-20 w-20 rounded-full" />
            <View>
              <Text className="font-display text-xs uppercase tracking-wide text-accent">
                {fighter.organization_abbreviation} · {fighter.weight_class}
              </Text>
              <Text className="font-display text-2xl uppercase text-ink-primary">{fighter.name}</Text>
              <Text className="text-sm text-ink-secondary">{fighter.record}</Text>
            </View>
          </View>
          <View className="flex-row justify-between rounded-lg border border-base-border bg-base-card p-3">
            <Text className="text-ink-secondary">V {stats.wins}</Text>
            <Text className="text-ink-secondary">D {stats.losses}</Text>
            <Text className="text-ink-secondary">N {stats.draws}</Text>
            <Text className="text-ink-secondary">KO {stats.ko}</Text>
            <Text className="text-ink-secondary">Sub {stats.submission}</Text>
            <Text className="text-ink-secondary">Déc {stats.decision}</Text>
          </View>
          <Text className="font-display text-lg uppercase text-ink-primary">Historique</Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      ListEmptyComponent={<EmptyState message="Aucun combat enregistré." />}
      renderItem={({ item }) => (
        <View className="flex-row items-center justify-between rounded-lg border border-base-border bg-base-card p-3">
          <View>
            <Text className="text-base font-semibold text-ink-primary">vs {item.opponent_name ?? 'Adversaire inconnu'}</Text>
            <Text className="text-xs text-ink-secondary">
              {item.event_name} · {item.event_date}
            </Text>
          </View>
          <Text className={`font-display text-lg ${RESULT_COLOR[item.result]}`}>{RESULT_LABEL[item.result]}</Text>
        </View>
      )}
    />
  );
}
