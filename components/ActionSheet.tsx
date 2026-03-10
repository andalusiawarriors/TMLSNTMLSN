/**
 * ActionSheet — Card deck style bottom popup.
 * Deck 349px wide; cards stacked 62/107/152/197 (top: saved, scan, search, bottom: repeat).
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Dimensions } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { BookmarkSimple, Camera, MagnifyingGlass, ArrowsClockwise } from 'phosphor-react-native';

const SCREEN_W = Dimensions.get('window').width;
const DECK_W = 349;
const CARD_RADIUS = 16;
const OVERLAP = 10;
const CARD_HEIGHTS = [62, 107, 152, 197] as const;
// Order top→bottom: saved, scan, search, repeat
const CARDS: { key: string; label: string; Icon: typeof BookmarkSimple }[] = [
  { key: 'saved', label: 'saved.', Icon: BookmarkSimple },
  { key: 'scan', label: 'scan.', Icon: Camera },
  { key: 'search', label: 'search.', Icon: MagnifyingGlass },
  { key: 'repeat', label: 'repeat.', Icon: ArrowsClockwise },
];
const ICON_SIZE = 18; // between 15.75 and 20.27
const ICON_LEFT = 17;
const LABEL_LEFT = 43;
const LABEL_TOP = 15;

export type ActionSheetProps = {
  visible: boolean;
  mealTitle: string;
  onClose: () => void;
  onRepeatLast: () => void;
  onSaved: () => void;
  onScan: () => void;
  onSearch: () => void;
  repeatLastSummary?: {
    title: string;
    subtitle: string;
    cal: string;
    macros: string;
  };
};

export function ActionSheet({
  visible, mealTitle, onClose,
  onRepeatLast, onSaved, onScan, onSearch,
}: ActionSheetProps) {
  const handlers = [onSaved, onScan, onSearch, onRepeatLast];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.dragPill} />
          <Text style={styles.sheetTitle}>{mealTitle}</Text>

          {/* Card deck: 349 wide, heights 62/107/152/197 */}
          <View style={styles.deck}>
            {CARDS.map(({ key, label, Icon }, i) => {
              const h = CARD_HEIGHTS[i];
              const top = i === 0 ? 0 : CARDS.slice(0, i).reduce((acc, _, j) => acc + CARD_HEIGHTS[j] - OVERLAP, 0);
              return (
                <Pressable
                  key={key}
                  style={[styles.card, { height: h, top }]}
                  onPress={handlers[i]}
                >
                  <View style={styles.iconWrap}>
                    <MaskedView
                      maskElement={
                        <View style={styles.iconMask}>
                          <Icon size={ICON_SIZE} color="#FFFFFF" weight="bold" />
                        </View>
                      }
                      style={styles.iconMaskView}
                    >
                      <LinearGradient
                        colors={['#5f5f5f', '#999999']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </MaskedView>
                  </View>
                  <Text style={styles.cardLabel}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#2f3031',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingBottom: 34,
    paddingHorizontal: (SCREEN_W - DECK_W) / 2,
  },
  dragPill: {
    width: 49,
    height: 7,
    borderRadius: 16,
    backgroundColor: '#424344',
    alignSelf: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 13,
    marginLeft: 14,
    marginBottom: 14,
  },
  deck: {
    width: DECK_W,
    height: CARD_HEIGHTS.reduce((a, h, i) => a + h - (i > 0 ? OVERLAP : 0), 0),
    position: 'relative',
  },
  card: {
    position: 'absolute',
    left: 0,
    width: DECK_W,
    borderRadius: CARD_RADIUS,
    backgroundColor: '#3a3c3d',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: LABEL_TOP,
  },
  iconWrap: {
    position: 'absolute',
    left: ICON_LEFT,
    top: LABEL_TOP,
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  iconMask: {
    backgroundColor: 'transparent',
    width: ICON_SIZE,
    height: ICON_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconMaskView: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  cardLabel: {
    marginLeft: LABEL_LEFT,
    fontSize: 19,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ActionSheet;
