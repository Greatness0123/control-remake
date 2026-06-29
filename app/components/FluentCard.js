import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FluentTheme } from './theme';

export const FluentCard = ({ children, style, acrylic = false }) => {
  return (
    <View style={[
      styles.card,
      acrylic && styles.acrylic,
      style
    ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: FluentTheme.colors.neutralBackground,
    borderRadius: FluentTheme.borderRadius.large,
    padding: 16,
    ...FluentTheme.shadows.soft,
    borderWidth: 1,
    borderColor: FluentTheme.colors.neutralBorder,
  },
  acrylic: {
    backgroundColor: FluentTheme.colors.acrylic,
  }
});
