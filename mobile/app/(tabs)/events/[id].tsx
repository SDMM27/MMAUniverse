import { View, Text, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getEvent } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../../components/state';
import { FightRow } from '../../../components/cards';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, reload] = useApi(() => getEvent(id), [id]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const { event, fights } = state.data;

  return (
    <FlatList
      className="flex-1 bg-base-bg"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={fights}
      keyExtractor={(fight) => String(fight.id)}
      ListHeaderComponent={
        <View className="mb-4">
          <Text className="font-display text-2xl uppercase text-ink-primary">{event.name}</Text>
          <Text className="text-sm text-ink-secondary">
            {event.date} · {event.event_location}
          </Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListEmptyComponent={<EmptyState message="Aucun combat annoncé pour cet event." />}
      renderItem={({ item }) => <FightRow fight={item} />}
    />
  );
}
