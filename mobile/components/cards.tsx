import { View, Text, Image, Pressable } from 'react-native';
import type { EventWithOrganization, FighterWithOrganization, FightWithFighters, Organization } from '../lib/types';

export function OrganizationCard({ organization, onPress }: { organization: Organization; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={organization.name}
      className="flex-row items-center gap-3 rounded-lg border border-base-border bg-base-card p-3"
    >
      <Image source={{ uri: organization.logo_link }} accessible={false} className="h-12 w-12 rounded-full" />
      <View>
        <Text className="font-display text-xs uppercase tracking-wide text-accent">{organization.abbreviation}</Text>
        <Text className="text-base font-semibold text-ink-primary">{organization.name}</Text>
      </View>
    </Pressable>
  );
}

export function EventCard({ event, onPress }: { event: EventWithOrganization; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${event.date}`}
      className="rounded-lg border border-base-border bg-base-card p-3"
    >
      <Text className="font-display text-xs uppercase tracking-wide text-accent">{event.organization_abbreviation}</Text>
      <Text className="text-base font-semibold text-ink-primary">{event.name}</Text>
      <Text className="text-xs text-ink-secondary">
        {event.date} · {event.event_location}
      </Text>
    </Pressable>
  );
}

export function FighterCard({ fighter, onPress }: { fighter: FighterWithOrganization; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${fighter.name}, ${fighter.record}`}
      className="flex-row items-center gap-3 rounded-lg border border-base-border bg-base-card p-3"
    >
      <Image source={{ uri: fighter.image_url }} accessible={false} className="h-12 w-12 rounded-full" />
      <View className="flex-1">
        <Text className="text-base font-semibold text-ink-primary">{fighter.name}</Text>
        <Text className="text-xs text-ink-secondary">
          {fighter.organization_abbreviation} · {fighter.weight_class} · {fighter.record}
        </Text>
      </View>
    </Pressable>
  );
}

export function FightRow({ fight }: { fight: FightWithFighters }) {
  const winnerName =
    fight.winner_id === fight.fighter1?.id
      ? fight.fighter1?.name
      : fight.winner_id === fight.fighter2?.id
        ? fight.fighter2?.name
        : null;

  return (
    <View className="rounded-lg border border-base-border bg-base-card p-3">
      <Text className="text-xs uppercase tracking-wide text-ink-secondary">{fight.weight_class}</Text>
      <View className="flex-row items-center justify-between py-1">
        <Text
          className={`flex-1 text-base font-semibold ${fight.winner_id === fight.fighter1?.id ? 'text-accent' : 'text-ink-primary'}`}
        >
          {fight.fighter1?.name ?? 'TBD'}
        </Text>
        <Text className="px-2 text-ink-secondary">vs</Text>
        <Text
          className={`flex-1 text-right text-base font-semibold ${fight.winner_id === fight.fighter2?.id ? 'text-accent' : 'text-ink-primary'}`}
        >
          {fight.fighter2?.name ?? 'TBD'}
        </Text>
      </View>
      {fight.fight_finished ? (
        <Text className="text-xs text-ink-secondary">
          {winnerName ? `${winnerName} par ${fight.method}` : 'Match nul'} · Round {fight.round} · {fight.time}
        </Text>
      ) : (
        <Text className="text-xs text-ink-secondary">À venir</Text>
      )}
    </View>
  );
}
