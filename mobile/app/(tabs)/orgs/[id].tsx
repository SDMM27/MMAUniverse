import { View, Text, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getOrg } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../../components/state';
import { EventCard } from '../../../components/cards';

export default function OrgDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [state, reload] = useApi(() => getOrg(id), [id]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const { organization, events } = state.data;

  return (
    <FlatList
      className="flex-1 bg-base-bg"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={events}
      keyExtractor={(event) => String(event.id)}
      ListHeaderComponent={
        <View className="mb-4">
          <Text className="font-display text-xs uppercase tracking-wide text-accent">{organization.abbreviation}</Text>
          <Text className="font-display text-2xl uppercase text-ink-primary">{organization.name}</Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListEmptyComponent={<EmptyState message="Aucun événement programmé pour cette organisation." />}
      renderItem={({ item }) => (
        <EventCard
          event={{ ...item, organization_abbreviation: organization.abbreviation }}
          onPress={() => router.push(`/events/${item.id}`)}
        />
      )}
    />
  );
}
