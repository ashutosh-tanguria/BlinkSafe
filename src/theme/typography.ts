import { TextStyle } from 'react-native';

export const Typography: { [key: string]: TextStyle } = {
  h1: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  h2: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
  h3: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  h4: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: '#94A3B8',
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: '#94A3B8',
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: '#64748B',
  },
  buttonLarge: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  buttonMedium: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  caption: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#94A3B8',
  },
  emergencyTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
};
