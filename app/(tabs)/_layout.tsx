import { Tabs, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Colors, Typography } from '../../constants/theme';
import { Platform, Text, Image, View, Pressable, StyleSheet } from 'react-native';

const PILL_LABEL_COLOR = '#C6C6C6';
const TAB_LABEL_STYLE = {
  fontSize: 11,
  fontFamily: 'DMMono_400Regular',
  letterSpacing: -0.1,
  color: PILL_LABEL_COLOR,
  marginTop: 6,
  lineHeight: 14,
  textShadowColor: 'rgba(0, 0, 0, 0.5)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 2,
};
const ICON_BOX_SIZE = 24;

const PILL_BOTTOM = Platform.OS === 'ios' ? 28 : 12;
// 5% taller on top and bottom each → 10% taller total
const PILL_HEIGHT = Platform.OS === 'ios' ? Math.round(64 * 1.1) : Math.round(56 * 1.1); // 70 (ios), 62 (android)
const PILL_OPACITY = 0.5;
const PILL_BG = `rgba(61, 62, 63, ${PILL_OPACITY})`;

// Bubble: solid color + border so it’s always visible
const SELECTED_TAB_PILL_COLOR = '#7A7B7C';
const SELECTED_TAB_PILL_BORDER = 'rgba(255,255,255,0.35)';
const SELECTED_TAB_PILL_PADDING_H = 16;
const SELECTED_TAB_PILL_PADDING_V = 12;
const SELECTED_TAB_PILL_RADIUS = 22;
const SELECTED_TAB_PILL_MIN_WIDTH = 88;
const SELECTED_TAB_PILL_MIN_HEIGHT = 48;

