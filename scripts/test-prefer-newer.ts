/**
 * Unit tests for preferNewer() in utils/streak.ts
 * Run: npx tsx scripts/test-prefer-newer.ts
 *
 * Locks down streak merge behavior so future edits cannot reintroduce
 * rollback or tie-break bugs.
 */
import './__test-setup';
import { preferNewer, type PersistedStreakState } from '../utils/streak';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

function mk(
  lastWorkoutYmd: string,
  lastWorkoutAt: string | null = null,
  streakDead = false
): PersistedStreakState {
  return {
    streakStartYmd: lastWorkoutYmd,
    lastWorkoutYmd,
    lastWorkoutAt,
    streakDead,
    exemptWeek: null,
  };
}

// 1. remote newer lastWorkoutYmd → remote should win
function test_remote_newer_lastWorkoutYmd_wins() {
  const remote = mk('2025-03-11');
  const local = mk('2025-03-10');
  const { state, source } = preferNewer(remote, local);
  assert(source === 'remote', 'remote newer ymd: source should be remote');
  assert(state.lastWorkoutYmd === '2025-03-11', 'remote newer ymd: state should have remote ymd');
}

// 2. local newer lastWorkoutYmd → local should win
function test_local_newer_lastWorkoutYmd_wins() {
  const remote = mk('2025-03-10');
  const local = mk('2025-03-11');
  const { state, source } = preferNewer(remote, local);
  assert(source === 'local', 'local newer ymd: source should be local');
  assert(state.lastWorkoutYmd === '2025-03-11', 'local newer ymd: state should have local ymd');
}

// 3. same lastWorkoutYmd, newer lastWorkoutAt wins
function test_same_lastWorkoutYmd_newer_lastWorkoutAt_wins() {
  const remote = mk('2025-03-10', '2025-03-10T10:00:00.000Z');
  const local = mk('2025-03-10', '2025-03-10T14:00:00.000Z');
  const { state, source } = preferNewer(remote, local);
  assert(source === 'local', 'local newer lastWorkoutAt: source should be local');
  assert(state.lastWorkoutAt === '2025-03-10T14:00:00.000Z', 'local newer lastWorkoutAt: state should have local lastWorkoutAt');
}

// 3b. same lastWorkoutYmd, remote has newer lastWorkoutAt
function test_same_lastWorkoutYmd_remote_newer_lastWorkoutAt_wins() {
  const remote = mk('2025-03-10', '2025-03-10T14:00:00.000Z');
  const local = mk('2025-03-10', '2025-03-10T10:00:00.000Z');
  const { state, source } = preferNewer(remote, local);
  assert(source === 'remote', 'remote newer lastWorkoutAt: source should be remote');
  assert(state.lastWorkoutAt === '2025-03-10T14:00:00.000Z', 'remote newer lastWorkoutAt: state should have remote lastWorkoutAt');
}

// 4. same lastWorkoutYmd, one missing lastWorkoutAt → state with present lastWorkoutAt wins
function test_same_lastWorkoutYmd_local_has_lastWorkoutAt_remote_missing_local_wins() {
  const remote = mk('2025-03-10', null);
  const local = mk('2025-03-10', '2025-03-10T14:00:00.000Z');
  const { state, source } = preferNewer(remote, local);
  assert(source === 'local', 'local has lastWorkoutAt, remote missing: local should win');
  assert(state.lastWorkoutAt === '2025-03-10T14:00:00.000Z', 'local has lastWorkoutAt: state should have local lastWorkoutAt');
}

function test_same_lastWorkoutYmd_remote_has_lastWorkoutAt_local_missing_remote_wins() {
  const remote = mk('2025-03-10', '2025-03-10T14:00:00.000Z');
  const local = mk('2025-03-10', null);
  const { state, source } = preferNewer(remote, local);
  assert(source === 'remote', 'remote has lastWorkoutAt, local missing: remote should win');
  assert(state.lastWorkoutAt === '2025-03-10T14:00:00.000Z', 'remote has lastWorkoutAt: state should have remote lastWorkoutAt');
}

// 4b. same lastWorkoutYmd, both missing lastWorkoutAt → tie goes to remote (documented)
function test_same_lastWorkoutYmd_both_missing_lastWorkoutAt_tie_goes_to_remote() {
  const remote = mk('2025-03-10', null);
  const local = mk('2025-03-10', null);
  const { state, source } = preferNewer(remote, local);
  assert(source === 'remote', 'both missing lastWorkoutAt: tie goes to remote');
  assert(state === remote, 'both missing lastWorkoutAt: state should be remote object');
}

// 5. same values, differing streak_dead → tie goes to remote, remote's streak_dead used
function test_same_lastWorkoutYmd_same_lastWorkoutAt_differing_streak_dead_tie_goes_to_remote() {
  const remote = mk('2025-03-10', '2025-03-10T10:00:00.000Z', true);
  const local = mk('2025-03-10', '2025-03-10T10:00:00.000Z', false);
  const { state, source } = preferNewer(remote, local);
  assert(source === 'remote', 'same ymd+at, differing streak_dead: tie goes to remote');
  assert(state.streakDead === true, 'tie: remote wins, so remote streak_dead (true) is used');
}

function test_same_lastWorkoutYmd_same_lastWorkoutAt_differing_streak_dead_remote_false_local_true() {
  const remote = mk('2025-03-10', '2025-03-10T10:00:00.000Z', false);
  const local = mk('2025-03-10', '2025-03-10T10:00:00.000Z', true);
  const { state, source } = preferNewer(remote, local);
  assert(source === 'remote', 'same ymd+at, differing streak_dead: tie goes to remote');
  assert(state.streakDead === false, 'tie: remote wins, so remote streak_dead (false) is used');
}

// 6. local is null → remote wins
function test_local_null_remote_wins() {
  const remote = mk('2025-03-10');
  const { state, source } = preferNewer(remote, null);
  assert(source === 'remote', 'local null: source should be remote');
  assert(state.lastWorkoutYmd === '2025-03-10', 'local null: state should be remote');
}

function main() {
  test_remote_newer_lastWorkoutYmd_wins();
  test_local_newer_lastWorkoutYmd_wins();
  test_same_lastWorkoutYmd_newer_lastWorkoutAt_wins();
  test_same_lastWorkoutYmd_remote_newer_lastWorkoutAt_wins();
  test_same_lastWorkoutYmd_local_has_lastWorkoutAt_remote_missing_local_wins();
  test_same_lastWorkoutYmd_remote_has_lastWorkoutAt_local_missing_remote_wins();
  test_same_lastWorkoutYmd_both_missing_lastWorkoutAt_tie_goes_to_remote();
  test_same_lastWorkoutYmd_same_lastWorkoutAt_differing_streak_dead_tie_goes_to_remote();
  test_same_lastWorkoutYmd_same_lastWorkoutAt_differing_streak_dead_remote_false_local_true();
  test_local_null_remote_wins();
  console.log('OK: all preferNewer tests passed');
  process.exit(0);
}

main();
