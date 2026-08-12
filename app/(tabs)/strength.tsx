import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput, SectionList } from 'react-native';
import { STRENGTH_EXERCISES } from '../../constants/exercises';
import { addSet, getSetsForExercise, updateSet, deleteSet } from '../../database/db';

function calculateE1RM(weight: number, reps: number) {
  return weight * (1 + reps / 30);
}

function groupByDate(sets: any[]) {
  const map = new Map<string, any[]>();
  for (const s of sets) {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date)!.push(s);
  }
  return Array.from(map.entries()).map(([date, data]) => ({ title: date, data }));
}

export default function StrengthScreen() {
  const [selectedExercise, setSelectedExercise] = useState(STRENGTH_EXERCISES[0]);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  function loadSets() {
    setSets(getSetsForExercise(selectedExercise));
  }

  useEffect(() => {
    loadSets();
    resetForm();
  }, [selectedExercise]);

  function resetForm() {
    setWeight('');
    setReps('');
    setEditingId(null);
  }

  function handleSave() {
    if (!weight || !reps) return;
    if (editingId !== null) {
      updateSet(editingId, parseFloat(weight), parseInt(reps));
    } else {
      const today = new Date().toISOString().split('T')[0];
      addSet(selectedExercise, parseFloat(weight), parseInt(reps), today);
    }
    resetForm();
    loadSets();
  }

  function handleEdit(item: any) {
    setWeight(item.weight.toString());
    setReps(item.reps.toString());
    setEditingId(item.id);
  }

  function handleDelete(id: number) {
    deleteSet(id);
    if (editingId === id) resetForm();
    loadSets();
  }

  const best1RM = sets.length > 0 ? Math.max(...sets.map((s) => calculateE1RM(s.weight, s.reps))) : null;
  const sections = groupByDate(sets);

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

      {best1RM !== null && (
        <View style={styles.rmBox}>
          <Text style={styles.rmLabel}>1RM estimé</Text>
          <Text style={styles.rmValue}>{best1RM.toFixed(1)} kg</Text>
        </View>
      )}

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
          <Text style={styles.saveButtonText}>{editingId !== null ? 'Mettre à jour' : 'Enregistrer'}</Text>
        </Pressable>
      </View>

      {editingId !== null && (
        <Pressable onPress={resetForm} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Annuler la modification</Text>
        </Pressable>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id.toString()}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable onPress={() => handleEdit(item)} style={styles.setRow}>
            <View>
              <Text style={styles.setText}>{item.weight} kg × {item.reps}</Text>
              <Text style={styles.setSubText}>e1RM {calculateE1RM(item.weight, item.reps).toFixed(1)} kg</Text>
            </View>
            <Pressable onPress={() => handleDelete(item.id)} hitSlop={10}>
              <Text style={styles.deleteText}>✕</Text>
            </Pressable>
          </Pressable>
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
  rmBox: { backgroundColor: '#111', borderRadius: 8, borderWidth: 1, borderColor: '#D4AF37', padding: 12, marginBottom: 16, alignItems: 'center' },
  rmLabel: { color: '#D4AF37', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  rmValue: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  form: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { flex: 1, backgroundColor: '#111', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#333' },
  saveButton: { backgroundColor: '#D4AF37', borderRadius: 8, justifyContent: 'center', paddingHorizontal: 16 },
  saveButtonText: { color: '#000', fontWeight: 'bold' },
  cancelButton: { marginBottom: 16 },
  cancelText: { color: '#888', textAlign: 'center', fontSize: 13 },
  sectionHeader: { color: '#D4AF37', fontWeight: 'bold', marginTop: 12, marginBottom: 4 },
  setRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#222' },
  setText: { color: '#ccc' },
  setSubText: { color: '#666', fontSize: 12 },
  deleteText: { color: '#666', fontSize: 16, paddingHorizontal: 8 },
  empty: { color: '#666', textAlign: 'center', marginTop: 20 },
});
