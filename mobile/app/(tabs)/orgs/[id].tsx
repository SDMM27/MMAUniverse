import { View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getOrg } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { Loading, ErrorState } from '../../../components/state';
import { EventsByStatus } from '../../../components/events-by-status';

export default function OrgDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [state, reload] = useApi(() => getOrg(id), [id]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const { organization, events } = state.data;
  const eventsWithOrg = events.map((event) => ({ ...event, organization_abbreviation: organization.abbreviation }));

  return (
    <EventsByStatus
      events={eventsWithOrg}
      onPressEvent={(event) => router.push(`/events/${event.id}`)}
      emptyUpcoming="Aucun événement à venir pour cette organisation."
      emptyPast="Aucun événement passé pour cette organisation."
      ListHeaderComponent={
        <View>
          <Text className="font-display text-xs uppercase tracking-wide text-accent">{organization.abbreviation}</Text>
          <Text className="font-display text-2xl uppercase text-ink-primary">{organization.name}</Text>
        </View>
      }
    />
  );
}
