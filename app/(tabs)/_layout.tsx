import { Tabs } from 'expo-router';
import { Colors, Typography } from '../../constants/theme';
import { Platform, Text, Image, View, Pressable } from 'react-native';

// Blur: after `npx expo install expo-blur`, add tabBarBackground with BlurView (see constants/theme primaryDarkLighter for tint)

const TAB_LABEL_STYLE = {
  fontSize: 11,
  fontFamily: 'EBGaramond_700Bold',
  letterSpacing: -81,
  color: Colors.white,
  marginTop: 6,
  lineHeight: 14,
};
const ICON_BOX_SIZE = 24;

const PILL_BOTTOM = Platform.OS === 'ios' ? 28 : 12;
const PILL_HEIGHT = Platform.OS === 'ios' ? 64 : 56;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primaryLight,
        tabBarInactiveTintColor: Colors.primaryLight,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: PILL_BOTTOM,
          height: PILL_HEIGHT,
          backgroundColor: 'rgba(61, 62, 63, 0.97)',
          borderRadius: 32,
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          elevation: 0,
          shadowOpacity: 0,
          overflow: 'hidden',
        },
        tabBarItemStyle: {
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'EBGaramond_700Bold',
          letterSpacing: -81,
          color: Colors.white,
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
            const { style, children, ...rest } = props;
            return (
              <Pressable
                {...rest}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8 }}
              >
                <View style={{ alignItems: 'center' }}>
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
          headerTitle: 'WORKOUT TRACKER',
          tabBarIcon: () => null,
          tabBarButton: (props) => {
            const { children, ...rest } = props;
            return (
              <Pressable
                {...rest}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8 }}
              >
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: ICON_BOX_SIZE, height: ICON_BOX_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: ICON_BOX_SIZE, lineHeight: ICON_BOX_SIZE, color: Colors.white }}>💪</Text>
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
            const { children, ...rest } = props;
            return (
              <Pressable
                {...rest}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8 }}
              >
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: ICON_BOX_SIZE, height: ICON_BOX_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: ICON_BOX_SIZE, lineHeight: ICON_BOX_SIZE, color: Colors.white }}>📝</Text>
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
