import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput, FlatList } from 'react-native';
import { STRENGTH_EXERCISES } from '../../constants/exercises';
import { addSet, getSetsForExercise } from '../../database/db';

export default function StrengthScreen() {
  const [selectedExercise, setSelectedExercise] = useState(STRENGTH_EXERCISES[0]);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState<any[]>([]);

  function loadSets() {
    setSets(getSetsForExercise(selectedExercise));
  }

  useEffect(() => {
    loadSets();
  }, [selectedExercise]);

  function handleSave() {
    if (!weight || !reps) return;
    const today = new Date().toISOString().split('T')[0];
    addSet(selectedExercise, parseFloat(weight), parseInt(reps), today);
    setWeight('');
    setReps('');
    loadSets();
  }

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exerciseList}>
        {STRENGTH_EXERCISES.map((exercise) => (
          <Pressable
            key={exercise}
            onPress={() => setSelectedExercise(exercise)}
            style={[styles.chip, selectedExercise === exercise && styles.chipActive]}>
            <Text style={[styles.chipText, selectedExercise === exercise && styles.chipTextActive]}>
              {exercise}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Charge (kg)"
          placeholderTextColor="#666"
          keyboardType="numeric"
          value={weight}
          onChangeText={setWeight}
        />
        <TextInput
          style={styles.input}
          placeholder="Reps"
          placeholderTextColor="#666"
          keyboardType="numeric"
          value={reps}
          onChangeText={setReps}
        />
        <Pressable style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Enregistrer</Text>
        </Pressable>
      </View>

      <FlatList
        data={sets}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.setRow}>
            <Text style={styles.setText}>{item.date}</Text>
            <Text style={styles.setText}>{item.weight} kg × {item.reps}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucune série enregistrée</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60, paddingHorizontal: 16 },
  exerciseList: { flexGrow: 0, marginBottom: 16 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#444', marginRight: 8 },
  chipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  chipText: { color: '#aaa' },
  chipTextActive: { color: '#000', fontWeight: 'bold' },
  form: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  input: { flex: 1, backgroundColor: '#111', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#333' },
  saveButton: { backgroundColor: '#D4AF37', borderRadius: 8, justifyContent: 'center', paddingHorizontal: 16 },
  saveButtonText: { color: '#000', fontWeight: 'bold' },
  setRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  setText: { color: '#ccc' },
  empty: { color: '#666', textAlign: 'center', marginTop: 20 },
});
