import { useMemo, useState } from 'react';
import { View, Text, SectionList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { getEvents } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../../components/state';
import { EventCard } from '../../../components/cards';
import type { EventWithOrganization } from '../../../lib/types';

export default function EventsScreen() {
  const router = useRouter();
  const [state, reload] = useApi(getEvents, []);
  const [orgFilter, setOrgFilter] = useState<string | null>(null);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const orgs = Array.from(new Set(state.data.map((event) => event.organization_abbreviation)));
  const filtered = orgFilter ? state.data.filter((event) => event.organization_abbreviation === orgFilter) : state.data;

  const sections = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = filtered
      .filter((event) => event.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    const past = filtered
      .filter((event) => event.date < today)
      .sort((a, b) => b.date.localeCompare(a.date));

    return [
      { title: 'À venir', data: upcoming },
      { title: 'Passés', data: past },
    ].filter((section) => section.data.length > 0);
  }, [filtered]);

  return (
    <View className="flex-1 bg-base-bg">
      <View className="flex-row gap-2 p-4">
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
      <SectionList
        contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12 }}
        sections={sections}
        keyExtractor={(event) => String(event.id)}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        SectionSeparatorComponent={() => <View style={{ height: 12 }} />}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={<EmptyState message="Aucun événement pour ce filtre." />}
        renderSectionHeader={({ section }) => (
          <Text className="pb-2 font-display text-sm uppercase tracking-wide text-ink-secondary">
            {section.title}
          </Text>
        )}
        renderItem={({ item }: { item: EventWithOrganization }) => (
          <EventCard event={item} onPress={() => router.push(`/events/${item.id}`)} />
        )}
      />
    </View>
  );
}
