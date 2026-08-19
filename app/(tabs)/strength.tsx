import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, FlatList, Dimensions, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LineChart } from 'react-native-chart-kit';
import * as Haptics from 'expo-haptics';
import { STRENGTH_EXERCISES } from '../../constants/exercises';
import { addSet, getAllSets, updateSet, deleteSet, deleteSetsForDate, moveSet, saveNoteForDate, getAllNotes, saveSessionLoadForDate, getBest1RMForExercise } from '../../database/db';
import { toISODate, isSameDate, getYesterday, formatDateLabel, formatISODateLabel } from '../../utils/dates';

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

export default function StrengthScreen() {
  const [selectedExercise, setSelectedExercise] = useState(STRENGTH_EXERCISES[0]);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [allSets, setAllSets] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [screen, setScreen] = useState<'list' | 'view' | 'add' | 'chart'>('list');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [sessionDurations, setSessionDurations] = useState<Record<string, string>>({});
  const [sessionRpes, setSessionRpes] = useState<Record<string, string>>({});
  const [chartReturnScreen, setChartReturnScreen] = useState<'add' | 'view'>('add');
  const [searchQuery, setSearchQuery] = useState('');

  function loadAllSets() {
    setAllSets(getAllSets());
  }

  function handleNoteChange(text: string) {
    saveNoteForDate(currentDateISO, text);
    setNotes((prev) => ({ ...prev, [currentDateISO]: text }));
  }

  function handleSessionMetaChange(durationText: string, rpeText: string) {
    setSessionDurations((prev) => ({ ...prev, [currentDateISO]: durationText }));
    setSessionRpes((prev) => ({ ...prev, [currentDateISO]: rpeText }));
    const durationMin = durationText ? parseFloat(durationText) : null;
    const rpe = rpeText ? parseFloat(rpeText) : null;
    const trainingLoad = durationMin && rpe ? durationMin * rpe : null;
    saveSessionLoadForDate(currentDateISO, durationMin, trainingLoad);
  }

  useEffect(() => {
    loadAllSets();
    const rows = getAllNotes();
    const noteMap: Record<string, string> = {};
    const durMap: Record<string, string> = {};
    const rpeMap: Record<string, string> = {};
    for (const r of rows) {
      noteMap[r.date] = r.note ?? '';
      if (r.duration_min != null) durMap[r.date] = r.duration_min.toString();
      if (r.duration_min && r.training_load != null) rpeMap[r.date] = (r.training_load / r.duration_min).toString();
    }
    setNotes(noteMap);
    setSessionDurations(durMap);
    setSessionRpes(rpeMap);
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
    setScreen('view');
    resetForm();
  }

  function closeAdd() {
    setScreen('list');
    resetForm();
  }

  function openChart() {
    setChartReturnScreen('add');
    setScreen('chart');
  }

  function closeChart() {
    setScreen(chartReturnScreen);
  }

  function handleAdd() {
    if (!weight || !reps) return;
    const w = parseFloat(weight);
    const r = parseInt(reps);
    const previousBest = getBest1RMForExercise(selectedExercise);
    const newE1RM = w * (1 + r / 30);
    addSet(selectedExercise, w, r, toISODate(selectedDate));
    resetForm();
    loadAllSets();
    if (newE1RM > previousBest && previousBest > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('🏆 Nouveau record !', `${selectedExercise} : ${newE1RM.toFixed(1)} kg estimé (ancien : ${previousBest.toFixed(1)} kg)`);
    }
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

  function handleDeleteSessionFromList(dateStr: string) {
    Alert.alert(
      'Supprimer cette séance ?',
      `Toutes les séries du ${formatISODateLabel(dateStr)} seront supprimées définitivement.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deleteSetsForDate(dateStr);
            saveNoteForDate(dateStr, '');
            setNotes((prev) => {
              const copy = { ...prev };
              delete copy[dateStr];
              return copy;
            });
            loadAllSets();
          },
        },
      ]
    );
  }

  const sessionGroups = groupBySession(allSets);
  const filteredSessionGroups = searchQuery.trim() === ''
    ? sessionGroups
    : sessionGroups.filter((session) => {
        const q = searchQuery.toLowerCase();
        const dateMatch = formatISODateLabel(session.date).toLowerCase().includes(q) || session.date.includes(q);
        const exerciseMatch = session.exercises.some((ex: any) => ex.exercise.toLowerCase().includes(q));
        return dateMatch || exerciseMatch;
      });
  const currentDateISO = toISODate(selectedDate);
  const currentSessionByExercise = groupByExercise(allSets.filter((s) => s.date === currentDateISO));
  const exerciseHistory = allSets.filter((s) => s.exercise === selectedExercise);
  const best1RM = exerciseHistory.length > 0 ? Math.max(...exerciseHistory.map((s) => calculateE1RM(s.weight, s.reps))) : null;

  if (screen === 'list') {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable style={styles.addSessionButton} onPress={openAdd}>
            <Text style={styles.addSessionButtonText}>+ Ajouter une séance</Text>
          </Pressable>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher (exercice, date...)"
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <FlatList
          data={filteredSessionGroups}
          keyExtractor={(item) => item.date}
          renderItem={({ item }) => (
            <View style={styles.sessionCard}>
              <Pressable onPress={() => openSessionForDate(item.date)} style={styles.sessionInfo}>
                <View style={styles.sessionInfoRow}>
                  <Text style={styles.sessionDate}>{formatISODateLabel(item.date)}</Text>
                  <Text style={styles.sessionCount}>
                    {item.exercises.length} exercice{item.exercises.length > 1 ? 's' : ''}
                  </Text>
                </View>
                {notes[item.date] ? (
                  <Text style={styles.sessionNotePreview} numberOfLines={1}>📝 {notes[item.date]}</Text>
                ) : null}
              </Pressable>
              <Pressable
                onPress={() => handleDeleteSessionFromList(item.date)}
                hitSlop={10}
                style={styles.sessionDeleteButton}>
                <Text style={styles.sessionDeleteText}>✕</Text>
              </Pressable>
            </View>
          )}
          contentContainerStyle={styles.sessionListContent}
          ListEmptyComponent={
            <Text style={styles.empty}>Aucune séance enregistrée. Appuie sur "+ Ajouter une séance" pour commencer.</Text>
          }
        />
      </View>
    );
  }

  if (screen === 'view') {
    return (
      <View style={styles.container}>
        <View style={styles.addHeaderRow}>
          <Pressable onPress={closeAdd}>
            <Text style={styles.backText}>‹ Terminé</Text>
          </Pressable>
          <View style={styles.addTitleRow}>
            <Text style={styles.addTitle}>{formatDateLabel(selectedDate)}</Text>
            <Pressable onPress={() => setScreen('add')}>
              <Text style={styles.editLinkText}>Modifier</Text>
            </Pressable>
          </View>
        </View>

        {notes[currentDateISO] ? <Text style={styles.viewNote}>📝 {notes[currentDateISO]}</Text> : null}

        <FlatList
          data={currentSessionByExercise}
          keyExtractor={(item) => item.exercise}
          renderItem={({ item }) => (
            <View style={styles.previewExercise}>
              <View style={styles.previewExerciseHeader}>
                <Text style={styles.previewExerciseName}>{item.exercise}</Text>
                <Pressable onPress={() => { setSelectedExercise(item.exercise); setChartReturnScreen('view'); setScreen('chart'); }}>
                  <Text style={styles.progressLink}>📈 progression</Text>
                </Pressable>
              </View>
              {item.sets.map((s: any) => (
                <View key={s.id} style={styles.setRow}>
                  <Text style={styles.setText}>{s.weight} kg × {s.reps}</Text>
                  <Text style={styles.setSubText}>e1RM {calculateE1RM(s.weight, s.reps).toFixed(1)} kg</Text>
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Aucune série enregistrée pour cette date</Text>}
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
        <Text style={styles.addTitle}>{formatDateLabel(selectedDate)}</Text>
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

      <View style={styles.metaForm}>
        <TextInput
          style={styles.metaInput}
          placeholder="Durée séance (min)"
          placeholderTextColor="#555"
          keyboardType="numeric"
          value={sessionDurations[currentDateISO] ?? ''}
          onChangeText={(text) => handleSessionMetaChange(text, sessionRpes[currentDateISO] ?? '')}
        />
        <TextInput
          style={styles.metaInput}
          placeholder="RPE (1-10)"
          placeholderTextColor="#555"
          keyboardType="numeric"
          value={sessionRpes[currentDateISO] ?? ''}
          onChangeText={(text) => handleSessionMetaChange(sessionDurations[currentDateISO] ?? '', text)}
        />
      </View>

      <Pressable onPress={() => setShowNoteModal(true)} style={styles.noteButton}>
        <Text style={styles.noteButtonText}>
          📝 {notes[currentDateISO] ? 'Modifier la note' : 'Ajouter une note'}
        </Text>
      </Pressable>

      <Modal
        visible={showNoteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNoteModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowNoteModal(false)}>
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <Text style={styles.modalTitle}>Note de la séance</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Ex : bonne forme, genou qui tire..."
                placeholderTextColor="#666"
                value={notes[currentDateISO] ?? ''}
                onChangeText={handleNoteChange}
                multiline
                autoFocus
              />
              <Pressable style={styles.noteValidateButton} onPress={() => setShowNoteModal(false)}>
                <Text style={styles.noteValidateButtonText}>Valider</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Pressable onPress={() => setShowExercisePicker(true)} style={styles.exercisePickerButton}>
        <Text style={styles.exercisePickerButtonText}>{selectedExercise}</Text>
        <Text style={styles.exercisePickerArrow}>▾</Text>
      </Pressable>

      <Modal
        visible={showExercisePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExercisePicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowExercisePicker(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Choisir un exercice</Text>
            <FlatList
              data={STRENGTH_EXERCISES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setSelectedExercise(item);
                    resetForm();
                    setShowExercisePicker(false);
                  }}
                  style={[styles.modalItem, item === selectedExercise && styles.modalItemActive]}>
                  <Text style={[styles.modalItemText, item === selectedExercise && styles.modalItemTextActive]}>
                    {item}
                  </Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

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
  container: { flex: 1, backgroundColor: '#000', paddingTop: 4, paddingHorizontal: 16 },
  headerRow: { marginBottom: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  addSessionButton: { backgroundColor: '#D4AF37', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  addSessionButtonText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  searchInput: { backgroundColor: '#111', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#333', paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 },
  sessionListContent: { paddingBottom: 20 },
  sessionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  sessionInfo: { flex: 1, padding: 14 },
  sessionInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionDate: { color: '#fff', fontWeight: 'bold' },
  sessionCount: { color: '#888', fontSize: 12 },
  sessionNotePreview: { color: '#888', fontSize: 12, marginTop: 4 },
  sessionDeleteButton: { paddingHorizontal: 16, paddingVertical: 14 },
  sessionDeleteText: { color: '#c0392b', fontSize: 16 },
  empty: { color: '#666', textAlign: 'center', marginTop: 20 },

  addHeaderRow: { marginBottom: 8 },
  backText: { color: '#D4AF37', fontSize: 15, marginBottom: 2 },
  addTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  editLinkText: { color: '#D4AF37', fontSize: 14, fontWeight: '600' },
  viewNote: { color: '#aaa', fontSize: 13, fontStyle: 'italic', marginBottom: 12 },

  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dateChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#444' },
  dateChipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  dateChipText: { color: '#aaa', fontSize: 13, lineHeight: 18 },
  dateChipTextActive: { color: '#000', fontWeight: 'bold' },
  noteButton: { marginBottom: 12 },
  noteButtonText: { color: '#D4AF37', fontSize: 13 },
  noteInput: { backgroundColor: '#000', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#333', paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 20, marginBottom: 16, minHeight: 80, textAlignVertical: 'top' },
  noteValidateButton: { backgroundColor: '#D4AF37', borderRadius: 8, marginHorizontal: 20, paddingVertical: 12, alignItems: 'center' },
  noteValidateButtonText: { color: '#000', fontWeight: 'bold' },

  exercisePickerButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', borderRadius: 6, borderWidth: 1, borderColor: '#333', paddingVertical: 8, paddingHorizontal: 12, marginBottom: 10 },
  exercisePickerButtonText: { color: '#ccc', fontSize: 14, fontWeight: '500' },
  exercisePickerArrow: { color: '#D4AF37', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#111', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 16, paddingBottom: 24, maxHeight: '60%' },
  modalTitle: { color: '#888', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 20, marginBottom: 8 },
  modalItem: { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
  modalItemActive: { backgroundColor: '#1a1a1a' },
  modalItemText: { color: '#ccc', fontSize: 16 },
  modalItemTextActive: { color: '#D4AF37', fontWeight: 'bold' },

  rmCaption: { color: '#888', fontSize: 12, marginBottom: 4 },
  chartLink: { color: '#D4AF37', fontSize: 13, marginBottom: 12 },
  chart: { borderRadius: 12, marginVertical: 12 },
  chartCaption: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 4 },

  form: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { flex: 1, backgroundColor: '#111', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#333' },
  metaForm: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  metaInput: { flex: 1, backgroundColor: '#0a0a0a', color: '#999', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#222', fontSize: 13 },
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  addButton: { flex: 1, backgroundColor: '#D4AF37', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  addButtonText: { color: '#000', fontWeight: 'bold' },
  updateButton: { flex: 1, backgroundColor: '#222', borderRadius: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#D4AF37' },
  updateButtonText: { color: '#D4AF37', fontWeight: 'bold' },
  cancelButton: { marginBottom: 16 },
  cancelText: { color: '#888', textAlign: 'center', fontSize: 13 },

  previewExercise: { marginBottom: 16 },
  previewExerciseName: { color: '#D4AF37', fontWeight: '600', marginBottom: 4 },
  previewExerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  progressLink: { color: '#5DADE2', fontSize: 12 },
  setRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#222' },
  setRowActive: { backgroundColor: '#1a1a1a', borderLeftWidth: 3, borderLeftColor: '#D4AF37', paddingLeft: 8 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  moveText: { color: '#888', fontSize: 14 },
  setText: { color: '#ccc' },
  setSubText: { color: '#666', fontSize: 11 },
  deleteText: { color: '#666', fontSize: 16, paddingHorizontal: 8 },
});