export default function TabsLayout() {
  const pathname = usePathname();
  const isNutritionSelected = pathname.includes('nutrition');
  const isWorkoutSelected = pathname.includes('workout');
  const isPromptsSelected = pathname.includes('prompts');

  return (
    <Tabs
      initialRouteName="nutrition"
      screenOptions={{
        tabBarActiveTintColor: Colors.primaryLight,
        tabBarInactiveTintColor: Colors.primaryLight,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          position: 'absolute',
          left: '16%',
          right: '16%',
          bottom: PILL_BOTTOM,
          height: PILL_HEIGHT,
          backgroundColor: 'transparent',
          borderRadius: 32,
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          elevation: 0,
          shadowOpacity: 0,
          overflow: 'hidden',
        },
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { borderRadius: 32, overflow: 'hidden' },
            ]}
          >
            <BlurView
              intensity={50}
              tint="systemUltraThinMaterialDark"
              style={StyleSheet.absoluteFillObject}
            />
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: PILL_BG },
              ]}
            />
          </View>
        ),
        tabBarItemStyle: {
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'DMMono_400Regular',
          letterSpacing: -0.1,
          color: PILL_LABEL_COLOR,
          textShadowColor: 'rgba(0, 0, 0, 0.5)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        },
        headerStyle: {
          backgroundColor: Colors.primaryDark,
        },
        headerTintColor: Colors.white,
        headerTitleStyle: {
          fontSize: Typography.h1,
          fontWeight: Typography.weights.bold,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
          title: 'Home',
          headerTitle: 'TMLSN',
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'TMLSN CAL',
          tabBarLabel: 'TMLSN CAL',
          headerShown: false,
          tabBarIcon: () => null,
          tabBarButton: (props) => {
            const { style, children, accessibilityState, ...rest } = props;
            const selected = (accessibilityState?.selected ?? false) || isNutritionSelected;
            return (
              <Pressable
                {...rest}
                accessibilityState={accessibilityState}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8 }}
              >
                <View
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: selected ? SELECTED_TAB_PILL_PADDING_H : 0,
                    paddingVertical: selected ? SELECTED_TAB_PILL_PADDING_V : 0,
                    borderRadius: SELECTED_TAB_PILL_RADIUS,
                    backgroundColor: selected ? SELECTED_TAB_PILL_COLOR : 'transparent',
                    ...(selected && {
                      borderWidth: 1,
                      borderColor: SELECTED_TAB_PILL_BORDER,
                      minWidth: SELECTED_TAB_PILL_MIN_WIDTH,
                      minHeight: SELECTED_TAB_PILL_MIN_HEIGHT,
                    }),
                  }}
                >
                  <View style={{ width: ICON_BOX_SIZE, height: ICON_BOX_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                    <Image
                      source={require('../../assets/tmlsn-tab-icon.png')}
                      style={{ width: ICON_BOX_SIZE, height: ICON_BOX_SIZE }}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={TAB_LABEL_STYLE}>TMLSN CAL</Text>
                </View>
              </Pressable>
            );
          },
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'WORKOUT TRACKER',
          tabBarLabel: 'WORKOUT TRACKER',
          headerShown: false,
          tabBarIcon: () => null,
          tabBarButton: (props) => {
            const { children, accessibilityState, ...rest } = props;
            const selected = (accessibilityState?.selected ?? false) || isWorkoutSelected;
            return (
              <Pressable
                {...rest}
                accessibilityState={accessibilityState}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8 }}
              >
                <View
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: selected ? SELECTED_TAB_PILL_PADDING_H : 0,
                    paddingVertical: selected ? SELECTED_TAB_PILL_PADDING_V : 0,
                    borderRadius: SELECTED_TAB_PILL_RADIUS,
                    backgroundColor: selected ? SELECTED_TAB_PILL_COLOR : 'transparent',
                    ...(selected && {
                      borderWidth: 1,
                      borderColor: SELECTED_TAB_PILL_BORDER,
                      minWidth: SELECTED_TAB_PILL_MIN_WIDTH,
                      minHeight: SELECTED_TAB_PILL_MIN_HEIGHT,
                    }),
                  }}
                >
                  <View style={{ width: ICON_BOX_SIZE, height: ICON_BOX_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: ICON_BOX_SIZE, lineHeight: ICON_BOX_SIZE, color: PILL_LABEL_COLOR }}>💪</Text>
                  </View>
                  <Text style={TAB_LABEL_STYLE}>WORKOUT TRACKER</Text>
                </View>
              </Pressable>
            );
          },
        }}
      />
      <Tabs.Screen
        name="prompts"
        options={{
          title: 'PROMPTS',
          tabBarLabel: 'PROMPTS',
          headerTitle: 'PROMPTS',
          tabBarIcon: () => null,
          tabBarButton: (props) => {
            const { children, accessibilityState, ...rest } = props;
            const selected = (accessibilityState?.selected ?? false) || isPromptsSelected;
            return (
              <Pressable
                {...rest}
                accessibilityState={accessibilityState}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8 }}
              >
                <View
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: selected ? SELECTED_TAB_PILL_PADDING_H : 0,
                    paddingVertical: selected ? SELECTED_TAB_PILL_PADDING_V : 0,
                    borderRadius: SELECTED_TAB_PILL_RADIUS,
                    backgroundColor: selected ? SELECTED_TAB_PILL_COLOR : 'transparent',
                    ...(selected && {
                      borderWidth: 1,
                      borderColor: SELECTED_TAB_PILL_BORDER,
                      minWidth: SELECTED_TAB_PILL_MIN_WIDTH,
                      minHeight: SELECTED_TAB_PILL_MIN_HEIGHT,
                    }),
                  }}
                >
                  <View style={{ width: ICON_BOX_SIZE, height: ICON_BOX_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: ICON_BOX_SIZE, lineHeight: ICON_BOX_SIZE, color: PILL_LABEL_COLOR }}>📝</Text>
                  </View>
                  <Text style={TAB_LABEL_STYLE}>PROMPTS</Text>
                </View>
              </Pressable>
            );
          },
        }}
      />
    </Tabs>
  );
}
