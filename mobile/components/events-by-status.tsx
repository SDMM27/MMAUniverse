import { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { splitEventsByStatus } from '../lib/event-utils';
import { EmptyState } from './state';
import { EventCard } from './cards';
import type { EventWithOrganization } from '../lib/types';

type Tab = 'upcoming' | 'past';

/**
 * Segmented À venir / Passés toggle above an event list, mirrors the web
 * EventsByStatus component. Defaults to whichever group has events when the
 * other is empty.
 */
export function EventsByStatus<T extends EventWithOrganization>({
  events,
  onPressEvent,
  emptyUpcoming = 'Aucun événement à venir.',
  emptyPast = 'Aucun événement passé.',
  ListHeaderComponent,
}: {
  events: T[];
  onPressEvent: (event: T) => void;
  emptyUpcoming?: string;
  emptyPast?: string;
  ListHeaderComponent?: React.ReactElement;
}) {
  const { upcoming, past } = splitEventsByStatus(events);
  const [tab, setTab] = useState<Tab>(upcoming.length === 0 && past.length > 0 ? 'past' : 'upcoming');

  const active = tab === 'upcoming' ? upcoming : past;
  const emptyMessage = tab === 'upcoming' ? emptyUpcoming : emptyPast;

  return (
    <FlatList
      className="flex-1 bg-base-bg"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={active}
      keyExtractor={(event) => String(event.id)}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={
        <View className="gap-4">
          {ListHeaderComponent}
          <View className="flex-row gap-2">
            {(
              [
                ['upcoming', `À venir (${upcoming.length})`],
                ['past', `Passés (${past.length})`],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setTab(value)}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === value }}
                className={`rounded-full border px-3 py-1 ${tab === value ? 'border-accent bg-accent' : 'border-base-border bg-base-card'}`}
              >
                <Text className={tab === value ? 'text-white' : 'text-ink-secondary'}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={<EmptyState message={emptyMessage} />}
      renderItem={({ item }) => <EventCard event={item} onPress={() => onPressEvent(item)} />}
    />
  );
}
