import { View, Text, Image, Pressable } from 'react-native';
import type { EventWithOrganization, Fighter, FighterWithOrganization, FightWithFighters, Organization } from '../lib/types';
import { countryCodeToFlag } from '../lib/flag-utils';

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

type FightStatus = 'upcoming' | 'live' | 'finished';

const resultLabel: Record<'win' | 'loss' | 'draw', string> = { win: 'V', loss: 'D', draw: 'N' };
const resultColor: Record<'win' | 'loss' | 'draw', string> = {
  win: 'text-win',
  loss: 'text-accent',
  draw: 'text-ink-secondary',
};

export function FightCard({
  fight,
  event,
  onPress,
  live,
}: {
  fight: FightWithFighters;
  event: { id: number; date: string; organization_abbreviation: string };
  onPress: () => void;
  live?: { round: number };
}) {
  if (!fight.fighter1 || !fight.fighter2) {
    return (
      <View className="rounded-lg border border-base-border bg-base-card p-4">
        <Text className="text-sm text-ink-secondary">Données des combattants indisponibles pour ce combat.</Text>
      </View>
    );
  }

  const status: FightStatus = fight.fight_finished ? 'finished' : live ? 'live' : 'upcoming';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        status === 'finished'
          ? `${fight.fighter1.name} contre ${fight.fighter2.name}, terminé`
          : status === 'live'
            ? `${fight.fighter1.name} contre ${fight.fighter2.name}, en direct, round ${live?.round}`
            : `${fight.fighter1.name} contre ${fight.fighter2.name}, ${event.date}`
      }
      className="flex flex-col gap-4 rounded-lg border border-base-border bg-base-card p-4"
    >
      <FightCardHeader status={status} event={event} liveRound={live?.round} />
      <View className="flex-row items-center justify-between gap-3">
        <FightCardFighterColumn fighter={fight.fighter1} status={status} winnerId={fight.winner_id} />
        <FightCardCenter status={status} fight={fight} />
        <FightCardFighterColumn fighter={fight.fighter2} status={status} winnerId={fight.winner_id} />
      </View>
      <Text className="border-t border-base-border pt-2 text-center font-display text-xs uppercase tracking-wide text-accent">
        Événement principal
      </Text>
    </Pressable>
  );
}

function FightCardHeader({
  status,
  event,
  liveRound,
}: {
  status: FightStatus;
  event: { date: string; organization_abbreviation: string };
  liveRound?: number;
}) {
  if (status === 'live') {
    return (
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5 rounded bg-accent px-2 py-0.5">
          <View className="h-1.5 w-1.5 rounded-full bg-white" />
          <Text className="font-display text-[10px] uppercase tracking-wide text-white">En direct</Text>
        </View>
        <Text className="text-xs text-ink-secondary">Round {liveRound}</Text>
      </View>
    );
  }

  if (status === 'finished') {
    return (
      <View className="flex-row items-center justify-between">
        <Text className="font-display text-xs uppercase tracking-wide text-accent">{event.organization_abbreviation}</Text>
        <Text className="rounded border border-base-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-secondary">
          Terminé
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-display text-xs uppercase tracking-wide text-accent">{event.organization_abbreviation}</Text>
      <Text className="text-xs text-ink-secondary">{event.date}</Text>
    </View>
  );
}

function FightCardFighterColumn({
  fighter,
  status,
  winnerId,
}: {
  fighter: Fighter;
  status: FightStatus;
  winnerId: number | null;
}) {
  const flag = countryCodeToFlag(fighter.nationality);
  const result = winnerId === null ? 'draw' : winnerId === fighter.id ? 'win' : 'loss';

  return (
    <View className="flex-1 items-center gap-1">
      <Image source={{ uri: fighter.image_url }} accessible={false} className="h-12 w-12 rounded-full" />
      {flag && <Text className="text-sm">{flag}</Text>}
      <Text className="font-display text-sm uppercase tracking-wide text-ink-primary">{fighter.name}</Text>
      {status === 'finished' ? (
        <Text className={`font-display text-lg font-bold ${resultColor[result]}`}>{resultLabel[result]}</Text>
      ) : (
        fighter.ranking > 0 && (
          <Text className="text-[10px] font-bold uppercase tracking-wide text-accent">#{fighter.ranking}</Text>
        )
      )}
    </View>
  );
}

function FightCardCenter({ status, fight }: { status: FightStatus; fight: FightWithFighters }) {
  if (status === 'live') {
    return <View className="h-2 w-2 rounded-full bg-accent" />;
  }

  if (status === 'finished') {
    const parts = [fight.method, fight.round ? `Round ${fight.round}` : null].filter(Boolean);
    return (
      <Text className="text-center text-xs text-ink-secondary">
        {parts.length > 0 ? parts.join(' · ') : 'Résultat non précisé'}
      </Text>
    );
  }

  return <Text className="text-xs font-bold text-ink-secondary">VS</Text>;
}
