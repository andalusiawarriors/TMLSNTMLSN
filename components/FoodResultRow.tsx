import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing } from '../constants/theme';
import { isTmlsnTop100, isFoundationVerified, type ParsedNutrition } from '../utils/foodApi';

const QUICKSILVER_VERIFIED_BADGE = require('../assets/quicksilver_verified_badge.png');
const GOLD_VERIFIED_BADGE = require('../assets/gold_checkmark_badge.png');

const CHAMPAGNE_GRADIENT = ['#E5D4B8', '#D4B896', '#A8895E'] as const;
const QUICKSILVER_GRADIENT = ['#6b6f74', '#a0a4a8', '#d6d8da', '#b8babc'] as const;
const QUICKSILVER_GRADIENT_LOCATIONS = [0, 0.025, 0.525, 1] as const;
const QUICKSILVER_TEXT = '#9A9EA4';
const CHAMPAGNE_TEXT = '#D4B896';
const TMLSN_VERIFIED_TICK_HEIGHT = 18;

const CHAMPAGNE_STRIPE_GRADIENT = ['rgba(229,212,184,0)', '#E5D4B8', '#D4B896', '#A8895E', 'rgba(168,137,94,0)'] as const;
const CHAMPAGNE_STRIPE_LOCATIONS = [0, 0.2, 0.5, 0.8, 1] as const;
const QUICKSILVER_STRIPE_GRADIENT = ['rgba(110,124,135,0)', '#6e7c87', '#7e8e9a', '#a1a7ae', '#c6c6c7', 'rgba(198,198,199,0)'] as const;
const QUICKSILVER_STRIPE_GRADIENT_LOCATIONS = [0, 0.18, 0.4, 0.6, 0.82, 1] as const;

const FAB_CARD_BORDER_RADIUS = 12;
const CARD_BORDER_INSET = 1;
const CARD_HEIGHT = 88;
const CARD_FILL = '#292A2B';

interface Props {
  item: ParsedNutrition;
  onPress: (item: ParsedNutrition) => void;
}

