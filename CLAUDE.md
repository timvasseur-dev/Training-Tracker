@AGENTS.md

# Training Tracker

App mobile perso de suivi sportif, en React Native (Expo) + TypeScript.

## Stack
- Expo / React Native, testé via Expo Go (tunnel mode car Chromebook)
- Stockage 100% local (SQLite via expo-sqlite), pas de backend
- Machine de dev limitée : 4 Go RAM (Chromebook MediaTek Kompanio 820) → privilégier les éditions via Claude Code plutôt que VS Code quand possible

## Design
- Thème dark, épuré, sportif, classe
- Couleur d'accent : or (#D4AF37)
- Navigation simple, beaucoup d'espace, graphs propres et lisibles

## Structure
3 onglets dans app/(tabs)/ : strength.tsx, running.tsx, crossfit.tsx, gérés par _layout.tsx

## Volet Strength
Saisie charge/reps par séance. Exercices : deadlift, bench barbell, back squat,
weighted pull ups, dips, shoulder press, lateral raises, front squat, clean, snatch.
À venir : calcul du 1RM, calendrier, graphs d'évolution.

## Volet Running
Indicateurs : VO2max, km, vitesse, FC. Sync Zepp = amélioration v2 (pas de must-have).

## Volet Crossfit WOD
Log des WODs effectués, logique de suggestion basée sur la récup et les autres
séances de la semaine (objectif : ~1 wod/semaine, pas 3 comme avant).

## État d'avancement
Squelette de navigation en cours de mise en place (3 onglets + layout thème dark).
