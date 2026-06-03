import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MessageBubble, ScreenContainer } from '../components';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { MOCK_MATCHES, MOCK_MESSAGES } from '../data/mockMessages';
import { useApp } from '../context/AppContext';
import type { Message } from '../types';
import type { MessagesScreenProps } from '../navigation/types';

export function MessagesScreen({ navigation, route }: MessagesScreenProps) {
  const { currentUser } = useApp();
  const matchId = route.params?.matchId ?? MOCK_MATCHES[0]?.id;
  const match = MOCK_MATCHES.find((m) => m.id === matchId) ?? MOCK_MATCHES[0];

  const [messages, setMessages] = useState<Message[]>(
    MOCK_MESSAGES.filter((m) => m.matchId === match?.id),
  );
  const [draft, setDraft] = useState('');
  const [showMatchList, setShowMatchList] = useState(!route.params?.matchId);

  const sendMessage = () => {
    if (!draft.trim() || !match) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      matchId: match.id,
      senderId: currentUser.id,
      text: draft.trim(),
      sentAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setDraft('');
  };

  if (showMatchList) {
    return (
      <ScreenContainer contentStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={styles.backBtn} />
        </View>

        <FlatList
          data={MOCK_MATCHES}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.matchRow}
              onPress={() => {
                setShowMatchList(false);
                setMessages(MOCK_MESSAGES.filter((m) => m.matchId === item.id));
              }}
            >
              <View style={styles.matchAvatar}>
                <Ionicons name="person" size={24} color={colors.primaryLight} />
              </View>
              <View style={styles.matchInfo}>
                <Text style={styles.matchName}>{item.user.name}</Text>
                <Text style={styles.matchPreview} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No matches yet</Text>
              <Text style={styles.emptySub}>
                Complete a speed date and match mutually to start messaging
              </Text>
            </View>
          }
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.chatContainer}>
      <KeyboardAvoidingView
        style={styles.chatWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.chatHeader}>
          <Pressable onPress={() => setShowMatchList(true)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatHeaderName}>{match?.user.name}</Text>
            <Text style={styles.chatHeaderSub}>Matched via speed date</Text>
          </View>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isOwn={item.senderId === currentUser.id}
            />
          )}
          contentContainerStyle={styles.messageList}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable
            style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!draft.trim()}
          >
            <Ionicons name="send" size={20} color={colors.surface} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.sm,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  matchAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  matchPreview: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.subtitle,
    color: colors.text,
  },
  emptySub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  chatContainer: {
    flex: 1,
  },
  chatWrapper: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  chatHeaderSub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  messageList: {
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    flexGrow: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    ...typography.body,
    color: colors.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
