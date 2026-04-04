import { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

export default function SwipeableRow({ children, onDelete, deleteLabel }) {
  const swipeRef = useRef(null);

  function renderRightActions(progress, dragX) {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.8],
      extrapolate: 'clamp',
    });

    function handlePress() {
      swipeRef.current?.close();
      onDelete?.();
    }

    return (
      <TouchableOpacity style={styles.deleteAction} onPress={handlePress} activeOpacity={0.8}>
        <Animated.Text style={[styles.deleteLabel, { transform: [{ scale }] }]}>
          {deleteLabel ?? 'Delete'}
        </Animated.Text>
      </TouchableOpacity>
    );
  }

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      friction={2}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  deleteLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
