import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

interface RootErrorBoundaryProps {
  children: ReactNode;
}

interface RootErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
}

/** Temporary root boundary — surfaces runtime crashes instead of a blank screen. */
export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  state: RootErrorBoundaryState = {
    error: null,
    componentStack: null,
  };

  static getDerivedStateFromError(error: Error): Partial<RootErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[SpeedSpark] RootErrorBoundary caught', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  private handleRetry = (): void => {
    this.setState({ error: null, componentStack: null });
  };

  render(): ReactNode {
    const { error, componentStack } = this.state;

    if (error) {
      return (
        <View style={styles.screen}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            The app hit an error while loading. Details below (dev only).
          </Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.label}>Error</Text>
            <Text style={styles.mono} selectable>
              {error.name}: {error.message}
            </Text>
            {error.stack ? (
              <>
                <Text style={styles.label}>Stack</Text>
                <Text style={styles.mono} selectable>
                  {error.stack}
                </Text>
              </>
            ) : null}
            {componentStack ? (
              <>
                <Text style={styles.label}>Component stack</Text>
                <Text style={styles.mono} selectable>
                  {componentStack}
                </Text>
              </>
            ) : null}
          </ScrollView>
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  scroll: {
    flex: 1,
    marginBottom: spacing.md,
  },
  scrollContent: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  label: {
    ...typography.caption,
    color: colors.sparkOrange,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  mono: {
    ...typography.caption,
    color: colors.text,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  button: {
    backgroundColor: colors.sparkOrange,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '700',
  },
});
