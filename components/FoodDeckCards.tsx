/**
 * FoodDeckCards — Stacked card deck from Add Food button.
 * Order bottom→top: repeat, search, scan, saved. All 349 wide, heights 62/107/152/197.
 * Labels: 15px from top, 43px from left; SF Pro Semibold 19pt #FFF. Icons 17px from left, gradient.
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Dimensions,
  Animated, Easing,
} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BookmarkSimple as SavedIcon,
  Camera as ScanIcon,
  MagnifyingGlass as SearchIcon,
  ArrowsClockwise as RepeatIcon,
} from 'phosphor-react-native';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const PILL_MARGIN_H = 19;
const CARD_W = SCREEN_W - 2 * PILL_MARGIN_H;
const STACK_BOTTOM = 88;
const BOTTOM_EXTENSION = 88; // cards extend down to overlap nav pill
const BOTTOM_BELOW_SCREEN = 88; // card bottom starts below screen bottom (off-screen)
const CARD_RADIUS = 28;
const CARD_COLOR = '#2a2b2c';
const LABEL_TOP = 15;
const LABEL_LEFT = 43;
const LABEL_FONT_SIZE = 19;
const LABEL_LINE_HEIGHT = 23; // ~line height for 19pt
const ICON_LEFT = 17;
const ICON_SIZE = 18; // between 15.75 and 20.27
// Center icon vertically with label: label center = LABEL_TOP + LABEL_LINE_HEIGHT/2, icon top = that - ICON_SIZE/2
const ICON_TOP = LABEL_TOP + LABEL_LINE_HEIGHT / 2 - ICON_SIZE / 2;

// Order: front (top) = saved, then scan, search, back (bottom) = repeat
const CARDS = [
  { key: 'saved',  h: 62,  label: 'saved.',  Icon: SavedIcon },
  { key: 'scan',   h: 107, label: 'scan.',  Icon: ScanIcon },
  { key: 'search', h: 152, label: 'search.', Icon: SearchIcon },
  { key: 'repeat', h: 197, label: 'repeat.', Icon: RepeatIcon },
] as const;

// Tallest card defines the stack footprint
const STACK_HEIGHT = CARDS[CARDS.length - 1].h;

export type FoodDeckCardsProps = {
  visible: boolean;
  onSelect: (card: 'saved' | 'scan' | 'search' | 'repeat') => void;
  onDismiss: () => void;
  /** Optional overlay opacity to animate in sync with close (same start/end) */
  overlayOpacityRef?: Animated.Value;
  /** When set, selected card rises so its top is at this Y (from top of screen). E.g. carb label bottom + 8. */
  riseTargetY?: number;
  /** Called when the close animation completes (backdrop tap or card select). */
  onCloseComplete?: () => void;
};

