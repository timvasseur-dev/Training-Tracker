import { StyleSheet, Text, View } from 'react-native';

export default function StrengthScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Strength</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
});
