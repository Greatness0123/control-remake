export const fluentColors = {
  brand: '#0078D4',
  brandHover: '#106EBE',
  brandPressed: '#005A9E',
  brandBackground: '#EFF6FC',
  brandShadow: 'rgba(0, 120, 212, 0.3)',

  success: '#107C10',
  successHover: '#0B6A0B',
  successBackground: '#DFF6DD',
  successShadow: 'rgba(16, 124, 16, 0.3)',

  warning: '#FFB900',
  warningHover: '#D99C00',
  warningBackground: '#FFF4CE',

  danger: '#D13438',
  dangerHover: '#A4262C',
  dangerBackground: '#FDE7E9',
  dangerShadow: 'rgba(209, 52, 56, 0.3)',

  neutralPrimary: '#242424',
  neutralSecondary: '#605E5C',
  neutralTertiary: '#A19F9D',
  neutralQuaternary: '#D2D0CE',
  neutralLighter: '#EDEBE9',
  neutralLightest: '#FAF9F8',
  white: '#FFFFFF',
  black: '#000000',

  purple: '#8764B8',
  purpleBackground: '#F3E8FF',
  teal: '#038387',
  tealBackground: '#D0F0F0',
};

export const fluentSpacing = {
  xxs: 2,
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
};

export const fluentRadius = {
  s: 4,
  m: 8,
  l: 12,
  xl: 16,
  round: 999,
};

export const fluentShadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  button: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  fab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const fluentTypography = {
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: fluentColors.neutralPrimary,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: fluentColors.neutralPrimary,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: fluentColors.neutralPrimary,
  },
  bodyStrong: {
    fontSize: 16,
    fontWeight: '600',
    color: fluentColors.neutralPrimary,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    color: fluentColors.neutralSecondary,
  },
  captionStrong: {
    fontSize: 12,
    fontWeight: '600',
    color: fluentColors.neutralSecondary,
  },
};
