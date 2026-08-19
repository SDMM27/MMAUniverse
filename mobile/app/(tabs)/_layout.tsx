import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ children }: { children: string }) {
  return <Text style={{ fontSize: 18 }}>{children}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0a0a0a' },
        headerTintColor: '#f5f5f5',
        tabBarStyle: { backgroundColor: '#161616', borderTopColor: '#262626' },
        tabBarActiveTintColor: '#ff3b30',
        tabBarInactiveTintColor: '#9a9a9a',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: () => <TabIcon>🏠</TabIcon> }} />
      <Tabs.Screen name="events/index" options={{ title: 'Events', tabBarIcon: () => <TabIcon>📅</TabIcon> }} />
      <Tabs.Screen name="events/[id]" options={{ href: null, title: 'Event' }} />
      <Tabs.Screen name="fighters/index" options={{ title: 'Fighters', tabBarIcon: () => <TabIcon>🥊</TabIcon> }} />
      <Tabs.Screen name="fighters/[id]" options={{ href: null, title: 'Fighter' }} />
      <Tabs.Screen name="orgs/index" options={{ title: 'Orgs', tabBarIcon: () => <TabIcon>🏷️</TabIcon> }} />
      <Tabs.Screen name="orgs/[id]" options={{ href: null, title: 'Organization' }} />
    </Tabs>
  );
}
