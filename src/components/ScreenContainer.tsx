import React from 'react';
import { Platform, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout, spacing } from '../constants/theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export function ScreenContainer({
  children,
  scroll = false,
  style,
  contentStyle,
}: ScreenContainerProps) {
  const content = scroll ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.container, style]}>
      <View style={styles.backdrop}>
        <View style={[styles.frame, Platform.OS === 'web' && styles.frameWeb]}>{content}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.background,
  },
  backdrop: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  frame: {
    flex: 1,
    width: '100%',
  },
  frameWeb: {
    maxWidth: layout.maxContentWidth,
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  content: {
    flex: 1,
    width: '100%',
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
