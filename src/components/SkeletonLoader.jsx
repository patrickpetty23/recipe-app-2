import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

function SkeletonBlock({ width, height, borderRadius, style }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius: borderRadius ?? 6, opacity: pulse },
        style,
      ]}
    />
  );
}

export function RecipeCardSkeleton() {
  return (
    <View style={styles.cardRow}>
      <SkeletonBlock width={56} height={56} borderRadius={10} />
      <View style={styles.cardLines}>
        <SkeletonBlock width="70%" height={16} borderRadius={4} style={styles.lineGap} />
        <SkeletonBlock width="40%" height={12} borderRadius={4} />
      </View>
    </View>
  );
}

export function ShoppingItemSkeleton() {
  return (
    <View style={styles.itemRow}>
      <SkeletonBlock width={24} height={24} borderRadius={12} />
      <View style={styles.itemLines}>
        <SkeletonBlock width="55%" height={15} borderRadius={4} style={styles.lineGap} />
        <SkeletonBlock width="30%" height={11} borderRadius={4} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#E5E5EA',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
    gap: 14,
  },
  cardLines: {
    flex: 1,
  },
  lineGap: {
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
    gap: 12,
  },
  itemLines: {
    flex: 1,
  },
});
