import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { getAllSets, getAllRuns, getAllWods } from '../../database/db';
import { toISODate } from '../../utils/dates';

const STRENGTH_COLOR = '#D4AF37';
const RUNNING_COLOR = '#2ECC71';
const CROSSFIT_COLOR = '#E67E22';

export default function CalendarScreen() {
  const [allSets, setAllSets] = useState<any[]>([]);
  const [allRuns, setAllRuns] = useState<any[]>([]);
  const [allWods, setAllWods] = useState<any[]>([]);
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const [dayActivities, setDayActivities] = useState<Record<string, { strength: any[]; running: any[]; crossfit: any[] }>>({});
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(toISODate(new Date()).slice(0, 7));

  useEffect(() => {
    load();
  }, []);

  function load() {
    const sets = getAllSets() as any[];
    const runs = getAllRuns() as any[];
    const wods = getAllWods() as any[];
    setAllSets(sets);
    setAllRuns(runs);
    setAllWods(wods);

    const byDate: Record<string, { strength: any[]; running: any[]; crossfit: any[] }> = {};
    for (const s of sets) {
      if (!byDate[s.date]) byDate[s.date] = { strength: [], running: [], crossfit: [] };
      byDate[s.date].strength.push(s);
    }
    for (const r of runs) {
      if (!byDate[r.date]) byDate[r.date] = { strength: [], running: [], crossfit: [] };
      byDate[r.date].running.push(r);
    }
    for (const w of wods) {
      if (!byDate[w.date]) byDate[w.date] = { strength: [], running: [], crossfit: [] };
      byDate[w.date].crossfit.push(w);
    }

    const marks: Record<string, any> = {};
    for (const date of Object.keys(byDate)) {
      const dots = [];
      if (byDate[date].strength.length > 0) dots.push({ key: 'strength', color: STRENGTH_COLOR });
      if (byDate[date].running.length > 0) dots.push({ key: 'running', color: RUNNING_COLOR });
      if (byDate[date].crossfit.length > 0) dots.push({ key: 'crossfit', color: CROSSFIT_COLOR });
      marks[date] = { dots };
    }

    setDayActivities(byDate);
    setMarkedDates(marks);
  }

  const selectedInfo = dayActivities[selectedDate];
  const markedWithSelection = {
    ...markedDates,
    [selectedDate]: {
      ...(markedDates[selectedDate] || { dots: [] }),
      selected: true,
      selectedColor: '#222',
    },
  };

  const monthSets = allSets.filter((s) => s.date.startsWith(visibleMonth));
  const monthRuns = allRuns.filter((r) => r.date.startsWith(visibleMonth));
  const monthWods = allWods.filter((w) => w.date.startsWith(visibleMonth));
  const strengthSessionsCount = new Set(monthSets.map((s) => s.date)).size;
  const totalVolume = monthSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
  const totalDistance = monthRuns.reduce((sum, r) => sum + r.distance_km, 0);

  const today = toISODate(new Date());
  const weekAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return toISODate(d); })();

  const weekSets = allSets.filter((s) => s.date >= weekAgo && s.date <= today);
  const weekRuns = allRuns.filter((r) => r.date >= weekAgo && r.date <= today);
  const weekWods = allWods.filter((w) => w.date >= weekAgo && w.date <= today);

  const weekStrengthSessions = new Set(weekSets.map((s) => s.date)).size;
  const weekVolume = weekSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
  const weekDistance = weekRuns.reduce((sum, r) => sum + r.distance_km, 0);
  const weekLoad =
    weekRuns.reduce((sum, r) => sum + (r.training_load ?? 0), 0) +
    weekWods.reduce((sum, w) => sum + (w.training_load ?? 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.weekCard}>
        <Text style={styles.weekTitle}>Cette semaine (7 derniers jours)</Text>
        <View style={styles.weekGrid}>
          <View style={styles.weekStat}>
            <Text style={styles.weekValue}>{weekStrengthSessions}</Text>
            <Text style={styles.weekLabel}>séances renfo</Text>
          </View>
          <View style={styles.weekStat}>
            <Text style={styles.weekValue}>{(weekVolume / 1000).toFixed(1)}t</Text>
            <Text style={styles.weekLabel}>volume</Text>
          </View>
          <View style={styles.weekStat}>
            <Text style={styles.weekValue}>{weekDistance.toFixed(1)}</Text>
            <Text style={styles.weekLabel}>km</Text>
          </View>
          <View style={styles.weekStat}>
            <Text style={styles.weekValue}>{weekWods.length}</Text>
            <Text style={styles.weekLabel}>WODs</Text>
          </View>
          <View style={styles.weekStat}>
            <Text style={styles.weekValue}>{weekLoad.toFixed(0)}</Text>
            <Text style={styles.weekLabel}>charge</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{strengthSessionsCount}</Text>
          <Text style={styles.statLabel}>renfo</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{(totalVolume / 1000).toFixed(1)}t</Text>
          <Text style={styles.statLabel}>volume</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{totalDistance.toFixed(1)}</Text>
          <Text style={styles.statLabel}>km</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{monthWods.length}</Text>
          <Text style={styles.statLabel}>WODs</Text>
        </View>
      </View>

      <Calendar
        markingType="multi-dot"
        markedDates={markedWithSelection}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        onMonthChange={(month) => setVisibleMonth(month.dateString.slice(0, 7))}
        maxDate={toISODate(new Date())}
        theme={{
          backgroundColor: '#000',
          calendarBackground: '#000',
          textSectionTitleColor: '#888',
          dayTextColor: '#fff',
          todayTextColor: '#D4AF37',
          monthTextColor: '#fff',
          arrowColor: '#D4AF37',
          textDisabledColor: '#333',
          selectedDayBackgroundColor: '#222',
        }}
        style={styles.calendar}
      />

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STRENGTH_COLOR }]} />
          <Text style={styles.legendText}>Strength</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: RUNNING_COLOR }]} />
          <Text style={styles.legendText}>Running</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: CROSSFIT_COLOR }]} />
          <Text style={styles.legendText}>Crossfit</Text>
        </View>
      </View>

      <ScrollView style={styles.detail}>
        <Text style={styles.detailTitle}>{selectedDate}</Text>
        {!selectedInfo && <Text style={styles.empty}>Aucune activité ce jour-là</Text>}
        {selectedInfo && selectedInfo.strength.length > 0 && (
          <Text style={styles.detailLine}>
            💪 Strength — {selectedInfo.strength.length} série{selectedInfo.strength.length > 1 ? 's' : ''}
          </Text>
        )}
        {selectedInfo && selectedInfo.running.length > 0 && (
          <Text style={styles.detailLine}>
            🏃 Running — {selectedInfo.running.length} course{selectedInfo.running.length > 1 ? 's' : ''}
          </Text>
        )}
        {selectedInfo && selectedInfo.crossfit.length > 0 && (
          <Text style={styles.detailLine}>🔥 Crossfit — {selectedInfo.crossfit.map((w: any) => w.name).join(', ')}</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 4, paddingHorizontal: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  statsCard: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 8, borderWidth: 1, borderColor: '#222', paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8 },
  statBlock: { flex: 1, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  statLabel: { color: '#888', fontSize: 9 },
  weekCard: { backgroundColor: '#111', borderRadius: 8, borderWidth: 1, borderColor: '#D4AF37', padding: 12, marginBottom: 12 },
  weekTitle: { color: '#D4AF37', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: '600' },
  weekGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  weekStat: { alignItems: 'center', minWidth: 56 },
  weekValue: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  weekLabel: { color: '#888', fontSize: 9 },
  calendar: { borderRadius: 8, marginBottom: 12 },
  legendRow: { flexDirection: 'row', gap: 16, marginBottom: 16, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#888', fontSize: 12 },
  detail: { flex: 1 },
  detailTitle: { color: '#D4AF37', fontWeight: 'bold', fontSize: 15, marginBottom: 8 },
  detailLine: { color: '#ccc', fontSize: 14, marginBottom: 6 },
  empty: { color: '#666', fontSize: 13 },
});
