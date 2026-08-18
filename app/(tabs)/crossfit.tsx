import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, FlatList, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addWod, getAllWods, updateWod, deleteWod, getAllRuns, getAllSets, getAllNotes } from '../../database/db';
import { toISODate, isSameDate, getYesterday, formatDateLabel, formatISODateLabel, daysAgo } from '../../utils/dates';

type RecoveryLevel = 'unknown' | 'high' | 'low' | 'normal';

function computeRecoveryStatus(runs: any[], wods: any[], strengthSessions: any[]) {
  const today = toISODate(new Date());
  const start7 = toISODate(daysAgo(6));
  const startBaseline = toISODate(daysAgo(27));
  const endBaseline = toISODate(daysAgo(7));

  const combined = [...runs, ...wods, ...strengthSessions];

  const last7Load = combined
    .filter((e) => e.date >= start7 && e.date <= today && e.training_load != null)
    .reduce((sum, e) => sum + e.training_load, 0);

  const baselineLoad = combined
    .filter((e) => e.date >= startBaseline && e.date <= endBaseline && e.training_load != null)
    .reduce((sum, e) => sum + e.training_load, 0);

  const baselineWeeklyAvg = baselineLoad / 3;

  if (baselineWeeklyAvg === 0) {
    return {
      level: 'unknown' as RecoveryLevel,
      message: "Pas encore assez d'historique pour comparer ta charge — reviens dans quelques semaines.",
    };
  }

  const ratio = last7Load / baselineWeeklyAvg;

  if (ratio > 1.3) {
    return {
      level: 'high' as RecoveryLevel,
      message: `Charge élevée cette semaine (${last7Load.toFixed(0)} vs ${baselineWeeklyAvg.toFixed(0)} habituellement) — envisage de lever le pied ou d'y aller doucement.`,
    };
  }
  if (ratio < 0.7) {
    return {
      level: 'low' as RecoveryLevel,
      message: `Charge légère cette semaine (${last7Load.toFixed(0)} vs ${baselineWeeklyAvg.toFixed(0)} habituellement) — bon moment pour un WOD.`,
    };
  }
  return {
    level: 'normal' as RecoveryLevel,
    message: `Charge dans ta moyenne habituelle (${last7Load.toFixed(0)} vs ${baselineWeeklyAvg.toFixed(0)}) — feu vert pour un WOD.`,
  };
}

