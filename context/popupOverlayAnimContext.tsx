import React from 'react';
import { Animated } from 'react-native';

export const PopupOverlayAnimContext = React.createContext<Animated.Value | null>(null);
