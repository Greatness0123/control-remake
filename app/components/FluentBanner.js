import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, SafeAreaView } from 'react-native';
import { FluentTheme } from './theme';

export const FluentBanner = ({ message, type = 'info', visible, onHide }) => {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        hide();
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      hide();
    }
  }, [visible]);

  const hide = () => {
    Animated.timing(translateY, {
      toValue: -150,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (onHide) onHide();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View style={[
      styles.banner,
      styles[type],
      { transform: [{ translateY }] }
    ]}>
      <SafeAreaView>
        <Text style={styles.text}>{message}</Text>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    zIndex: 1000,
    ...FluentTheme.shadows.medium,
  },
  info: {
    backgroundColor: FluentTheme.colors.accent,
  },
  success: {
    backgroundColor: FluentTheme.colors.success,
  },
  error: {
    backgroundColor: FluentTheme.colors.error,
  },
  warning: {
    backgroundColor: FluentTheme.colors.warning,
  },
  text: {
    color: FluentTheme.colors.white,
    fontFamily: FluentTheme.typography.fontFamily,
    fontSize: FluentTheme.typography.sizes.body,
    fontWeight: FluentTheme.typography.weights.semibold,
    textAlign: 'center',
  }
});