export const FoodResultRow: React.FC<Props> = ({ item, onPress }) => {
  const hasBrand = item.brand && item.brand.trim() !== '';
  const top100 = isTmlsnTop100(item);
  const isVerified = isFoundationVerified(item);
  const showVerifiedStripe = !hasBrand && (top100 || isVerified);

  return (
    <View
      style={styles.historyCardBorderWrap}
      onStartShouldSetResponder={() => true}
      onResponderRelease={() => onPress(item)}
    >
      <LinearGradient
        colors={Colors.tabBarBorder}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: FAB_CARD_BORDER_RADIUS }]}
      />
      {showVerifiedStripe && (
        <LinearGradient
          colors={top100 ? CHAMPAGNE_STRIPE_GRADIENT : QUICKSILVER_STRIPE_GRADIENT}
          locations={top100 ? CHAMPAGNE_STRIPE_LOCATIONS : QUICKSILVER_STRIPE_GRADIENT_LOCATIONS}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.verifiedCardLeftStripe}
        />
      )}
      <View style={[styles.cardShell, styles.historyCardShell]}>
        <View style={styles.historyCardLeft}>
          {(() => {
            const brandLabel = item.brand && item.brand.trim() !== '' ? item.brand : '';
            if (brandLabel) {
              return (
                <>
                  <Text style={[styles.resultBrand, item.source === 'off' && { color: '#FFFFFF' }]} numberOfLines={1} ellipsizeMode="tail">
                    {brandLabel}
                  </Text>
                  {top100 ? (
                    <View style={[styles.verifiedNameRow, { marginTop: 2 }]}>
                      <MaskedView style={styles.verifiedNameMaskWrap} maskElement={<Text style={[styles.resultName, styles.verifiedNameText, { backgroundColor: 'transparent' }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>}>
                        <LinearGradient colors={CHAMPAGNE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                          <Text style={[styles.resultName, styles.verifiedNameText, { opacity: 0 }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                        </LinearGradient>
                      </MaskedView>
                      <Image source={GOLD_VERIFIED_BADGE} style={{ width: TMLSN_VERIFIED_TICK_HEIGHT, height: TMLSN_VERIFIED_TICK_HEIGHT, marginLeft: 2, flexShrink: 0 }} resizeMode="contain" />
                    </View>
                  ) : isVerified ? (
                    <View style={[styles.verifiedNameRow, { marginTop: 2 }]}>
                      <MaskedView style={styles.verifiedNameMaskWrap} maskElement={<Text style={[styles.resultName, styles.verifiedNameText, { backgroundColor: 'transparent' }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>}>
                        <LinearGradient colors={QUICKSILVER_GRADIENT} locations={QUICKSILVER_GRADIENT_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                          <Text style={[styles.resultName, styles.verifiedNameText, { opacity: 0 }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                        </LinearGradient>
                      </MaskedView>
                      <Image source={QUICKSILVER_VERIFIED_BADGE} style={{ width: TMLSN_VERIFIED_TICK_HEIGHT, height: TMLSN_VERIFIED_TICK_HEIGHT, marginLeft: 2 }} resizeMode="contain" />
                    </View>
                  ) : (
                    <Text style={[styles.resultName, item.source === 'off' && { color: '#FFFFFF' }, { marginTop: 2 }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                  )}
                </>
              );
            }
            if (top100) {
              return (
                <View style={styles.verifiedNameRow}>
                  <MaskedView style={styles.verifiedNameMaskWrap} maskElement={<Text style={[styles.resultName, styles.verifiedNameText, { backgroundColor: 'transparent' }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>}>
                    <LinearGradient colors={CHAMPAGNE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Text style={[styles.resultName, styles.verifiedNameText, { opacity: 0 }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                    </LinearGradient>
                  </MaskedView>
                  <Image source={GOLD_VERIFIED_BADGE} style={{ width: TMLSN_VERIFIED_TICK_HEIGHT, height: TMLSN_VERIFIED_TICK_HEIGHT, marginLeft: 2 }} resizeMode="contain" />
                </View>
              );
            }
            if (isVerified) {
              return (
                <View style={styles.verifiedNameRow}>
                  <MaskedView style={styles.verifiedNameMaskWrap} maskElement={<Text style={[styles.resultName, styles.verifiedNameText, { backgroundColor: 'transparent' }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>}>
                    <LinearGradient colors={QUICKSILVER_GRADIENT} locations={QUICKSILVER_GRADIENT_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Text style={[styles.resultName, styles.verifiedNameText, { opacity: 0 }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                    </LinearGradient>
                  </MaskedView>
                  <Image source={QUICKSILVER_VERIFIED_BADGE} style={{ width: TMLSN_VERIFIED_TICK_HEIGHT, height: TMLSN_VERIFIED_TICK_HEIGHT, marginLeft: 2 }} resizeMode="contain" />
                </View>
              );
            }
            return null;
          })()}
          {!(item.brand && item.brand.trim() !== '') && !isTmlsnTop100(item) && !isFoundationVerified(item) ? (
            <Text style={[styles.resultName, item.source === 'off' && { color: '#FFFFFF' }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
          ) : null}
          <View style={styles.macrosRow}>
            <Text style={styles.macrosPrefix}>per 100{item.unit ?? 'g'}</Text>
            {isTmlsnTop100(item) ? (
              <Text style={{ fontSize: 12, fontWeight: '500', color: CHAMPAGNE_TEXT }}>{item.calories} cal · {item.protein}g P · {item.carbs}g C · {item.fat}g F</Text>
            ) : isFoundationVerified(item) ? (
              <Text style={{ fontSize: 12, fontWeight: '500', color: QUICKSILVER_TEXT }}>{item.calories} cal · {item.protein}g P · {item.carbs}g C · {item.fat}g F</Text>
            ) : (
              <Text style={{ fontSize: 12, fontWeight: '500', color: '#FFFFFF' }}>{item.calories} cal · {item.protein}g P · {item.carbs}g C · {item.fat}g F</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  historyCardBorderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: CARD_HEIGHT,
    borderRadius: FAB_CARD_BORDER_RADIUS,
    paddingHorizontal: Spacing.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  cardShell: {
    position: 'absolute',
    top: CARD_BORDER_INSET,
    left: CARD_BORDER_INSET,
    right: CARD_BORDER_INSET,
    bottom: CARD_BORDER_INSET,
    borderRadius: FAB_CARD_BORDER_RADIUS - CARD_BORDER_INSET,
    backgroundColor: CARD_FILL,
  },
  historyCardShell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  historyCardLeft: {
    flex: 1,
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  verifiedCardLeftStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    borderTopLeftRadius: FAB_CARD_BORDER_RADIUS,
    borderBottomLeftRadius: FAB_CARD_BORDER_RADIUS,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  resultBrand: {
    fontSize: 11,
    color: Colors.primaryLight,
    fontWeight: '400',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  verifiedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 2,
    flexShrink: 1,
  },
  verifiedNameMaskWrap: {
    flexShrink: 1,
    maxWidth: '100%',
  },
  verifiedNameText: {
    marginBottom: 0,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: -0.11,
  },
  macrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  macrosPrefix: {
    fontSize: 10,
    color: Colors.primaryLight,
  },
});
