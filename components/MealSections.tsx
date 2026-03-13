/**
 * MealSections — breakfast. / lunch. / dinner. / other. with ellipsis icons.
 * Ellipsis is 8px right of the "breakfast." title, then all other ellipses
 * align to the same X position regardless of title width.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { DotsThree } from 'phosphor-react-native';

export type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'other';

const MEALS: { key: MealKey; label: string }[] = [
  { key: 'breakfast', label: 'breakfast.' },
  { key: 'lunch', label: 'lunch.' },
  { key: 'dinner', label: 'dinner.' },
  { key: 'other', label: 'other.' },
];

const TITLE_GAP = 21;
// Width of "breakfast." (17pt semibold) so ellipsis is 8px right of that label; other rows use same column so ellipses align
const TITLE_COLUMN_WIDTH = 95;
const ELLIPSIS_GAP = 8;

export type MealSectionsProps = {
  onMealEllipsisPress: (meal: MealKey) => void;
  onMealLongPress: (meal: MealKey) => void;
};

export function MealSections({ onMealEllipsisPress, onMealLongPress }: MealSectionsProps) {
  return (
    <View style={styles.container}>
      {MEALS.map(({ key, label }, i) => (
        <View key={key} style={[styles.row, i === MEALS.length - 1 && styles.rowLast]}>
          <Pressable onLongPress={() => onMealLongPress(key)} style={styles.titleWrap}>
            <Text style={styles.title}>{label}</Text>
          </Pressable>
          <Pressable
            onPress={() => onMealEllipsisPress(key)}
            hitSlop={8}
            style={styles.ellipsisBtn}
          >
            <DotsThree size={15} color="rgba(255,255,255,0.5)" weight="bold" />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 15,
    width: '100%',
    paddingHorizontal: 31,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: TITLE_GAP,
  },
  rowLast: { marginBottom: 0 },
  titleWrap: {
    width: TITLE_COLUMN_WIDTH,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ellipsisBtn: {
    width: 15 + ELLIPSIS_GAP,
    marginLeft: ELLIPSIS_GAP,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MealSections;
