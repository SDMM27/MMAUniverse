import { View, Text, ScrollView, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { getHome } from '../../lib/api';
import { useApi } from '../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../components/state';
import { OrganizationCard, FightCard, EventCard } from '../../components/cards';

export default function HomeScreen() {
  const router = useRouter();
  const [state, reload] = useApi(getHome, []);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const { nextEvent, organizations, fights, weeklyEvents } = state.data;
  // is_main_event is never actually set to true anywhere in the
  // scrapers/seed, so there's no reliable flag to pick "the" main event out
  // of `fights`. The API orders fights `is_main_event DESC, id ASC` (see
  // data/lib/data.ts), so the first fetched fight is the closest thing to a
  // main event the data supports today.
  const mainEvent = fights[0] ?? null;

  return (
    <ScrollView className="flex-1 bg-base-bg" contentContainerStyle={{ padding: 16, gap: 24 }}>
      {nextEvent ? (
        <Pressable
          onPress={() => router.push(`/events/${nextEvent.event.id}`)}
          className="overflow-hidden rounded-xl border border-base-border bg-base-card"
        >
          {nextEvent.event.event_poster ? (
            <Image source={{ uri: nextEvent.event.event_poster }} className="h-40 w-full" resizeMode="cover" />
          ) : null}
          <View className="p-4">
            <Text className="font-display text-xs uppercase tracking-wide text-accent">
              {nextEvent.isUpcoming ? 'Prochain event' : 'Dernier event'} · {nextEvent.event.organization_abbreviation}
            </Text>
            <Text className="mt-1 font-display text-xl uppercase text-ink-primary">{nextEvent.event.name}</Text>
            <Text className="mt-1 text-sm text-ink-secondary">
              {nextEvent.event.date} · {nextEvent.event.event_location}
            </Text>
          </View>
        </Pressable>
      ) : (
        <EmptyState message="Aucun event à afficher pour le moment." />
      )}

      {mainEvent && nextEvent && (
        <FightCard
          fight={mainEvent}
          event={nextEvent.event}
          onPress={() => router.push(`/events/${nextEvent.event.id}`)}
        />
      )}

      {weeklyEvents.length > 0 && (
        <View className="gap-3">
          <Text className="font-display text-lg uppercase text-ink-primary">Cette semaine</Text>
          {weeklyEvents.map((event) => (
            <EventCard key={event.id} event={event} onPress={() => router.push(`/events/${event.id}`)} />
          ))}
        </View>
      )}

      <View className="gap-3">
        <Text className="font-display text-lg uppercase text-ink-primary">Organisations</Text>
        {organizations.map((org) => (
          <OrganizationCard key={org.id} organization={org} onPress={() => router.push(`/orgs/${org.id}`)} />
        ))}
      </View>
    </ScrollView>
  );
}
