import {
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';

export async function initHealthConnect() {
  const isInitialized = await initialize();
  return isInitialized;
}

export async function requestRunningPermissions() {
  const granted = await requestPermission([
    { accessType: 'read', recordType: 'ExerciseSession' },
    { accessType: 'read', recordType: 'Distance' },
    { accessType: 'read', recordType: 'TotalCaloriesBurned' },
    { accessType: 'read', recordType: 'HeartRate' },
  ]);
  return granted;
}

export async function readRunningSessions(daysBack = 30) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };

  const { records: sessions } = await readRecords('ExerciseSession', { timeRangeFilter });
  const { records: distances } = await readRecords('Distance', { timeRangeFilter });
  const { records: calories } = await readRecords('TotalCaloriesBurned', { timeRangeFilter });
  const { records: heartRates } = await readRecords('HeartRate', { timeRangeFilter });

  return sessions.map((session: any) => {
    const sStart = new Date(session.startTime).getTime();
    const sEnd = new Date(session.endTime).getTime();
    const durationMin = (sEnd - sStart) / 60000;

    const distanceRec = distances.find((d: any) => {
      const t = new Date(d.startTime).getTime();
      return t >= sStart && t <= sEnd;
    });
    const distanceKm = distanceRec ? (distanceRec as any).distance.inMeters / 1000 : 0;

    const calRec = calories.find((c: any) => {
      const t = new Date(c.startTime).getTime();
      return t >= sStart && t <= sEnd;
    });
    const kcal = calRec ? Math.round((calRec as any).energy.inKilocalories) : null;

    const hrSamples: number[] = [];
    for (const hr of heartRates as any[]) {
      for (const sample of hr.samples ?? []) {
        const t = new Date(sample.time).getTime();
        if (t >= sStart && t <= sEnd) hrSamples.push(sample.beatsPerMinute);
      }
    }
    const avgHr = hrSamples.length > 0 ? Math.round(hrSamples.reduce((a, b) => a + b, 0) / hrSamples.length) : null;

    return {
      date: new Date(session.startTime),
      distanceKm: Math.round(distanceKm * 100) / 100,
      durationMin: Math.round(durationMin * 10) / 10,
      avgHr,
      calories: kcal,
      healthConnectId: session.metadata?.id ?? `${session.startTime}`,
    };
  });
}
