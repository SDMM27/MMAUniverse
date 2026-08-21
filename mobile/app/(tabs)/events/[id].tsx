import { View, Text, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getEvent } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { splitMainEvent } from '../../../lib/fight-utils';
import { Loading, ErrorState, EmptyState } from '../../../components/state';
import { FightRow, FightCard } from '../../../components/cards';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, reload] = useApi(() => getEvent(id), [id]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const { event, fights } = state.data;
  const { mainEvent, rest } = splitMainEvent(fights);

  return (
    <FlatList
      className="flex-1 bg-base-bg"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={rest}
      keyExtractor={(fight) => String(fight.id)}
      ListHeaderComponent={
        <View className="mb-4 gap-4">
          <View>
            <Text className="font-display text-2xl uppercase text-ink-primary">{event.name}</Text>
            <Text className="text-sm text-ink-secondary">
              {event.date} · {event.event_location}
            </Text>
          </View>
          {mainEvent && <FightCard fight={mainEvent} event={event} onPress={() => {}} />}
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListEmptyComponent={fights.length === 0 ? <EmptyState message="Aucun combat annoncé pour cet event." /> : null}
      renderItem={({ item }) => <FightRow fight={item} />}
    />
  );
}