export function FoodDeckCards({ visible, onSelect, onDismiss, overlayOpacityRef, riseTargetY, onCloseComplete }: FoodDeckCardsProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const closeFromBackdropRef = useRef(false);
  const closeFromCardSelectRef = useRef(false);
  const dismissedFromBackdropRef = useRef(false); // true when backdrop tap (cancel), false when card tap (confirm)
  const justClosedFromBackdropRef = useRef(false);
  const justClosedFromCardSelectRef = useRef(false);
  const closeFromCardSelectKeyRef = useRef<'saved' | 'scan' | 'search' | 'repeat' | null>(null);
  const deckOpacityRef = useRef(new Animated.Value(1)).current;
  const oneVal = useRef(new Animated.Value(1)).current;

  // Front card (saved, i=0) morphs from button position.
  // Back cards (scan, search, repeat) rise as a group.
  const frontTranslateY = useRef(new Animated.Value(100)).current;
  const frontOpacity = useRef(new Animated.Value(0)).current;
  const frontScale = useRef(new Animated.Value(0.85)).current;

  // Back cards animate as one group
  const groupTranslateY = useRef(new Animated.Value(120)).current;
  const groupOpacity = useRef(new Animated.Value(0)).current;

  // Select animation: scaleY from bottom (height grows, bottom fixed) + compensate translateY
  const selectAnims = useRef(
    CARDS.map(() => ({
      scaleY: new Animated.Value(1),
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    if (visible) {
      deckOpacityRef.setValue(1);
      justClosedFromCardSelectRef.current = false;
      setSelectedIndex(null);
    }
  }, [visible, deckOpacityRef]);

  // Reset select anims on open
  useEffect(() => {
    if (visible) {
      selectAnims.forEach((a) => {
        a.scaleY.setValue(1);
        a.translateY.setValue(0);
        a.opacity.setValue(1);
      });
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      if (justClosedFromCardSelectRef.current) {
        // Skip entrance — we're about to unmount; avoid re-running entrance anim (causes snap)
        return;
      }
      setIsExiting(false);
      // All cards animate in together — one continuous slide-up, no rebound
      frontTranslateY.setValue(60);
      frontOpacity.setValue(0);
      frontScale.setValue(0.88);
      groupTranslateY.setValue(120);
      groupOpacity.setValue(0);

      Animated.parallel([
        Animated.parallel([
          Animated.timing(frontTranslateY, {
            toValue: 0, duration: 234,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(frontOpacity, {
            toValue: 1, duration: 162,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(frontScale, {
            toValue: 1, duration: 234,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(groupTranslateY, {
            toValue: 0, duration: 270,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(groupOpacity, {
            toValue: 1, duration: 198,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      if (justClosedFromBackdropRef.current) {
        justClosedFromBackdropRef.current = false;
        return;
      }
      if (justClosedFromCardSelectRef.current) {
        // Don't reset — keeps us rendering until Modal unmounts; avoids snap/early null
        return;
      }
      closeFromBackdropRef.current = false;
      setIsExiting(true);
    }
  }, [visible]);

  // Run close animation when isExiting becomes true
  useEffect(() => {
    if (!isExiting) return;
    const fromBackdrop = closeFromBackdropRef.current;
    const fromCardSelect = closeFromCardSelectRef.current;

    if (fromCardSelect) {
      closeFromCardSelectRef.current = false;
      const selectedKeyRef = closeFromCardSelectKeyRef.current;
      const cancelledByBackdrop = dismissedFromBackdropRef.current;

      if (cancelledByBackdrop) {
        // Backdrop tap: animate card down first, then close (cancel — no onSelect)
        const selIdx = selectedKeyRef ? CARDS.findIndex((c) => c.key === selectedKeyRef) : -1;
        const collapseAnims: Animated.CompositeAnimation[] = [];
        if (selIdx >= 0) {
          collapseAnims.push(
            Animated.parallel([
              Animated.timing(selectAnims[selIdx].scaleY, {
                toValue: 1, duration: 180,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(selectAnims[selIdx].translateY, {
                toValue: 0, duration: 180,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ])
          );
          CARDS.forEach((_, i) => {
            if (i !== selIdx) {
              collapseAnims.push(
                Animated.timing(selectAnims[i].opacity, {
                  toValue: 1, duration: 120,
                  easing: Easing.out(Easing.ease),
                  useNativeDriver: true,
                })
              );
            }
          });
        }
        const collapse = collapseAnims.length > 0
          ? Animated.parallel(collapseAnims)
          : Animated.delay(0);
        const cardCloseAnims = [
          Animated.parallel([
            Animated.timing(frontTranslateY, {
              toValue: 60, duration: 120,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(frontOpacity, { toValue: 0, duration: 83, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(frontScale, { toValue: 0.88, duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(groupTranslateY, {
              toValue: 120, duration: 138,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(groupOpacity, { toValue: 0, duration: 101, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          ]),
        ];
        const overlayFade = overlayOpacityRef
          ? Animated.timing(overlayOpacityRef, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true })
          : null;
        Animated.sequence([
          collapse,
          Animated.parallel([...cardCloseAnims, ...(overlayFade ? [overlayFade] : [])]),
        ]).start(() => {
          justClosedFromBackdropRef.current = true;
          setIsExiting(false);
          onCloseComplete?.();
        });
        return;
      }

      // Card tap (confirm): fade deck, then onSelect
      const deckFade = Animated.timing(deckOpacityRef, {
        toValue: 0, duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      });
      const overlayFade = overlayOpacityRef
        ? Animated.timing(overlayOpacityRef, {
            toValue: 1, duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        : null;
      Animated.parallel(overlayFade ? [deckFade, overlayFade] : [deckFade]).start(() => {
        justClosedFromCardSelectRef.current = true;
        setIsExiting(false);
        requestAnimationFrame(() => {
          if (selectedKeyRef) onSelect(selectedKeyRef as any);
          onCloseComplete?.();
        });
      });
      return;
    }

    const shouldNotify = fromBackdrop;
    const cardAnims = [
      Animated.parallel([
        Animated.timing(frontTranslateY, {
          toValue: 60, duration: 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(frontOpacity, {
          toValue: 0, duration: 83,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(frontScale, {
          toValue: 0.88, duration: 120,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(groupTranslateY, {
          toValue: 120, duration: 138,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(groupOpacity, {
          toValue: 0, duration: 101,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ];
    const overlayFade = overlayOpacityRef
      ? Animated.timing(overlayOpacityRef, {
          toValue: 1, duration: 138,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      : null;
    Animated.parallel(overlayFade ? [...cardAnims, overlayFade] : cardAnims).start(() => {
      closeFromBackdropRef.current = false;
      if (shouldNotify) justClosedFromBackdropRef.current = true;
      setIsExiting(false);
      onCloseComplete?.();
      // onDismiss already called at close start (backdrop tap) so overlay fades in sync
    });
  }, [isExiting, onDismiss, overlayOpacityRef, onCloseComplete]);

  const handleDismissRaised = useCallback(() => {
    if (selectedIndex == null || isExiting) return;
    closeFromCardSelectRef.current = true;
    onDismiss();
    setIsExiting(true);
  }, [selectedIndex, isExiting, onDismiss]);

  const handleSelect = useCallback((index: number) => {
    if (selectedIndex === index) {
      dismissedFromBackdropRef.current = false; // card tap = confirm
      handleDismissRaised();
      return;
    }
    if (selectedIndex != null) return; // Another card already selected
    setSelectedIndex(index);

    const cardH = CARDS[index].h;
    const baseHeight = cardH + BOTTOM_EXTENSION + BOTTOM_BELOW_SCREEN;
    const targetTopY = riseTargetY ?? 200;
    // Card bottom stays at SCREEN_H + BOTTOM_BELOW_SCREEN; top must reach targetTopY
    const targetHeight = (SCREEN_H + BOTTOM_BELOW_SCREEN) - targetTopY;
    const targetScaleY = Math.max(1, targetHeight / baseHeight);
    // transformOrigin: bottom keeps bottom fixed; no translateY compensation needed

    CARDS.forEach((_, i) => {
      if (i === index) {
        Animated.parallel([
          Animated.timing(selectAnims[i].scaleY, {
            toValue: targetScaleY, duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(selectAnims[i].translateY, {
            toValue: 0, duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.timing(selectAnims[i].opacity, {
          toValue: 0, duration: 180,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start();
      }
    });
    closeFromCardSelectKeyRef.current = CARDS[index].key;
  }, [selectAnims, riseTargetY, selectedIndex, handleDismissRaised]);

  const handleBackdropPress = useCallback(() => {
    if (!visible || isExiting) return;
    if (selectedIndex != null) {
      dismissedFromBackdropRef.current = true; // backdrop tap = cancel
      handleDismissRaised();
      return;
    }
    closeFromBackdropRef.current = true;
    onDismiss();
    setIsExiting(true);
  }, [visible, isExiting, onDismiss, selectedIndex, handleDismissRaised]);

  // Keep faded deck mounted until Modal unmounts; avoid flash from early null
  if (!visible && !isExiting && !justClosedFromCardSelectRef.current) return null;

  return (
    <View style={styles.deckWrap} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: deckOpacityRef }]} pointerEvents="box-none">
      <View style={styles.stackAnchor} pointerEvents="box-none">
        {/* Render back to front: tallest (repeat) first, shortest (saved) last */}
        {[...CARDS].reverse().map((card, reverseIdx) => {
          const i = CARDS.length - 1 - reverseIdx; // original index
          const { Icon, h } = card;
          const isFront = i === 0;

          // Cards extend down so bottom starts below screen; content stays at top
          const bottomOffset = -(BOTTOM_EXTENSION + BOTTOM_BELOW_SCREEN);
          const cardHeight = h + BOTTOM_EXTENSION + BOTTOM_BELOW_SCREEN;

          // Animation: front card uses its own anim, back cards use group anim
          const baseTranslateY = isFront ? frontTranslateY : groupTranslateY;
          const translateY = Animated.add(baseTranslateY, selectAnims[i].translateY);
          const baseOpacity = isFront ? frontOpacity : groupOpacity;
          const opacity = Animated.multiply(baseOpacity, selectAnims[i].opacity);
          const cardScaleY = isFront
            ? Animated.multiply(frontScale, selectAnims[i].scaleY)
            : selectAnims[i].scaleY;

          const transform: any[] = [
            { translateY },
            { scaleY: cardScaleY },
            ...(isFront ? [{ scaleX: frontScale }] : []),
          ];

          // Inverse scaleY on content so label/icon don't stretch when card grows
          const contentScaleY = Animated.divide(oneVal, cardScaleY);

          return (
            <Animated.View
              key={card.key}
              style={[
                styles.card,
                {
                  height: cardHeight,
                  bottom: bottomOffset,
                  zIndex: CARDS.length - i,
                  transform,
                  transformOrigin: ['50%', '100%', 0] as const,
                  opacity,
                },
              ]}
            >
              <Animated.View style={{ flex: 1, transform: [{ scaleY: contentScaleY }] }}>
                <Pressable
                  onPress={() => handleSelect(i)}
                  style={({ pressed }) => [
                    styles.cardInner,
                    pressed && styles.cardPressed,
                  ]}
                >
                  {/* Icon: 17px from left, gradient #5f5f5f → #999999 */}
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
                {/* Label: 15px from top, 43px from left, SF Pro Semibold 19pt #FFF */}
                <Text style={styles.cardLabel}>{card.label}</Text>
                </Pressable>
              </Animated.View>
            </Animated.View>
          );
        })}
      </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  deckWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100000,
    elevation: 100000,
    overflow: 'visible',
  },
  stackAnchor: {
    position: 'absolute',
    bottom: STACK_BOTTOM,
    left: (SCREEN_W - CARD_W) / 2,
    width: CARD_W,
    height: STACK_HEIGHT,
    overflow: 'visible',
  },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  cardInner: {
    flex: 1,
    borderRadius: CARD_RADIUS,
    backgroundColor: CARD_COLOR,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  cardPressed: {
    backgroundColor: '#333435',
  },
  iconWrap: {
    position: 'absolute',
    left: ICON_LEFT,
    top: ICON_TOP,
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
    position: 'absolute',
    left: LABEL_LEFT,
    top: LABEL_TOP,
    fontSize: 19,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default FoodDeckCards;
