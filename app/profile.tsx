import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, FlatList, Alert, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getProfile, saveProfile, addWeightEntry, getWeightLog, deleteWeightEntry, getAllSets } from '../database/db';
import { toISODate, formatISODateLabel } from '../utils/dates';
import { BARBELL_EXERCISES } from '../constants/exercises';

const screenWidth = Dimensions.get('window').width;

const chartConfig = {
  backgroundGradientFrom: '#000',
  backgroundGradientTo: '#000',
  decimalPlaces: 1,
  color: (o = 1) => `rgba(212, 175, 55, ${o})`,
  labelColor: (o = 1) => `rgba(200, 200, 200, ${o})`,
  propsForDots: { r: '4', strokeWidth: '2', stroke: '#D4AF37' },
};

export default function ProfileScreen() {
  const [height, setHeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [goalMode, setGoalMode] = useState<'date' | 'longterm'>('longterm');
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [showTargetDatePicker, setShowTargetDatePicker] = useState(false);

  const [newWeight, setNewWeight] = useState('');
  const [weighDate, setWeighDate] = useState(new Date());
  const [showWeighDatePicker, setShowWeighDatePicker] = useState(false);
  const [weightLog, setWeightLog] = useState<any[]>([]);

  useEffect(() => {
    const p = getProfile();
    if (p) {
      setHeight(p.height_cm ? p.height_cm.toString() : '');
      setTargetWeight(p.target_weight_kg ? p.target_weight_kg.toString() : '');
      if (p.target_date) {
        setGoalMode('date');
        setTargetDate(new Date(p.target_date + 'T00:00:00'));
      } else {
        setGoalMode('longterm');
      }
    }
    loadWeights();
  }, []);

  function loadWeights() {
    setWeightLog(getWeightLog());
  }

  function handleSaveProfile() {
    saveProfile(
      height ? parseFloat(height) : null,
      targetWeight ? parseFloat(targetWeight) : null,
      goalMode === 'date' && targetDate ? toISODate(targetDate) : null
    );
    Alert.alert('Profil', 'Enregistré.');
  }

  function handleAddWeight() {
    if (!newWeight) return;
    addWeightEntry(toISODate(weighDate), parseFloat(newWeight));
    setNewWeight('');
    setWeighDate(new Date());
    loadWeights();
  }

  function handleDeleteWeight(id: number) {
    deleteWeightEntry(id);
    loadWeights();
  }

  const latestWeight = weightLog.length > 0 ? weightLog[weightLog.length - 1].weight_kg : null;
  const chartData = weightLog.slice(-12);

  function calculateE1RM(weight: number, reps: number) {
    return weight * (1 + reps / 30);
  }

  const allSets = getAllSets() as any[];
  const strengthRatios = latestWeight
    ? BARBELL_EXERCISES.map((exercise) => {
        const setsForEx = allSets.filter((s) => s.exercise === exercise);
        if (setsForEx.length === 0) return null;
        const best1RM = Math.max(...setsForEx.map((s) => calculateE1RM(s.weight, s.reps)));
        return { exercise, ratio: best1RM / latestWeight, e1rm: best1RM };
      }).filter((r): r is { exercise: string; ratio: number; e1rm: number } => r !== null)
    : [];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Retour</Text>
        </Pressable>
        <Text style={styles.title}>Profil</Text>
      </View>

      <FlatList
        data={[...weightLog].reverse()}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={
          <View>
            <Text style={styles.sectionLabel}>Taille</Text>
            <TextInput style={styles.input} placeholder="Taille (cm)" placeholderTextColor="#666" keyboardType="numeric" value={height} onChangeText={setHeight} />

            <Text style={styles.sectionLabel}>Objectif de poids</Text>
            <TextInput style={[styles.input, { marginBottom: 8 }]} placeholder="Poids cible (kg)" placeholderTextColor="#666" keyboardType="numeric" value={targetWeight} onChangeText={setTargetWeight} />

            <View style={styles.goalModeRow}>
              <Pressable
                onPress={() => setGoalMode('date')}
                style={[styles.goalChip, goalMode === 'date' && styles.goalChipActive]}>
                <Text style={[styles.goalChipText, goalMode === 'date' && styles.goalChipTextActive]}>Avec échéance</Text>
              </Pressable>
              <Pressable
                onPress={() => setGoalMode('longterm')}
                style={[styles.goalChip, goalMode === 'longterm' && styles.goalChipActive]}>
                <Text style={[styles.goalChipText, goalMode === 'longterm' && styles.goalChipTextActive]}>Long terme / maintien</Text>
              </Pressable>
            </View>

            {goalMode === 'date' && (
              <Pressable onPress={() => setShowTargetDatePicker(true)} style={styles.dateSelectButton}>
                <Text style={styles.dateSelectText}>
                  {targetDate ? `Échéance : ${targetDate.toLocaleDateString('fr-FR')}` : 'Choisir une échéance'}
                </Text>
              </Pressable>
            )}

            {showTargetDatePicker && (
              <DateTimePicker
                value={targetDate ?? new Date()}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(event, date) => {
                  setShowTargetDatePicker(false);
                  if (event.type === 'set' && date) setTargetDate(date);
                }}
              />
            )}

            <Pressable style={styles.saveButton} onPress={handleSaveProfile}>
              <Text style={styles.saveButtonText}>Enregistrer le profil</Text>
            </Pressable>

            {latestWeight != null && targetWeight ? (
              <Text style={styles.progressText}>
                Actuel : {latestWeight} kg → Objectif : {targetWeight} kg
                {'  '}({parseFloat(targetWeight) - latestWeight > 0 ? '+' : ''}{(parseFloat(targetWeight) - latestWeight).toFixed(1)} kg)
                {goalMode === 'longterm' ? '  · maintien' : ''}
              </Text>
            ) : null}

            <Text style={styles.sectionLabel}>Suivi du poids</Text>
            <Pressable onPress={() => setShowWeighDatePicker(true)} style={styles.dateSelectButton}>
              <Text style={styles.dateSelectText}>Date : {weighDate.toLocaleDateString('fr-FR')}</Text>
            </Pressable>

            {showWeighDatePicker && (
              <DateTimePicker
                value={weighDate}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={(event, date) => {
                  setShowWeighDatePicker(false);
                  if (event.type === 'set' && date) setWeighDate(date);
                }}
              />
            )}

            <View style={styles.row}>
              <TextInput style={styles.input} placeholder="Poids (kg)" placeholderTextColor="#666" keyboardType="numeric" value={newWeight} onChangeText={setNewWeight} />
              <Pressable style={styles.addButton} onPress={handleAddWeight}>
                <Text style={styles.addButtonText}>Ajouter</Text>
              </Pressable>
            </View>

            {chartData.length >= 2 && (
              <LineChart
                data={{ labels: chartData.map((w) => { const [, m, d] = w.date.split('-'); return `${d}/${m}`; }), datasets: [{ data: chartData.map((w) => w.weight_kg) }] }}
                width={screenWidth - 32}
                height={200}
                yAxisSuffix=" kg"
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
              />
            )}

            {strengthRatios.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Ratios de force (× poids de corps)</Text>
                {strengthRatios.map((r) => (
                  <View key={r.exercise} style={styles.ratioRow}>
                    <Text style={styles.ratioExercise}>{r.exercise}</Text>
                    <Text style={styles.ratioValue}>{r.ratio.toFixed(2)}×</Text>
                  </View>
                ))}
                <Text style={styles.ratioCaption}>Basé sur ton 1RM estimé et ta dernière pesée ({latestWeight} kg)</Text>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.weightRow}>
            <Text style={styles.weightDate}>{formatISODateLabel(item.date, 'Pesée')}</Text>
            <Text style={styles.weightValue}>{item.weight_kg} kg</Text>
            <Pressable onPress={() => handleDeleteWeight(item.id)} hitSlop={8}>
              <Text style={styles.deleteText}>✕</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucune pesée enregistrée</Text>}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 8, paddingHorizontal: 16 },
  headerRow: { marginBottom: 12 },
  backText: { color: '#D4AF37', fontSize: 15, marginBottom: 4 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  sectionLabel: { color: '#888', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { flex: 1, backgroundColor: '#111', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#333' },
  goalModeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  goalChip: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#444', alignItems: 'center' },
  goalChipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  goalChipText: { color: '#aaa', fontSize: 13, lineHeight: 18 },
  goalChipTextActive: { color: '#000', fontWeight: 'bold' },
  dateSelectButton: { backgroundColor: '#111', borderRadius: 8, borderWidth: 1, borderColor: '#333', paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  dateSelectText: { color: '#ccc', fontSize: 14 },
  saveButton: { backgroundColor: '#222', borderRadius: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#D4AF37', marginTop: 4 },
  saveButtonText: { color: '#D4AF37', fontWeight: 'bold' },
  progressText: { color: '#ccc', fontSize: 14, marginTop: 12, textAlign: 'center' },
  addButton: { backgroundColor: '#D4AF37', borderRadius: 8, justifyContent: 'center', paddingHorizontal: 16 },
  addButtonText: { color: '#000', fontWeight: 'bold' },
  chart: { borderRadius: 12, marginVertical: 12 },
  weightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  weightDate: { color: '#ccc', flex: 1 },
  weightValue: { color: '#D4AF37', fontWeight: '600', marginRight: 16 },
  deleteText: { color: '#666', fontSize: 16 },
  empty: { color: '#666', textAlign: 'center', marginTop: 20 },
  ratioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#222' },
  ratioExercise: { color: '#ccc', fontSize: 14 },
  ratioValue: { color: '#D4AF37', fontSize: 16, fontWeight: 'bold' },
  ratioCaption: { color: '#666', fontSize: 11, marginTop: 8, fontStyle: 'italic' },
});
