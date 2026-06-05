import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import { RootErrorBoundary } from './src/components/RootErrorBoundary';
import { AppProvider } from './src/context/AppContext';
import { AuthProvider } from './src/context/AuthContext';
import { PairingWorkerBootstrap } from './src/context/PairingWorkerBootstrap';
import { SessionBootstrap } from './src/context/SessionBootstrap';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/constants/theme';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const id = 'speed-spark-web-layout';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      html, body {
        width: 100%;
        min-height: 100%;
        margin: 0;
        padding: 0;
        background-color: ${colors.background};
      }
      body {
        min-height: 100vh;
      }
      #root {
        width: 100%;
        min-height: 100vh;
        margin: 0;
        padding: 0;
        background-color: ${colors.background};
        display: flex;
        flex-direction: column;
      }
      #root > div {
        flex: 1;
        width: 100%;
        min-height: 100vh;
        background-color: ${colors.background};
      }
    `;
    document.head.appendChild(style);
  }
}

export default function App() {
  return (
    <RootErrorBoundary>
      <View style={styles.appShell}>
        <AuthProvider>
          <AppProvider>
            <SessionBootstrap />
            <PairingWorkerBootstrap />
            <StatusBar style="light" />
            <RootNavigator />
          </AppProvider>
        </AuthProvider>
      </View>
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' ? { minHeight: '100vh' as unknown as number } : {}),
  },
});
