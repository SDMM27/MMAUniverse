import { View, Text, ActivityIndicator, Pressable } from 'react-native';

export function Loading() {
  return (
    <View
      className="flex-1 items-center justify-center bg-base-bg"
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement"
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator color="#ff3b30" />
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View
      className="flex-1 items-center justify-center bg-base-bg p-6"
      accessibilityLiveRegion="polite"
    >
      <Text className="text-center text-ink-secondary">{message}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View
      className="flex-1 items-center justify-center gap-4 bg-base-bg p-6"
      accessibilityLiveRegion="assertive"
    >
      <Text className="text-center text-ink-secondary">{message}</Text>
      <Pressable
        onPress={onRetry}
        className="rounded-md bg-accent px-4 py-2"
        accessibilityRole="button"
        accessibilityLabel="Réessayer"
      >
        <Text className="font-bold text-white">Réessayer</Text>
      </Pressable>
    </View>
  );
}
