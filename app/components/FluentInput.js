import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { FluentTheme } from './theme';

export const FluentInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  error,
  style
}) => {
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={FluentTheme.colors.neutralTextSecondary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontFamily: FluentTheme.typography.fontFamily,
    fontSize: FluentTheme.typography.sizes.caption,
    color: FluentTheme.colors.neutralText,
    marginBottom: 4,
    fontWeight: FluentTheme.typography.weights.semibold,
  },
  input: {
    height: 40,
    borderBottomWidth: 1,
    borderColor: FluentTheme.colors.neutralBorderStrong,
    fontFamily: FluentTheme.typography.fontFamily,
    fontSize: FluentTheme.typography.sizes.body,
    color: FluentTheme.colors.neutralText,
    paddingVertical: 8,
  },
  inputError: {
    borderColor: FluentTheme.colors.error,
  },
  errorText: {
    fontFamily: FluentTheme.typography.fontFamily,
    fontSize: FluentTheme.typography.sizes.caption,
    color: FluentTheme.colors.error,
    marginTop: 4,
  }
});
