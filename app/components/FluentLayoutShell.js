import React from 'react';
import { View, StyleSheet, useWindowDimensions, Platform } from 'react-native';

export const FluentLayoutShell = ({ children, variant = 'narrow', style }) => {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isLargeScreen = width >= 720;

  const getMaxWidth = () => {
    if (!isWeb || !isLargeScreen) return '100%';
    return variant === 'wide' ? 1100 : 720;
  };

  const containerStyle = [
    styles.base,
    isWeb && isLargeScreen && {
      maxWidth: getMaxWidth(),
      alignSelf: 'center',
      width: '100%',
    },
    style
  ];

  return (
    <View style={containerStyle}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flex: 1,
    width: '100%',
  }
});
