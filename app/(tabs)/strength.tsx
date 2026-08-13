import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput, FlatList, Dimensions, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LineChart } from 'react-native-chart-kit';
import { STRENGTH_EXERCISES } from '../../constants/exercises';
import { addSet, getAllSets, updateSet, deleteSet, deleteSetsForDate, moveSet } from '../../database/db';

const screenWidth = Dimensions.get('window').width;

const chartConfig = {
  backgroundColor: '#000',
  backgroundGradientFrom: '#000',
  backgroundGradientTo: '#000',
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(212, 175, 55, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(200, 200, 200, ${opacity})`,
  propsForDots: { r: '4', strokeWidth: '2', stroke: '#D4AF37' },
};

function calculateE1RM(weight: number, reps: number) {
  return weight * (1 + reps / 30);
}

function groupBySession(allSets: any[]) {
  const byDate = new Map<string, any[]>();
  for (const s of allSets) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date)!.push(s);
  }
  return Array.from(byDate.entries()).map(([date, setsForDate]) => {
    const byExercise = new Map<string, any[]>();
    for (const s of setsForDate) {
      if (!byExercise.has(s.exercise)) byExercise.set(s.exercise, []);
      byExercise.get(s.exercise)!.push(s);
    }
    return {
      date,
      exercises: Array.from(byExercise.entries()).map(([exercise, sets]) => ({ exercise, sets })),
    };
  });
}

function groupByExercise(setsForDate: any[]) {
  const map = new Map<string, any[]>();
  for (const s of setsForDate) {
    if (!map.has(s.exercise)) map.set(s.exercise, []);
    map.get(s.exercise)!.push(s);
  }
  return Array.from(map.entries()).map(([exercise, sets]) => ({ exercise, sets }));
}

function getProgressionData(history: any[]) {
  const byDate = new Map<string, number>();
  for (const s of history) {
    const e1rm = calculateE1RM(s.weight, s.reps);
    const current = byDate.get(s.date) ?? 0;
    if (e1rm > current) byDate.set(s.date, e1rm);
  }
  const sortedDates = Array.from(byDate.keys()).sort().slice(-10);
  return {
    labels: sortedDates.map((d) => {
      const [, month, day] = d.split('-');
      return `${day}/${month}`;
    }),
    values: sortedDates.map((d) => byDate.get(d)!),
  };
}

function toISODate(date: Date) {
  return date.toISOString().split('T')[0];
}

function isSameDate(a: Date, b: Date) {
  return toISODate(a) === toISODate(b);
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

function formatDateLabel(date: Date) {
  if (isSameDate(date, new Date())) return "Séance d'aujourd'hui";
  if (isSameDate(date, getYesterday())) return "Séance d'hier";
  return `Séance du ${date.toLocaleDateString('fr-FR')}`;
}

function formatISODateLabel(dateStr: string) {
  return formatDateLabel(new Date(dateStr + 'T00:00:00'));
}

export default function StrengthScreen() {
  const [selectedExercise, setSelectedExercise] = useState(STRENGTH_EXERCISES[0]);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [allSets, setAllSets] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [screen, setScreen] = useState<'list' | 'add' | 'chart'>('list');

  function loadAllSets() {
    setAllSets(getAllSets());
  }

  useEffect(() => {
    loadAllSets();
  }, []);

  function resetForm() {
    setWeight('');
    setReps('');
    setEditingId(null);
  }

  function openAdd() {
    setSelectedDate(new Date());
    setSelectedExercise(STRENGTH_EXERCISES[0]);
    setScreen('add');
    resetForm();
  }

  function openSessionForDate(dateStr: string) {
    setSelectedDate(new Date(dateStr + 'T00:00:00'));
    const setsForDate = allSets.filter((s) => s.date === dateStr);
    if (setsForDate.length > 0) {
      setSelectedExercise(setsForDate[0].exercise);
    }
    setScreen('add');
    resetForm();
  }

  function closeAdd() {
    setScreen('list');
    resetForm();
  }

  function handleDeleteSession() {
    Alert.alert(
      'Supprimer cette séance ?',
      `Toutes les séries du ${formatDateLabel(selectedDate)} seront supprimées définitivement.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deleteSetsForDate(currentDateISO);
            resetForm();
            loadAllSets();
            setScreen('list');
          },
        },
      ]
    );
  }

  function openChart() {
    setScreen('chart');
  }

  function closeChart() {
    setScreen('add');
  }

  function handleAdd() {
    if (!weight || !reps) return;
    addSet(selectedExercise, parseFloat(weight), parseInt(reps), toISODate(selectedDate));
    resetForm();
    loadAllSets();
  }

  function handleUpdate() {
    if (!weight || !reps || editingId === null) return;
    updateSet(editingId, parseFloat(weight), parseInt(reps));
    resetForm();
    loadAllSets();
  }

  function handleEdit(item: any) {
    setWeight(item.weight.toString());
    setReps(item.reps.toString());
    setEditingId(item.id);
    setSelectedExercise(item.exercise);
  }

  function handleDelete(id: number) {
    deleteSet(id);
    if (editingId === id) resetForm();
    loadAllSets();
  }

  function handleMove(id: number, direction: 'up' | 'down') {
    moveSet(id, direction);
    loadAllSets();
  }

  const sessionGroups = groupBySession(allSets);
  const currentDateISO = toISODate(selectedDate);
  const currentSessionByExercise = groupByExercise(allSets.filter((s) => s.date === currentDateISO));
  const exerciseHistory = allSets.filter((s) => s.exercise === selectedExercise);
  const best1RM = exerciseHistory.length > 0 ? Math.max(...exerciseHistory.map((s) => calculateE1RM(s.weight, s.reps))) : null;

  if (screen === 'list') {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Séances</Text>
          <Pressable style={styles.addSessionButton} onPress={openAdd}>
            <Text style={styles.addSessionButtonText}>+ Ajouter une séance</Text>
          </Pressable>
        </View>
        <FlatList
          data={sessionGroups}
          keyExtractor={(item) => item.date}
          renderItem={({ item }) => (
            <Pressable onPress={() => openSessionForDate(item.date)} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <Text style={styles.sessionDate}>{formatISODateLabel(item.date)}</Text>
                <Text style={styles.sessionCount}>
                  {item.exercises.length} exercice{item.exercises.length > 1 ? 's' : ''}
                </Text>
              </View>
            </Pressable>
          )}
          contentContainerStyle={styles.sessionListContent}
          ListEmptyComponent={
            <Text style={styles.empty}>Aucune séance enregistrée. Appuie sur "+ Ajouter une séance" pour commencer.</Text>
          }
        />
      </View>
    );
  }

  if (screen === 'chart') {
    const progression = getProgressionData(exerciseHistory);
    return (
      <View style={styles.container}>
        <View style={styles.addHeaderRow}>
          <Pressable onPress={closeChart}>
            <Text style={styles.backText}>‹ Retour</Text>
          </Pressable>
          <Text style={styles.addTitle}>{selectedExercise} — Progression</Text>
        </View>
        {progression.values.length < 2 ? (
          <Text style={styles.empty}>
            Pas encore assez de séances pour tracer un graphique (ajoute au moins 2 séances avec cet exercice).
          </Text>
        ) : (
          <>
            <LineChart
              data={{ labels: progression.labels, datasets: [{ data: progression.values }] }}
              width={screenWidth - 32}
              height={240}
              yAxisSuffix=" kg"
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
            <Text style={styles.chartCaption}>
              1RM estimé par séance ({progression.values.length} dernière{progression.values.length > 1 ? 's' : ''} séances avec {selectedExercise})
            </Text>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.addHeaderRow}>
        <Pressable onPress={closeAdd}>
          <Text style={styles.backText}>‹ Terminé</Text>
        </Pressable>
        <View style={styles.addTitleRow}>
          <Text style={styles.addTitle}>{formatDateLabel(selectedDate)}</Text>
          {currentSessionByExercise.length > 0 && (
            <Pressable onPress={handleDeleteSession}>
              <Text style={styles.deleteSessionText}>Supprimer la séance</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.dateRow}>
        <Pressable
          onPress={() => setSelectedDate(new Date())}
          style={[styles.dateChip, isSameDate(selectedDate, new Date()) && styles.dateChipActive]}>
          <Text style={[styles.dateChipText, isSameDate(selectedDate, new Date()) && styles.dateChipTextActive]}>
            Aujourd'hui
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectedDate(getYesterday())}
          style={[styles.dateChip, isSameDate(selectedDate, getYesterday()) && styles.dateChipActive]}>
          <Text style={[styles.dateChipText, isSameDate(selectedDate, getYesterday()) && styles.dateChipTextActive]}>
            Hier
          </Text>
        </Pressable>
        <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateChip}>
          <Text style={styles.dateChipText}>Autre date</Text>
        </Pressable>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (event.type === 'set' && date) setSelectedDate(date);
          }}
        />
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.exerciseList}
        contentContainerStyle={styles.exerciseListContent}>
        {STRENGTH_EXERCISES.map((exercise) => (
          <Pressable
            key={exercise}
            onPress={() => {
              setSelectedExercise(exercise);
              resetForm();
            }}
            style={[styles.chip, selectedExercise === exercise && styles.chipActive]}>
            <Text style={[styles.chipText, selectedExercise === exercise && styles.chipTextActive]}>{exercise}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {best1RM !== null && (
        <>
          <Text style={styles.rmCaption}>
            1RM estimé pour {selectedExercise} : {best1RM.toFixed(1)} kg
          </Text>
          <Pressable onPress={openChart}>
            <Text style={styles.chartLink}>Voir la progression →</Text>
          </Pressable>
        </>
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
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>Ajouter</Text>
        </Pressable>
        {editingId !== null && (
          <Pressable style={styles.updateButton} onPress={handleUpdate}>
            <Text style={styles.updateButtonText}>Mettre à jour</Text>
          </Pressable>
        )}
      </View>
      {editingId !== null && (
        <Pressable onPress={resetForm} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Annuler la modification</Text>
        </Pressable>
      )}

      <FlatList
        data={currentSessionByExercise}
        keyExtractor={(item) => item.exercise}
        renderItem={({ item }) => (
          <View style={styles.previewExercise}>
            <Text style={styles.previewExerciseName}>{item.exercise}</Text>
            {item.sets.map((s: any) => {
              const isEditing = s.id === editingId;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => handleEdit(s)}
                  style={[styles.setRow, isEditing && styles.setRowActive]}>
                  <View>
                    <Text style={styles.setText}>{s.weight} kg × {s.reps}</Text>
                    <Text style={styles.setSubText}>e1RM {calculateE1RM(s.weight, s.reps).toFixed(1)} kg</Text>
                  </View>
                  <View style={styles.rowActions}>
                    <Pressable onPress={() => handleMove(s.id, 'up')} hitSlop={8}>
                      <Text style={styles.moveText}>▲</Text>
                    </Pressable>
                    <Pressable onPress={() => handleMove(s.id, 'down')} hitSlop={8}>
                      <Text style={styles.moveText}>▼</Text>
                    </Pressable>
                    <Pressable onPress={() => handleDelete(s.id)} hitSlop={8}>
                      <Text style={styles.deleteText}>✕</Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucune série enregistrée pour cette date</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60, paddingHorizontal: 16 },
  headerRow: { marginBottom: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  addSessionButton: { backgroundColor: '#D4AF37', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  addSessionButtonText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  sessionListContent: { paddingBottom: 20 },
  sessionCard: { backgroundColor: '#111', borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#222', padding: 14 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionDate: { color: '#fff', fontWeight: 'bold' },
  sessionCount: { color: '#888', fontSize: 12 },
  empty: { color: '#666', textAlign: 'center', marginTop: 20 },

  addHeaderRow: { marginBottom: 16 },
  backText: { color: '#D4AF37', fontSize: 15, marginBottom: 8 },
  addTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  addTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deleteSessionText: { color: '#c0392b', fontSize: 13 },

  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dateChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#444' },
  dateChipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  dateChipText: { color: '#aaa', fontSize: 13, lineHeight: 18 },
  dateChipTextActive: { color: '#000', fontWeight: 'bold' },

  exerciseList: { flexGrow: 0, height: 48, marginBottom: 8 },
  exerciseListContent: { alignItems: 'center' },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#444', marginRight: 8 },
  chipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  chipText: { color: '#aaa', lineHeight: 18 },
  chipTextActive: { color: '#000', fontWeight: 'bold' },

  rmCaption: { color: '#888', fontSize: 12, marginBottom: 4 },
  chartLink: { color: '#D4AF37', fontSize: 13, marginBottom: 12 },
  chart: { borderRadius: 12, marginVertical: 12 },
  chartCaption: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 4 },

  form: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { flex: 1, backgroundColor: '#111', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#333' },
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  addButton: { flex: 1, backgroundColor: '#D4AF37', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  addButtonText: { color: '#000', fontWeight: 'bold' },
  updateButton: { flex: 1, backgroundColor: '#222', borderRadius: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#D4AF37' },
  updateButtonText: { color: '#D4AF37', fontWeight: 'bold' },
  cancelButton: { marginBottom: 16 },
  cancelText: { color: '#888', textAlign: 'center', fontSize: 13 },

  previewExercise: { marginBottom: 16 },
  previewExerciseName: { color: '#D4AF37', fontWeight: '600', marginBottom: 4 },
  setRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#222' },
  setRowActive: { backgroundColor: '#1a1a1a', borderLeftWidth: 3, borderLeftColor: '#D4AF37', paddingLeft: 8 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  moveText: { color: '#888', fontSize: 14 },
  setText: { color: '#ccc' },
  setSubText: { color: '#666', fontSize: 11 },
  deleteText: { color: '#666', fontSize: 16, paddingHorizontal: 8 },
});
