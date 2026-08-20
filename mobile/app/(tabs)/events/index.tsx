import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { getEvents } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { Loading, ErrorState } from '../../../components/state';
import { EventsByStatus } from '../../../components/events-by-status';

export default function EventsScreen() {
  const router = useRouter();
  const [state, reload] = useApi(getEvents, []);
  const [orgFilter, setOrgFilter] = useState<string | null>(null);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const orgs = Array.from(new Set(state.data.map((event) => event.organization_abbreviation)));
  const filtered = orgFilter ? state.data.filter((event) => event.organization_abbreviation === orgFilter) : state.data;

  return (
    <View className="flex-1 bg-base-bg">
      <View className="flex-row gap-2 p-4 pb-0">
        <Pressable
          onPress={() => setOrgFilter(null)}
          className={`rounded-full border px-3 py-1 ${orgFilter === null ? 'border-accent bg-accent' : 'border-base-border bg-base-card'}`}
        >
          <Text className={orgFilter === null ? 'text-white' : 'text-ink-secondary'}>Tous</Text>
        </Pressable>
        {orgs.map((abbreviation) => (
          <Pressable
            key={abbreviation}
            onPress={() => setOrgFilter(abbreviation)}
            className={`rounded-full border px-3 py-1 ${orgFilter === abbreviation ? 'border-accent bg-accent' : 'border-base-border bg-base-card'}`}
          >
            <Text className={orgFilter === abbreviation ? 'text-white' : 'text-ink-secondary'}>{abbreviation}</Text>
          </Pressable>
        ))}
      </View>
      <EventsByStatus
        events={filtered}
        onPressEvent={(event) => router.push(`/events/${event.id}`)}
        emptyUpcoming="Aucun événement à venir pour ce filtre."
        emptyPast="Aucun événement passé pour ce filtre."
      />
    </View>
  );
}
