// mobile/components/fighter-photo.tsx
//
// Root-cause of the "fighter detail screen shows no images at all" bug: RN's
// core <Image> renders nothing — not even a broken-image box — once its
// network request fails, and every fighter/event photo in this app is a
// bare <Image source={{uri}}> with no error handling. In this repo's own dev
// sandbox, Sherdog rejects the request outright (its hotlink protection
// checks Referer, and a plain <img>/<Image> load from any non-sherdog.com
// origin gets rejected — confirmed directly: a raw same-URL <img> tag fails
// to load here too, it's not React/Expo-specific), so the photo — and
// anything sharing its ListHeaderComponent, since FlatList still renders
// that fine — silently disappears instead of showing anything. The
// equivalent web component (components/ui/shared/media.tsx's CoverImage)
// already guards against exactly this with an onError fallback; this brings
// the same behavior to mobile, wired into the fighter detail screen where
// it was reported.
import { useState } from 'react';
import { Image, Text, View } from 'react-native';

export function FighterPhoto({
  uri,
  name,
  className,
}: {
  uri?: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    // First letter of the fighter's name — no icon asset needed, and still
    // identifies which placeholder is which when several show at once.
    const initial = name.trim().charAt(0).toUpperCase() || '?';
    return (
      <View className={`items-center justify-center bg-base-border ${className ?? ''}`}>
        <Text className="font-display text-lg text-ink-secondary/60">{initial}</Text>
      </View>
    );
  }

  return <Image source={{ uri }} className={className} onError={() => setFailed(true)} />;
}
