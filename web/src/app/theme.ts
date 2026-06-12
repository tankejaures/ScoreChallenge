import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

// Thème « stade nocturne » : pelouse profonde + volt électrique.
export const ScPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f8fee0',
      100: '#eefcba',
      200: '#e2fa8a',
      300: '#d4f63a',
      400: '#c0ea16',
      500: '#a3cc0a',
      600: '#83a508',
      700: '#637d0a',
      800: '#4c5f0d',
      900: '#3d4d10',
      950: '#1f2a04',
    },
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff',
          50: '#f2f7ee',
          100: '#d9e3d3',
          200: '#aebfa6',
          300: '#839a7c',
          400: '#5d735a',
          500: '#3f5340',
          600: '#2c3e30',
          700: '#1a3526',
          800: '#11251a',
          900: '#0b1a12',
          950: '#06120c',
        },
      },
    },
  },
});
