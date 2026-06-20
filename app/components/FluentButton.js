import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { FluentTheme } from './theme';

export const FluentButton = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  icon: Icon,
  style
}) => {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        styles[size],
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        isOutline && styles.outline,
        isGhost && styles.ghost,
        disabled && styles.disabled,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : FluentTheme.colors.accent} />
      ) : (
        <>
          {Icon && <Icon size={size === 'small' ? 16 : 20} color={isPrimary ? '#fff' : FluentTheme.colors.accent} style={{ marginRight: 8 }} />}
          <Text style={[
            styles.text,
            isPrimary && styles.textPrimary,
            (isSecondary || isOutline || isGhost) && styles.textSecondary,
            disabled && styles.textDisabled
          ]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: FluentTheme.borderRadius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  medium: {
    height: 40,
  },
  small: {
    height: 32,
    paddingHorizontal: 12,
  },
  large: {
    height: 48,
    paddingHorizontal: 20,
  },
  primary: {
    backgroundColor: FluentTheme.colors.accent,
  },
  secondary: {
    backgroundColor: FluentTheme.colors.neutralBackground2,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: FluentTheme.colors.neutralBorderStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    backgroundColor: FluentTheme.colors.neutralBorder,
    borderColor: FluentTheme.colors.neutralBorder,
  },
  text: {
    fontFamily: FluentTheme.typography.fontFamily,
    fontSize: FluentTheme.typography.sizes.body,
    fontWeight: FluentTheme.typography.weights.semibold,
  },
  textPrimary: {
    color: FluentTheme.colors.white,
  },
  textSecondary: {
    color: FluentTheme.colors.neutralText,
  },
  textDisabled: {
    color: FluentTheme.colors.neutralTextSecondary,
  }
});
