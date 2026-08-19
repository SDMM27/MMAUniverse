import { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { getFighters } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../../components/state';
import { FighterCard } from '../../../components/cards';

export default function FightersScreen() {
  const router = useRouter();
  const [state, reload] = useApi(getFighters, []);
  const [orgFilter, setOrgFilter] = useState<string | null>(null);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;

  const orgs = Array.from(new Set(state.data.map((fighter) => fighter.organization_abbreviation)));
  const filtered = orgFilter ? state.data.filter((fighter) => fighter.organization_abbreviation === orgFilter) : state.data;

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
      <FlatList
        contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12 }}
        data={filtered}
        keyExtractor={(fighter) => String(fighter.id)}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={<EmptyState message="Aucun combattant pour ce filtre." />}
        renderItem={({ item }) => <FighterCard fighter={item} onPress={() => router.push(`/fighters/${item.id}`)} />}
      />
    </View>
  );
}
