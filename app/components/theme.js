import { Platform } from 'react-native';

export const FluentTheme = {
  colors: {
    accent: '#0078D4',
    neutralBackground: '#FFFFFF',
    neutralBackground2: '#F3F3F3',
    neutralLayer: '#FAF9F8',
    neutralText: '#242424',
    neutralTextSecondary: '#616161',
    neutralBorder: '#EDEBE9',
    neutralBorderStrong: '#8A8886',
    success: '#107C10',
    error: '#C50F1F',
    warning: '#D83B01',
    white: '#FFFFFF',
    acrylic: 'rgba(255, 255, 255, 0.7)',
  },
  typography: {
    fontFamily: Platform.OS === 'ios' ? 'Segoe UI' : 'sans-serif',
    sizes: {
      caption: 12,
      body: 14,
      subtitle: 16,
      title: 20,
      header: 24,
      display: 32,
    },
    weights: {
      regular: '400',
      semibold: '600',
      bold: '700',
    }
  },
  shadows: {
    soft: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
  },
  borderRadius: {
    small: 4,
    medium: 8,
    large: 12,
    xl: 16,
  }
};
