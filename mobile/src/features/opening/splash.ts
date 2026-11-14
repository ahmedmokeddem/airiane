import * as SplashScreen from 'expo-splash-screen';
// Module scope: retain Android's real splash before Router can auto-hide it.
void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: false });
export function hideNativeSplash() {
  // The RN background/next screen has already laid out before this is called.
  try { SplashScreen.hide(); } catch { /* Web/dev clients may have no native splash. */ }
}