export default function CrossfitScreen() {
  const [wods, setWods] = useState<any[]>([]);
  const [screen, setScreen] = useState<'list' | 'add'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [rpe, setRpe] = useState('');
  const [note, setNote] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<{ level: RecoveryLevel; message: string } | null>(null);
  const [strengthCount7d, setStrengthCount7d] = useState(0);

  function loadWods() {
    setWods(getAllWods());
  }

  function refreshAll() {
    loadWods();
    const runs = getAllRuns();
    const strengthSets = getAllSets();
    const strengthSessions = getAllNotes();
    const allWods = getAllWods();
    const today = toISODate(new Date());
    const start7 = toISODate(daysAgo(6));
    const strengthDates = new Set(
      strengthSets.filter((s: any) => s.date >= start7 && s.date <= today).map((s: any) => s.date)
    );
    setStrengthCount7d(strengthDates.size);
    setRecoveryStatus(computeRecoveryStatus(runs, allWods, strengthSessions));
  }

  useEffect(() => {
    refreshAll();
  }, []);

  function resetForm() {
    setName('');
    setDuration('');
    setRpe('');
    setNote('');
    setEditingId(null);
  }

  function openAdd() {
    setSelectedDate(new Date());
    setScreen('add');
    resetForm();
  }

  function openWodForEdit(wod: any) {
    setSelectedDate(new Date(wod.date + 'T00:00:00'));
    setName(wod.name);
    setDuration(wod.duration_min != null ? wod.duration_min.toString() : '');
    setRpe(wod.training_load != null && wod.duration_min ? (wod.training_load / wod.duration_min).toString() : '');
    setNote(wod.note ?? '');
    setEditingId(wod.id);
    setScreen('add');
  }

  function closeAdd() {
    setScreen('list');
    resetForm();
  }

  function handleSave() {
    if (!name.trim()) return;
    const durationMin = duration ? parseFloat(duration) : null;
    const trainingLoad = rpe && durationMin ? parseFloat(rpe) * durationMin : null;
    const noteValue = note.trim() === '' ? null : note;
    if (editingId !== null) {
      updateWod(editingId, name.trim(), durationMin, trainingLoad, noteValue);
    } else {
      addWod(toISODate(selectedDate), name.trim(), durationMin, trainingLoad, noteValue);
    }
    resetForm();
    refreshAll();
    setScreen('list');
  }

  function handleDelete(id: number) {
    Alert.alert('Supprimer ce WOD ?', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          deleteWod(id);
          resetForm();
          refreshAll();
          setScreen('list');
        },
      },
    ]);
  }

  if (screen === 'list') {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          {recoveryStatus && (
            <View style={[styles.recoveryCard, styles[`recovery_${recoveryStatus.level}` as `recovery_${RecoveryLevel}`]]}>
              <Text style={styles.recoveryText}>{recoveryStatus.message}</Text>
              {strengthCount7d > 0 && (
                <Text style={styles.recoverySubText}>
                  {strengthCount7d} séance{strengthCount7d > 1 ? 's' : ''} de renfo cette semaine
                </Text>
              )}
            </View>
          )}
          <Pressable style={styles.addButton} onPress={openAdd}>
            <Text style={styles.addButtonText}>+ Ajouter un WOD</Text>
          </Pressable>
        </View>
        <FlatList
          data={wods}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <Pressable onPress={() => openWodForEdit(item)} style={styles.wodCard}>
              <Text style={styles.wodDate}>{formatISODateLabel(item.date, 'WOD')}</Text>
              <Text style={styles.wodName}>{item.name}</Text>
              <View style={styles.wodStatsRow}>
                {item.duration_min != null && <Text style={styles.wodSubStat}>{item.duration_min} min</Text>}
                {item.training_load != null && <Text style={styles.wodSubStat}>Charge {item.training_load.toFixed(0)}</Text>}
              </View>
              {item.note ? (
                <Text style={styles.wodNotePreview} numberOfLines={1}>📝 {item.note}</Text>
              ) : null}
            </Pressable>
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.empty}>Aucun WOD enregistré. Appuie sur "+ Ajouter un WOD" pour commencer.</Text>
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
          <Text style={styles.addTitle}>{formatDateLabel(selectedDate, 'WOD')}</Text>
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

      <TextInput
        style={styles.nameInput}
        placeholder="Nom / description du WOD (ex : Fran, 21-15-9 thrusters/pull-ups)"
        placeholderTextColor="#666"
        value={name}
        onChangeText={setName}
        multiline
      />

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Durée (min)"
          placeholderTextColor="#666"
          keyboardType="numeric"
          value={duration}
          onChangeText={setDuration}
        />
        <TextInput
          style={styles.input}
          placeholder="RPE (1-10)"
          placeholderTextColor="#666"
          keyboardType="numeric"
          value={rpe}
          onChangeText={setRpe}
        />
      </View>

      {duration && rpe && (
        <Text style={styles.previewText}>
          Charge estimée : {(parseFloat(rpe) * parseFloat(duration)).toFixed(0)}
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowNoteModal(false)}>
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <Text style={styles.modalTitle}>Ressenti du WOD</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Ex : cardio à la peine, bonnes sensations sur les cleans..."
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
        </KeyboardAvoidingView>
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
  recoveryCard: { borderRadius: 8, borderWidth: 1, padding: 14, marginBottom: 12, backgroundColor: '#111' },
  recovery_high: { borderColor: '#c0392b' },
  recovery_low: { borderColor: '#2e8b57' },
  recovery_normal: { borderColor: '#D4AF37' },
  recovery_unknown: { borderColor: '#444' },
  recoveryText: { color: '#fff', fontSize: 13, lineHeight: 18 },
  recoverySubText: { color: '#888', fontSize: 12, marginTop: 6 },
  listContent: { paddingBottom: 20 },
  wodCard: { backgroundColor: '#111', borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#222', padding: 14 },
  wodDate: { color: '#fff', fontWeight: 'bold', marginBottom: 4 },
  wodName: { color: '#D4AF37', fontSize: 14, marginBottom: 4 },
  wodStatsRow: { flexDirection: 'row', gap: 16 },
  wodSubStat: { color: '#888', fontSize: 12 },
  wodNotePreview: { color: '#888', fontSize: 12, marginTop: 4 },
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

  nameInput: { backgroundColor: '#111', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#333', marginBottom: 8, minHeight: 60, textAlignVertical: 'top' },
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
