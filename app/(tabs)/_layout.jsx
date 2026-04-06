import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // Tab bar height: icon+label area (49 iOS / 60 Android) + bottom safe area
  const tabBarHeight = Platform.OS === 'android' ? 60 : 49 + insets.bottom;
  const tabBarPaddingBottom = Platform.OS === 'android' ? 8 : insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#B38B6D',
        tabBarStyle: {
          backgroundColor: '#FFF8F0',
          borderTopColor: '#F0E0D0',
          borderTopWidth: 1,
          elevation: 8,
          shadowColor: '#2D1B00',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        headerStyle: {
          backgroundColor: '#FFF8F0',
          elevation: 1,
          shadowOpacity: 0.08,
        },
        headerTitleStyle: {
          fontSize: 17,
          fontWeight: '700',
          color: '#2D1B00',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Recipes',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: 'Shopping',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cart' : 'cart-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Tracker',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'fitness' : 'fitness-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
