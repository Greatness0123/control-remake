import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { FluentTheme } from './theme';

export const FluentText = ({
  children,
  variant = 'body',
  weight = 'regular',
  color = 'neutralText',
  style,
  ...props
}) => {
  return (
    <RNText
      style={[
        styles.text,
        styles[variant],
        {
          fontWeight: FluentTheme.typography.weights[weight],
          color: FluentTheme.colors[color] || color
        },
        style
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  text: {
    fontFamily: FluentTheme.typography.fontFamily,
  },
  display: {
    fontSize: FluentTheme.typography.sizes.display,
  },
  header: {
    fontSize: FluentTheme.typography.sizes.header,
  },
  title: {
    fontSize: FluentTheme.typography.sizes.title,
  },
  subtitle: {
    fontSize: FluentTheme.typography.sizes.subtitle,
  },
  body: {
    fontSize: FluentTheme.typography.sizes.body,
  },
  caption: {
    fontSize: FluentTheme.typography.sizes.caption,
  },
});
