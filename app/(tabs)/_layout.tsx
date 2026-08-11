import { Tabs } from 'expo-router';
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
    </Tabs>
  );
}
