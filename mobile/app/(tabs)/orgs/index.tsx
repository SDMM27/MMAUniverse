import { View, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { getOrgs } from '../../../lib/api';
import { useApi } from '../../../lib/use-api';
import { Loading, ErrorState, EmptyState } from '../../../components/state';
import { OrganizationCard } from '../../../components/cards';

export default function OrgsScreen() {
  const router = useRouter();
  const [state, reload] = useApi(getOrgs, []);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={reload} />;
  if (state.data.length === 0) return <EmptyState message="Aucune organisation." />;

  return (
    <FlatList
      className="flex-1 bg-base-bg"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={state.data}
      keyExtractor={(org) => String(org.id)}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      renderItem={({ item }) => <OrganizationCard organization={item} onPress={() => router.push(`/orgs/${item.id}`)} />}
    />
  );
}
