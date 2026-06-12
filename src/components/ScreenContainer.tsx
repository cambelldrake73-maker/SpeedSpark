import React, { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout, spacing } from '../constants/theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  /** When false, disables ScrollView scrolling (e.g. while dragging a list inside). */
  scrollEnabled?: boolean;
  /** Edge-to-edge layout — no horizontal inset, no web max-width cap. */
  fullBleed?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  /** Shift content when the keyboard opens (native only). Disable if the screen wraps its own KeyboardAvoidingView. */
  keyboardAvoiding?: boolean;
  /** When this value changes, the scroll view resets to the top (e.g. wizard step index). */
  scrollToTopKey?: number | string;
  /** Reset scroll position whenever this screen gains focus (e.g. onboarding navigation). */
  scrollToTopOnFocus?: boolean;
}

export function ScreenContainer({
  children,
  scroll = false,
  scrollEnabled = true,
  fullBleed = false,
  style,
  contentStyle,
  keyboardAvoiding = true,
  scrollToTopKey,
  scrollToTopOnFocus = false,
}: ScreenContainerProps) {
  const avoidKeyboard = keyboardAvoiding && Platform.OS !== 'web';
  const scrollRef = useRef<ScrollView>(null);
  const insetStyle = fullBleed ? styles.fullBleedInset : undefined;
  const frameStyle = [styles.frame, Platform.OS === 'web' && !fullBleed && styles.frameWeb];

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  useEffect(() => {
    if (!scroll || scrollToTopKey === undefined) {
      return;
    }
    scrollToTop();
  }, [scroll, scrollToTopKey, scrollToTop]);

  useFocusEffect(
    useCallback(() => {
      if (scroll && scrollToTopOnFocus) {
        scrollToTop();
      }
    }, [scroll, scrollToTopOnFocus, scrollToTop]),
  );

  if (scroll) {
    return (
      <SafeAreaView style={[styles.container, style]}>
        <View style={styles.backdrop}>
          <View style={frameStyle}>
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={[styles.scrollContent, insetStyle, contentStyle]}
              showsVerticalScrollIndicator={false}
              scrollEnabled={scrollEnabled}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              automaticallyAdjustKeyboardInsets={avoidKeyboard}
            >
              {children}
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const staticContent = (
    <View style={[styles.content, insetStyle, contentStyle]}>{children}</View>
  );

  const body =
    avoidKeyboard ? (
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {staticContent}
      </KeyboardAvoidingView>
    ) : (
      staticContent
    );

  return (
    <SafeAreaView style={[styles.container, style]}>
      <View style={styles.backdrop}>
        <View style={frameStyle}>{body}</View>
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
  keyboardAvoid: {
    flex: 1,
    width: '100%',
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
    paddingBottom: spacing.xxl * 4,
  },
  fullBleedInset: {
    paddingHorizontal: 0,
  },
});
