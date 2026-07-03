import React, { useState, useEffect, useCallback } from 'react';
import { Animated, Text, StyleSheet, View, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

let toastRef = null;

export const showToast = (message, type = 'success') => {
  if (toastRef) {
    toastRef(message, type);
  } else if (Platform.OS === 'web') {
    window.alert(message);
  }
};

const Toast = () => {
  const [message, setMessage] = useState('');
  const [type, setType] = useState('success');
  const [opacity] = useState(new Animated.Value(0));
  const [translateY] = useState(new Animated.Value(-100));

  const trigger = useCallback((msg, t) => {
    setMessage(msg);
    setType(t);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 50, duration: 300, useNativeDriver: true })
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -100, duration: 300, useNativeDriver: true })
      ]).start();
    }, 3000);
  }, [opacity, translateY]);

  useEffect(() => {
    toastRef = trigger;
    return () => { toastRef = null; };
  }, [trigger]);

  if (!message) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'alert-circle';
      case 'info': return 'information-circle';
      default: return 'notifications';
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'info': return '#3b82f6';
      default: return '#1e293b';
    }
  };

  return (
    <Animated.View style={[
      styles.container,
      { opacity, transform: [{ translateY }], backgroundColor: getBgColor() }
    ]}>
      <Ionicons name={getIcon()} size={20} color="#fff" />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: '10%',
    right: '10%',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  }
});

export default Toast;
