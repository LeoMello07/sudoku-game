import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuração do app nativo (Capacitor).
 * O conteúdo web compilado é montado em `www/` pelo script `build:www`
 * e embarcado nos projetos ios/ e android/ pelo `npx cap sync`.
 */
const config: CapacitorConfig = {
  appId: 'com.leomello.sudoku',
  appName: 'Sudoku',
  webDir: 'www',
};

export default config;
