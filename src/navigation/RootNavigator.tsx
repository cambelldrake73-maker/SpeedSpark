import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../constants/theme';
import type { RootStackParamList } from './types';
import {
  WelcomeScreen,
  AuthScreen,
  ProfileCreationScreen,
  PreferencesScreen,
  VerificationScreen,
  SpeedDateLobbyScreen,
  ActiveDateScreen,
  PostDateFeedbackScreen,
  MatchResultScreen,
  MessagesScreen,
} from '../screens';

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.background },
  animation: 'slide_from_right' as const,
};

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Welcome" screenOptions={screenOptions}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="ProfileCreation" component={ProfileCreationScreen} />
        <Stack.Screen name="Preferences" component={PreferencesScreen} />
        <Stack.Screen name="Verification" component={VerificationScreen} />
        <Stack.Screen name="SpeedDateLobby" component={SpeedDateLobbyScreen} />
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
  );
}
