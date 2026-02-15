/**
 * Single source of truth for the "streak popup" content shift (left-then-right).
 * Layout owns the Animated.Value and runs the animation; tab bar and nutrition
 * content both use this value so they move at the same rate and stay in sync.
 */
import React from 'react';
import { Animated } from 'react-native';

export const StreakShiftContext = React.createContext<Animated.Value | null>(null);