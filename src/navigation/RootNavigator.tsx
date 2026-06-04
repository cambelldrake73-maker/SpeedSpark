import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../constants/theme';
import { NavigationGate, navigationRef } from './NavigationGate';
import type { RootStackParamList } from './types';
import {
  WelcomeScreen,
  AuthScreen,
  ContactVerificationScreen,
  ProfileCreationScreen,
  PreferencesScreen,
  VerificationScreen,
  SpeedDateLobbyScreen,
  DateQueueScreen,
  ActiveDateScreen,
  PostDateFeedbackScreen,
  MatchResultScreen,
  MessagesScreen,
  SettingsScreen,
  ManageProfileScreen,
  BlockedUsersScreen,
  LegalDocumentScreen,
} from '../screens';

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerShown: false,
  contentStyle: {
    backgroundColor: colors.background,
    flex: 1,
  },
  animation: 'slide_from_right' as const,
};

export function RootNavigator() {
  return (
    <View style={styles.root}>
      <NavigationContainer ref={navigationRef}>
      <NavigationGate />
      <Stack.Navigator initialRouteName="Welcome" screenOptions={screenOptions}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="ContactVerification" component={ContactVerificationScreen} />
        <Stack.Screen name="ProfileCreation" component={ProfileCreationScreen} />
        <Stack.Screen name="Preferences" component={PreferencesScreen} />
        <Stack.Screen name="Verification" component={VerificationScreen} />
        <Stack.Screen name="SpeedDateLobby" component={SpeedDateLobbyScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="ManageProfile" component={ManageProfileScreen} />
        <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
        <Stack.Screen name="LegalDocument" component={LegalDocumentScreen} />
        <Stack.Screen
          name="DateQueue"
          component={DateQueueScreen}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen
          name="ActiveDate"
          component={ActiveDateScreen}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen name="PostDateFeedback" component={PostDateFeedbackScreen} />
        <Stack.Screen
          name="MatchResult"
          component={MatchResultScreen}
          options={{ animation: 'fade_from_bottom' }}
        />
        <Stack.Screen name="Messages" component={MessagesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.background,
  },
});
