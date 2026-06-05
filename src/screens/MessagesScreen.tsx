import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  MatchConversationRow,
  MessageBubble,
  ProfilePreviewModal,
  ScreenContainer,
} from '../components';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { MOCK_MATCHES, MOCK_MESSAGES } from '../data/mockMessages';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useMessagesBackend } from '../hooks/useMessagesBackend';
import { isSupabaseConfigured, reportUser } from '../services';
import { formatAuthErrorForUser } from '../utils/authErrors';
import type { Match, Message } from '../types';
import type { MessagesScreenProps } from '../navigation/types';
import { getMessageThreadMeta, groupMessagesByMatch } from '../utils/messageThread';

export function MessagesScreen({ navigation, route }: MessagesScreenProps) {
  const { session } = useAuth();
  const { currentUser, blockUser, isBlocked } = useApp();
  const initialMatchId = route.params?.matchId;
  const userId = session?.user?.id ?? currentUser.id;

  const [mockMatches, setMockMatches] = useState<Match[]>(MOCK_MATCHES);
  const [mockMessagesByMatch, setMockMessagesByMatch] = useState<Record<string, Message[]>>(() =>
    groupMessagesByMatch(MOCK_MESSAGES),
  );
  const [lastReadAt, setLastReadAt] = useState<Record<string, string>>({});
  const [activeMatchId, setActiveMatchId] = useState<string | null>(initialMatchId ?? null);
  const [showMatchList, setShowMatchList] = useState(!initialMatchId);
  const [draft, setDraft] = useState('');
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showFlagConfirm, setShowFlagConfirm] = useState(false);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const backend = useMessagesBackend(userId, activeMatchId, initialMatchId);
  const matches = backend.useBackend ? backend.matches : mockMatches;
  const messagesByMatch = backend.useBackend ? backend.messagesByMatch : mockMessagesByMatch;

  useEffect(() => {
    if (backend.error) {
      setActionNotice(backend.error);
    }
  }, [backend.error]);

  const visibleMatches = useMemo(
    () => matches.filter((match) => !isBlocked(match.user.id)),
    [matches, isBlocked],
  );

  const activeMatch = matches.find((m) => m.id === activeMatchId) ?? null;
  const showChat = !showMatchList && Boolean(activeMatchId) && Boolean(activeMatch);
  const messages = activeMatchId ? (messagesByMatch[activeMatchId] ?? []) : [];
  const profileUser =
    matches.find((m) => m.user.id === profileUserId)?.user ??
    (activeMatch?.user.id === profileUserId ? activeMatch.user : null);

  const threadMeta = useMemo(
    () =>
      activeMatch
        ? getMessageThreadMeta(messages, currentUser.id, lastReadAt[activeMatch.id])
        : null,
    [activeMatch, messages, currentUser.id, lastReadAt],
  );

  const markMatchRead = (matchId: string, threadMessages: Message[]) => {
    const lastMessage = threadMessages[threadMessages.length - 1];
    setLastReadAt((prev) => ({
      ...prev,
      [matchId]: lastMessage?.sentAt ?? new Date().toISOString(),
    }));
  };

  const openChat = (matchId: string) => {
    const threadMessages = messagesByMatch[matchId] ?? [];
    setActiveMatchId(matchId);
    setShowMatchList(false);
    markMatchRead(matchId, threadMessages);
  };

  const sendMessage = async () => {
    if (!draft.trim() || !activeMatch) return;

    const text = draft.trim();

    if (backend.useBackend) {
      try {
        const sent = await backend.sendMessage(activeMatch.id, text);
        setLastReadAt((prev) => ({ ...prev, [activeMatch.id]: sent.sentAt }));
        setDraft('');
      } catch (error) {
        setActionNotice(formatAuthErrorForUser(error));
      }
      return;
    }

    const sentAt = new Date().toISOString();
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      matchId: activeMatch.id,
      senderId: currentUser.id,
      text,
      sentAt,
    };

    setMockMessagesByMatch((prev) => ({
      ...prev,
      [activeMatch.id]: [...(prev[activeMatch.id] ?? []), newMessage],
    }));
    setLastReadAt((prev) => ({ ...prev, [activeMatch.id]: sentAt }));
    setDraft('');
  };

  const submitReport = async () => {
    if (!activeMatch) return;
    setShowFlagConfirm(false);
    try {
      if (isSupabaseConfigured && userId && userId !== 'user-1') {
        await reportUser({
          reporterId: userId,
          reportedUserId: activeMatch.user.id,
          context: 'messages',
        });
      }
      setActionNotice('Report sent. Thanks for helping keep SpeedSpark safe.');
    } catch (error) {
      setActionNotice(formatAuthErrorForUser(error));
    }
  };

  const handleFlag = () => {
    setShowChatMenu(false);
    if (Platform.OS === 'web') {
      setShowFlagConfirm(true);
      return;
    }
    Alert.alert(
      'Report this match?',
      'Tell us if something felt unsafe or off. Our safety team will review.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send report',
          style: 'destructive',
          onPress: () => void submitReport(),
        },
      ],
    );
  };

  const confirmFlag = () => {
    void submitReport();
  };

  const handleUnmatch = () => {
    setShowChatMenu(false);
    if (Platform.OS === 'web') {
      setShowUnmatchConfirm(true);
      return;
    }
    Alert.alert(
      'Unmatch?',
      'You will lose this chat and they will no longer appear in your matches.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unmatch',
          style: 'destructive',
          onPress: confirmUnmatch,
        },
      ],
    );
  };

  const confirmUnmatch = () => {
    if (!activeMatch) return;
    setShowUnmatchConfirm(false);
    if (backend.useBackend) {
      backend.removeMatchLocally(activeMatch.id);
    } else {
      setMockMatches((prev) => prev.filter((m) => m.id !== activeMatch.id));
      setMockMessagesByMatch((prev) => {
        const next = { ...prev };
        delete next[activeMatch.id];
        return next;
      });
    }
    setActiveMatchId(null);
    setShowMatchList(true);
    setActionNotice(`You unmatched with ${activeMatch.user.name}.`);
  };

  const handleBlock = () => {
    setShowChatMenu(false);
    if (Platform.OS === 'web') {
      setShowBlockConfirm(true);
      return;
    }
    Alert.alert(
      `Block ${activeMatch?.user.name}?`,
      'They will be removed from your matches and cannot message you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: confirmBlock,
        },
      ],
    );
  };

  const confirmBlock = () => {
    if (!activeMatch) return;
    setShowBlockConfirm(false);
    blockUser({ id: activeMatch.user.id, name: activeMatch.user.name });
    if (backend.useBackend) {
      backend.removeMatchLocally(activeMatch.id);
    } else {
      setMockMatches((prev) => prev.filter((m) => m.id !== activeMatch.id));
      setMockMessagesByMatch((prev) => {
        const next = { ...prev };
        delete next[activeMatch.id];
        return next;
      });
    }
    setActiveMatchId(null);
    setShowMatchList(true);
    setActionNotice(`You blocked ${activeMatch.user.name}.`);
  };

  if (!showChat || !activeMatch) {
    return (
      <ScreenContainer contentStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={styles.iconBtn} />
        </View>

        {actionNotice ? (
          <View style={styles.notice}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.noticeText}>{actionNotice}</Text>
            <Pressable onPress={() => setActionNotice(null)} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        <FlatList
          data={visibleMatches}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MatchConversationRow
              match={item}
              messages={messagesByMatch[item.id] ?? []}
              currentUserId={currentUser.id}
              lastReadAt={lastReadAt[item.id]}
              onPress={() => openChat(item.id)}
              onProfilePress={() => setProfileUserId(item.user.id)}
            />
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

        <ProfilePreviewModal
          user={profileUser}
          visible={!!profileUserId}
          onClose={() => setProfileUserId(null)}
        />
      </ScreenContainer>
    );
  }

  const partnerPhoto = activeMatch.user.photos.find(Boolean);

  return (
    <ScreenContainer style={styles.chatContainer}>
      <KeyboardAvoidingView
        style={styles.chatWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.chatHeader}>
          <Pressable onPress={() => setShowMatchList(true)} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>

          <Pressable
            style={styles.chatHeaderMain}
            onPress={() => setProfileUserId(activeMatch.user.id)}
          >
            <View style={styles.chatAvatar}>
              {partnerPhoto ? (
                <Image source={{ uri: partnerPhoto }} style={styles.chatAvatarImage} />
              ) : (
                <Ionicons name="person" size={20} color={colors.primaryLight} />
              )}
            </View>
            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatHeaderName}>{activeMatch.user.name}</Text>
              <View style={styles.chatHeaderMeta}>
                {threadMeta?.turn ? (
                  <View
                    style={[
                      styles.headerTurnBadge,
                      threadMeta.turn === 'yours' ? styles.yourTurn : styles.theirTurn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.headerTurnText,
                        threadMeta.turn === 'yours'
                          ? styles.yourTurnText
                          : styles.theirTurnText,
                      ]}
                    >
                      {threadMeta.turn === 'yours' ? 'Your turn' : 'Their turn'}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.chatHeaderSub}>Tap name for profile</Text>
              </View>
            </View>
          </Pressable>

          <Pressable onPress={handleFlag} style={styles.iconBtn} accessibilityLabel="Report match">
            <Ionicons name="flag-outline" size={22} color={colors.error} />
          </Pressable>
          <Pressable
            onPress={() => setShowChatMenu(true)}
            style={styles.iconBtn}
            accessibilityLabel="More options"
          >
            <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
          </Pressable>
        </View>

        {actionNotice ? (
          <View style={styles.notice}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.noticeText}>{actionNotice}</Text>
            <Pressable onPress={() => setActionNotice(null)} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} isOwn={item.senderId === currentUser.id} />
          )}
          contentContainerStyle={styles.messageList}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={
              threadMeta?.turn === 'yours'
                ? `${activeMatch.user.name} is waiting — say something…`
                : 'Type a message...'
            }
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable
            style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
            onPress={() => void sendMessage()}
            disabled={!draft.trim()}
          >
            <Ionicons name="send" size={20} color={colors.surface} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ProfilePreviewModal
        user={profileUser ?? activeMatch.user}
        visible={!!profileUserId}
        onClose={() => setProfileUserId(null)}
      />

      <Modal visible={showChatMenu} transparent animationType="fade" onRequestClose={() => setShowChatMenu(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowChatMenu(false)}>
          <View style={styles.menuSheet}>
            <Pressable style={styles.menuItem} onPress={handleFlag}>
              <Ionicons name="flag-outline" size={20} color={colors.error} />
              <Text style={styles.menuItemDanger}>Report {activeMatch.user.name}</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={handleUnmatch}>
              <Ionicons name="heart-dislike-outline" size={20} color={colors.error} />
              <Text style={styles.menuItemDanger}>Unmatch</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, styles.menuItemLast]} onPress={handleBlock}>
              <Ionicons name="ban-outline" size={20} color={colors.error} />
              <Text style={styles.menuItemDanger}>Block {activeMatch.user.name}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {showFlagConfirm && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Report this match?</Text>
            <Text style={styles.confirmText}>
              Tell us if something felt unsafe or off. Our safety team will review (MVP placeholder).
            </Text>
            <View style={styles.confirmActions}>
              <Button title="Cancel" onPress={() => setShowFlagConfirm(false)} variant="outline" size="sm" />
              <Button title="Send report" onPress={confirmFlag} size="sm" />
            </View>
          </View>
        </View>
      )}

      {showUnmatchConfirm && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Unmatch with {activeMatch.user.name}?</Text>
            <Text style={styles.confirmText}>
              You will lose this chat and they will no longer appear in your matches.
            </Text>
            <View style={styles.confirmActions}>
              <Button title="Cancel" onPress={() => setShowUnmatchConfirm(false)} variant="outline" size="sm" />
              <Button title="Unmatch" onPress={confirmUnmatch} size="sm" />
            </View>
          </View>
        </View>
      )}

      {showBlockConfirm && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Block {activeMatch.user.name}?</Text>
            <Text style={styles.confirmText}>
              They will be removed from your matches and cannot message you again. You can manage
              blocked users in Settings.
            </Text>
            <View style={styles.confirmActions}>
              <Button title="Cancel" onPress={() => setShowBlockConfirm(false)} variant="outline" size="sm" />
              <Button title="Block" onPress={confirmBlock} size="sm" />
            </View>
          </View>
        </View>
      )}
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
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '700',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.success,
  },
  noticeText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
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
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  chatHeaderMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chatAvatarImage: {
    width: '100%',
    height: '100%',
  },
  chatHeaderInfo: {
    flex: 1,
    minWidth: 0,
  },
  chatHeaderName: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  chatHeaderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  headerTurnBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  yourTurn: {
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: colors.sparkOrange,
  },
  theirTurn: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTurnText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },
  yourTurnText: {
    color: colors.sparkOrange,
  },
  theirTurnText: {
    color: colors.textMuted,
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
  menuOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemDanger: {
    ...typography.body,
    color: colors.error,
    fontWeight: '600',
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  confirmText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
});
