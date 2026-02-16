/**
 * fabBridge – lightweight pub/sub so the FAB button (rendered in _layout.tsx)
 * can talk to the popup logic (in nutrition.tsx) without React Context.
 */

type VoidCb = () => void;
type BoolCb = (open: boolean) => void;
type CardCb = (card: 'saved' | 'search' | 'scan') => void;

// ── FAB pressed (layout → nutrition) ──
const pressListeners: VoidCb[] = [];
export function emitFabPress() {
  pressListeners.forEach(fn => fn());
}
export function onFabPress(fn: VoidCb): VoidCb {
  pressListeners.push(fn);
  return () => {
    const i = pressListeners.indexOf(fn);
    if (i >= 0) pressListeners.splice(i, 1);
  };
}

// ── Popup state (nutrition → layout, so layout can rotate the FAB icon) ──
const stateListeners: BoolCb[] = [];
export function emitPopupState(open: boolean) {
  stateListeners.forEach(fn => fn(open));
}
export function onPopupState(fn: BoolCb): VoidCb {
  stateListeners.push(fn);
  return () => {
    const i = stateListeners.indexOf(fn);
    if (i >= 0) stateListeners.splice(i, 1);
  };
}

// ── Card selected in popup (layout → nutrition) ──
const cardListeners: CardCb[] = [];
export function emitCardSelect(card: 'saved' | 'search' | 'scan') {
  cardListeners.forEach(fn => fn(card));
}
export function onCardSelect(fn: CardCb): VoidCb {
  cardListeners.push(fn);
  return () => {
    const i = cardListeners.indexOf(fn);
    if (i >= 0) cardListeners.splice(i, 1);
  };
}

// ── Workout FAB card select (layout → workout screen) ──
type WorkoutCard = 'tmlsn' | 'your-routines' | 'empty';
const workoutCardListeners: ((card: WorkoutCard) => void)[] = [];
export function emitWorkoutCardSelect(card: WorkoutCard) {
  workoutCardListeners.forEach(fn => fn(card));
}
export function onWorkoutCardSelect(fn: (card: WorkoutCard) => void): VoidCb {
  workoutCardListeners.push(fn);
  return () => {
    const i = workoutCardListeners.indexOf(fn);
    if (i >= 0) workoutCardListeners.splice(i, 1);
  };
}

// ── Streak popup open/close (nutrition → layout, so tab bar shifts with content) ──
const streakStateListeners: BoolCb[] = [];
export function emitStreakPopupState(open: boolean) {
  streakStateListeners.forEach(fn => fn(open));
}
export function onStreakPopupState(fn: BoolCb): VoidCb {
  streakStateListeners.push(fn);
  return () => {
    const i = streakStateListeners.indexOf(fn);
    if (i >= 0) streakStateListeners.splice(i, 1);
  };
}
