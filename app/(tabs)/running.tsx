import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, FlatList, Alert, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addRun, getAllRuns, updateRun, deleteRun, runExistsByHealthConnectId, addRunFromHealthConnect } from '../../database/db';
import { toISODate, isSameDate, getYesterday, formatDateLabel, formatISODateLabel } from '../../utils/dates';
import { initHealthConnect, requestRunningPermissions, readRunningSessions } from '../../utils/healthConnect';

function computeSpeed(distanceKm: number, durationMin: number) {
  if (durationMin <= 0) return 0;
  return distanceKm / (durationMin / 60);
}

function computePace(distanceKm: number, durationMin: number) {
  if (distanceKm <= 0) return null;
  const paceMinPerKm = durationMin / distanceKm;
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
}

export default function RunningScreen() {
  const [runs, setRuns] = useState<any[]>([]);
  const [screen, setScreen] = useState<'list' | 'add'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [avgHr, setAvgHr] = useState('');
  const [vo2max, setVo2max] = useState('');
  const [cadence, setCadence] = useState('');
  const [calories, setCalories] = useState('');
  const [rpe, setRpe] = useState('');
  const [note, setNote] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);

  function loadRuns() {
    setRuns(getAllRuns());
  }

  useEffect(() => {
    loadRuns();
  }, []);

  function resetForm() {
    setDistance('');
    setDuration('');
    setAvgHr('');
    setVo2max('');
    setCadence('');
    setCalories('');
    setRpe('');
    setNote('');
    setEditingId(null);
  }

  function openAdd() {
    setSelectedDate(new Date());
    setScreen('add');
    resetForm();
  }

  function openRunForEdit(run: any) {
    setSelectedDate(new Date(run.date + 'T00:00:00'));
    setDistance(run.distance_km.toString());
    setDuration(run.duration_min.toString());
    setAvgHr(run.avg_hr != null ? run.avg_hr.toString() : '');
    setVo2max(run.vo2max != null ? run.vo2max.toString() : '');
    setCadence(run.cadence != null ? run.cadence.toString() : '');
    setCalories(run.calories != null ? run.calories.toString() : '');
    setRpe(run.training_load != null && run.duration_min ? (run.training_load / run.duration_min).toString() : '');
    setNote(run.note ?? '');
    setEditingId(run.id);
    setScreen('add');
  }

  function closeAdd() {
    setScreen('list');
    resetForm();
  }

  function handleSave() {
    if (!distance || !duration) return;
    const distanceKm = parseFloat(distance);
    const durationMin = parseFloat(duration);
    const hr = avgHr ? parseInt(avgHr) : null;
    const vo2 = vo2max ? parseFloat(vo2max) : null;
    const cad = cadence ? parseInt(cadence) : null;
    const cal = calories ? parseInt(calories) : null;
    const trainingLoad = rpe ? parseFloat(rpe) * durationMin : null;
    const noteValue = note.trim() === '' ? null : note;
    if (editingId !== null) {
      updateRun(editingId, distanceKm, durationMin, hr, vo2, cad, cal, trainingLoad, noteValue);
    } else {
      addRun(toISODate(selectedDate), distanceKm, durationMin, hr, vo2, cad, cal, trainingLoad, noteValue);
    }
    resetForm();
    loadRuns();
    setScreen('list');
  }

  async function handleImportFromZepp() {
    try {
      const ok = await initHealthConnect();
      if (!ok) {
        Alert.alert('Health Connect', "Health Connect n'est pas disponible sur cet appareil.");
        return;
      }
      await requestRunningPermissions();
      const sessions = await readRunningSessions(30);
      let imported = 0;
      let skipped = 0;
      for (const s of sessions) {
        if (runExistsByHealthConnectId(s.healthConnectId)) {
          skipped++;
          continue;
        }
        addRunFromHealthConnect(
          toISODate(s.date),
          s.distanceKm,
          s.durationMin,
          s.avgHr,
          s.calories,
          s.healthConnectId
        );
        imported++;
      }
      loadRuns();
      Alert.alert('Import Zepp', `${imported} course(s) importée(s), ${skipped} déjà présente(s).`);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "Échec de l'import Health Connect");
    }
  }

  function handleDelete(id: number) {
    Alert.alert('Supprimer cette course ?', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          deleteRun(id);
          resetForm();
          loadRuns();
          setScreen('list');
        },
      },
    ]);
  }

  if (screen === 'list') {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Courses</Text>
          <Pressable style={styles.addButton} onPress={openAdd}>
            <Text style={styles.addButtonText}>+ Ajouter une course</Text>
          </Pressable>
          <Pressable onPress={handleImportFromZepp} style={{ marginTop: 10, alignItems: 'center' }}>
            <Text style={{ color: '#5DADE2', fontSize: 13 }}>🔗 Importer depuis Zepp</Text>
          </Pressable>
        </View>
        <FlatList
          data={runs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => {
            const speed = computeSpeed(item.distance_km, item.duration_min);
            const pace = computePace(item.distance_km, item.duration_min);
            return (
              <Pressable onPress={() => openRunForEdit(item)} style={styles.runCard}>
                <Text style={styles.runDate}>{formatISODateLabel(item.date, 'Course')}</Text>
                <View style={styles.runStatsRow}>
                  <Text style={styles.runStat}>{item.distance_km} km</Text>
                  <Text style={styles.runStat}>{item.duration_min} min</Text>
                  <Text style={styles.runStat}>{speed.toFixed(1)} km/h</Text>
                </View>
                <View style={styles.runStatsRow}>
                  {pace && <Text style={styles.runSubStat}>Allure {pace}/km</Text>}
                  {item.avg_hr != null && <Text style={styles.runSubStat}>FC moy. {item.avg_hr} bpm</Text>}
                  {item.vo2max != null && <Text style={styles.runSubStat}>VO2max {item.vo2max}</Text>}
                </View>
                <View style={styles.runStatsRow}>
                  {item.cadence != null && <Text style={styles.runSubStat}>Cadence {item.cadence} pas/min</Text>}
                  {item.calories != null && <Text style={styles.runSubStat}>{item.calories} kcal</Text>}
                  {item.training_load != null && <Text style={styles.runSubStat}>Charge {item.training_load.toFixed(0)}</Text>}
                </View>
                {item.note ? (
                  <Text style={styles.runNotePreview} numberOfLines={1}>📝 {item.note}</Text>
                ) : null}
              </Pressable>
            );
          }}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.empty}>Aucune course enregistrée. Appuie sur "+ Ajouter une course" pour commencer.</Text>
          }
        />
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
          <Text style={styles.addTitle}>{formatDateLabel(selectedDate, 'Course')}</Text>
          {editingId !== null && (
            <Pressable onPress={() => handleDelete(editingId)}>
              <Text style={styles.deleteSessionText}>Supprimer</Text>
            </Pressable>
          )}
        </View>
      </View>

      {editingId === null && (
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
      )}

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

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Distance (km)"
          placeholderTextColor="#666"
          keyboardType="numeric"
          value={distance}
          onChangeText={setDistance}
        />
        <TextInput
          style={styles.input}
          placeholder="Durée (min)"
          placeholderTextColor="#666"
          keyboardType="numeric"
          value={duration}
          onChangeText={setDuration}
        />
      </View>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="FC moy. (bpm)"
          placeholderTextColor="#666"
          keyboardType="numeric"
          value={avgHr}
          onChangeText={setAvgHr}
        />
        <TextInput
          style={styles.input}
          placeholder="VO2max"
          placeholderTextColor="#666"
          keyboardType="numeric"
          value={vo2max}
          onChangeText={setVo2max}
        />
      </View>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Cadence (pas/min, ex. 180)"
          placeholderTextColor="#666"
          keyboardType="numeric"
          value={cadence}
          onChangeText={setCadence}
        />
        <TextInput
          style={styles.input}
          placeholder="Calories (kcal)"
          placeholderTextColor="#666"
          keyboardType="numeric"
          value={calories}
          onChangeText={setCalories}
        />
      </View>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Difficulté ressentie (RPE 1-10)"
          placeholderTextColor="#666"
          keyboardType="numeric"
          value={rpe}
          onChangeText={setRpe}
        />
      </View>

      {distance && duration && (
        <Text style={styles.previewText}>
          {computeSpeed(parseFloat(distance) || 0, parseFloat(duration) || 0).toFixed(1)} km/h · Allure{' '}
          {computePace(parseFloat(distance) || 0, parseFloat(duration) || 0) ?? '—'}/km
          {rpe ? ` · Charge ${(parseFloat(rpe) * (parseFloat(duration) || 0)).toFixed(0)}` : ''}
        </Text>
      )}

      <Pressable onPress={() => setShowNoteModal(true)} style={styles.noteButton}>
        <Text style={styles.noteButtonText}>📝 {note ? 'Modifier la note' : 'Ajouter une note'}</Text>
      </Pressable>

      <Modal
        visible={showNoteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNoteModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowNoteModal(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Ressenti de la course</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Ex : jambes lourdes, bonnes sensations..."
              placeholderTextColor="#666"
              value={note}
              onChangeText={setNote}
              multiline
              autoFocus
            />
            <Pressable style={styles.noteValidateButton} onPress={() => setShowNoteModal(false)}>
              <Text style={styles.noteValidateButtonText}>Valider</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>{editingId !== null ? 'Mettre à jour' : 'Ajouter'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 4, paddingHorizontal: 16 },
  headerRow: { marginBottom: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  addButton: { backgroundColor: '#D4AF37', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  addButtonText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  listContent: { paddingBottom: 20 },
  runCard: { backgroundColor: '#111', borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#222', padding: 14 },
  runDate: { color: '#fff', fontWeight: 'bold', marginBottom: 6 },
  runStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 2 },
  runStat: { color: '#D4AF37', fontSize: 14, fontWeight: '600' },
  runSubStat: { color: '#888', fontSize: 12 },
  runNotePreview: { color: '#888', fontSize: 12, marginTop: 4 },
  empty: { color: '#666', textAlign: 'center', marginTop: 20 },

  addHeaderRow: { marginBottom: 8 },
  backText: { color: '#D4AF37', fontSize: 15, marginBottom: 2 },
  addTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  deleteSessionText: { color: '#c0392b', fontSize: 13 },

  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dateChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#444' },
  dateChipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  dateChipText: { color: '#aaa', fontSize: 13, lineHeight: 18 },
  dateChipTextActive: { color: '#000', fontWeight: 'bold' },

  form: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { flex: 1, backgroundColor: '#111', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#333' },
  previewText: { color: '#888', fontSize: 13, marginBottom: 12, textAlign: 'center' },

  noteButton: { marginBottom: 16 },
  noteButtonText: { color: '#D4AF37', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#111', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 16, paddingBottom: 24, maxHeight: '60%' },
  modalTitle: { color: '#888', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 20, marginBottom: 8 },
  noteInput: { backgroundColor: '#000', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#333', paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 20, marginBottom: 16, minHeight: 80, textAlignVertical: 'top' },
  noteValidateButton: { backgroundColor: '#D4AF37', borderRadius: 8, marginHorizontal: 20, paddingVertical: 12, alignItems: 'center' },
  noteValidateButtonText: { color: '#000', fontWeight: 'bold' },

  saveButton: { backgroundColor: '#D4AF37', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  saveButtonText: { color: '#000', fontWeight: 'bold' },
});
