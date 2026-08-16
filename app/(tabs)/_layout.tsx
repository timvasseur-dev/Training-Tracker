import { Tabs, router } from 'expo-router';
import { Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#D4AF37',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { backgroundColor: '#000' },
        headerStyle: { backgroundColor: '#000' },
        headerTintColor: '#fff',
        headerRight: () => (
          <Pressable onPress={() => router.push('/profile')} style={{ marginRight: 16 }}>
            <Ionicons name="settings-outline" size={22} color="#D4AF37" />
          </Pressable>
        ),
      }}>
      <Tabs.Screen
        name="strength"
        options={{ title: 'Strength', tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="running"
        options={{ title: 'Running', tabBarIcon: ({ color, size }) => <Ionicons name="walk-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="crossfit"
        options={{ title: 'Crossfit WOD', tabBarIcon: ({ color, size }) => <Ionicons name="flame-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: 'Calendrier', tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
