import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  DraggableVideoPiP,
  LocalCameraPreview,
  PIP_HEIGHT,
  PIP_WIDTH,
  ScreenContainer,
} from '../components';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { DATE_DURATION_SECONDS } from '../data/mockSpeedDates';
import { useMediaAccess } from '../hooks/useMediaAccess';
import { useSpeedDateCall } from '../hooks/useSpeedDateCall';
import { useApp } from '../context/AppContext';
import { isSupabaseConfigured, reportUser, updateSpeedDateStatus } from '../services';
import { cardShadow } from '../utils/platformStyles';
import type { ActiveDateScreenProps } from '../navigation/types';

const PIP_MARGIN = 8;

export function ActiveDateScreen({ navigation, route }: ActiveDateScreenProps) {
  const { partner, speedDateId } = route.params;
  const { blockUser, setCurrentDatePartner, currentUser } = useApp();
  const hasEndedRef = useRef(false);
  const noShowHandledRef = useRef(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(DATE_DURATION_SECONDS);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [selfExpanded, setSelfExpanded] = useState(false);
  const [selfVisible, setSelfVisible] = useState(true);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);

  const { granted: hasMediaAccess, pending: permissionsPending, denied, errorMessage, requestAccess, openSettings } =
    useMediaAccess();
  const dragAreaRef = useRef<View>(null);
  const stageRef = useRef<View>(null);
  const pipInitialSetRef = useRef(false);
  const [dragBounds, setDragBounds] = useState({ width: 0, height: 0 });
  const [pipInitialPosition, setPipInitialPosition] = useState<{ x: number; y: number } | null>(
    null,
  );

  const onDragAreaLayout = useCallback((event: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = event.nativeEvent.layout;
    setDragBounds((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  const syncPiPInitialPosition = useCallback(() => {
    if (pipInitialSetRef.current) {
      return;
    }
    const dragArea = dragAreaRef.current;
    const stage = stageRef.current;
    if (!dragArea || !stage) {
      return;
    }

    dragArea.measureInWindow((hostX, hostY) => {
      stage.measureInWindow((stageX, stageY, stageWidth) => {
        pipInitialSetRef.current = true;
        setPipInitialPosition({
          x: Math.max(PIP_MARGIN, stageX + stageWidth - PIP_WIDTH - PIP_MARGIN - hostX),
          y: Math.max(PIP_MARGIN, stageY + PIP_MARGIN - hostY),
        });
      });
    });
  }, []);

  const voiceCallEnabled =
    Boolean(speedDateId) &&
    hasMediaAccess &&
    Boolean(currentUser.id) &&
    currentUser.id !== 'user-1';

  const onPartnerAbandonedRef = useRef<() => void>(() => {});

  const handleNoShow = useCallback(() => {
    if (noShowHandledRef.current || hasEndedRef.current) {
      return;
    }
    noShowHandledRef.current = true;
    hasEndedRef.current = true;
    navigation.reset({
      index: 0,
      routes: [{ name: 'SpeedDateLobby' }],
    });
  }, [navigation]);

  const {
    connectionState: voiceConnectionState,
    partnerConnected,
    partnerConnectionStatus,
    shouldStartTimer: callShouldStartTimer,
    isMuted: voiceMuted,
    setMuted: setVoiceMuted,
    leave: leaveVoiceCall,
  } = useSpeedDateCall({
    speedDateId,
    userId: currentUser.id,
    enabled: voiceCallEnabled,
    onNoShow: handleNoShow,
    onPartnerAbandoned: () => {
      onPartnerAbandonedRef.current();
    },
  });

  const shouldStartTimer = speedDateId ? callShouldStartTimer : true;

  const [localMuted, setLocalMuted] = useState(false);
  const isVoiceMuted = speedDateId ? voiceMuted : localMuted;

  const toggleMute = () => {
    if (speedDateId) {
      setVoiceMuted(!voiceMuted);
      return;
    }
    setLocalMuted((muted) => !muted);
  };

  useEffect(() => {
    setCurrentDatePartner(partner);
  }, [partner, setCurrentDatePartner]);

  useEffect(() => {
    pipInitialSetRef.current = false;
    setPipInitialPosition(null);
    const frame = requestAnimationFrame(() => {
      syncPiPInitialPosition();
    });
    const retry = setTimeout(() => {
      pipInitialSetRef.current = false;
      syncPiPInitialPosition();
    }, 350);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(retry);
    };
  }, [selfExpanded, syncPiPInitialPosition, dragBounds.width, dragBounds.height]);

  const goToFeedback = useCallback(async () => {
    if (hasEndedRef.current) {
      return;
    }
    hasEndedRef.current = true;

    if (speedDateId) {
      if (timerRunning) {
        await leaveVoiceCall('complete');
      } else {
        await leaveVoiceCall('cancel');
      }
    }

    const dateId = speedDateId ?? `date-${Date.now()}`;

    if (speedDateId) {
      void updateSpeedDateStatus(speedDateId, timerRunning ? 'completed' : 'cancelled').catch((error) => {
        console.log('[SpeedSpark Pair] Failed to mark speed date completed', error);
      });
    }

    navigation.replace('PostDateFeedback', {
      partnerId: partner.id,
      dateId,
    });
  }, [navigation, partner.id, speedDateId, leaveVoiceCall, timerRunning]);

  useEffect(() => {
    onPartnerAbandonedRef.current = () => {
      if (hasEndedRef.current) {
        return;
      }
      void goToFeedback();
    };
  }, [goToFeedback]);

  useEffect(() => {
    if (shouldStartTimer && !timerRunning) {
      setTimerRunning(true);
    }
  }, [shouldStartTimer, timerRunning]);

  useEffect(() => {
    if (!timerRunning) {
      return;
    }

    if (secondsLeft <= 0) {
      goToFeedback();
      return;
    }

    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, timerRunning, goToFeedback]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = 1 - secondsLeft / DATE_DURATION_SECONDS;
  const isUrgent = secondsLeft <= 30;

  const handleEndEarly = () => {
    setShowEndConfirm(true);
  };

  const submitReport = useCallback(async () => {
    setShowReportConfirm(false);
    try {
      if (isSupabaseConfigured && currentUser.id && currentUser.id !== 'user-1') {
        await reportUser({
          reporterId: currentUser.id,
          reportedUserId: partner.id,
          context: 'call',
          speedDateId,
        });
      }
    } catch (error) {
      console.log('[SpeedSpark Safety] Failed to submit report', error);
    }
    await goToFeedback();
  }, [currentUser.id, goToFeedback, partner.id, speedDateId]);

  const handleReport = () => {
    setShowReportConfirm(true);
  };

  const confirmReport = () => {
    void submitReport();
  };

  const handleBlock = () => {
    setShowBlockConfirm(true);
  };

  const confirmBlock = async () => {
    if (speedDateId) {
      await leaveVoiceCall('cancel');
    }
    blockUser(
      { id: partner.id, name: partner.name },
      speedDateId ? { speedDateId } : undefined,
    );
    setShowBlockConfirm(false);
    navigation.reset({
      index: 0,
      routes: [{ name: 'SpeedDateLobby' }],
    });
  };

  const toggleSelfView = () => {
    setSelfExpanded((expanded) => !expanded);
  };

  const flipCamera = () => {
    setFacing((current) => (current === 'front' ? 'back' : 'front'));
  };

  const selfCamera = (
    <LocalCameraPreview
      enabled={isVideoOn && hasMediaAccess}
      facing={facing}
      mute={isVoiceMuted}
      compact
      label="You"
    />
  );

  const showPipOverlay =
    ((!selfExpanded && selfVisible) || selfExpanded) &&
    !showEndConfirm &&
    !showReportConfirm &&
    !showBlockConfirm;

  return (
    <>
    <ScreenContainer style={styles.container} contentStyle={styles.content}>
      <View ref={dragAreaRef} style={styles.pipHost} onLayout={onDragAreaLayout}>
      {!hasMediaAccess && (
        <View style={styles.permissionBanner}>
          <Ionicons name="videocam-outline" size={24} color={colors.sparkOrange} />
          <Text style={styles.permissionTitle}>Camera & microphone needed</Text>
          <Text style={styles.permissionText}>
            {Platform.OS === 'web'
              ? 'Tap the button below — your browser will ask to allow camera and mic for this date.'
              : 'Allow access so your date can see and hear you.'}
          </Text>
          {errorMessage ? <Text style={styles.permissionError}>{errorMessage}</Text> : null}
          <Button
            title={
              permissionsPending
                ? 'Requesting…'
                : denied && Platform.OS !== 'web'
                  ? 'Open Settings'
                  : 'Allow camera & mic'
            }
            onPress={() => {
              if (denied && Platform.OS !== 'web') {
                openSettings();
                return;
              }
              void requestAccess();
            }}
            size="md"
            disabled={permissionsPending}
            style={styles.permissionBtn}
          />
        </View>
      )}

      <View style={styles.topBar}>
        <View style={styles.timerRow}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>LIVE DATE</Text>
          </View>
          <Text style={[styles.timer, isUrgent && styles.timerUrgent]}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <View style={styles.videoSection}>
      <View ref={stageRef} style={styles.stage} onLayout={syncPiPInitialPosition}>
        {selfExpanded ? (
          <View style={styles.mainFeed}>{selfCamera}</View>
        ) : (
          <PartnerVideoPane
            voiceMode={Boolean(speedDateId)}
            partnerConnected={partnerConnected}
            connectionState={voiceConnectionState}
            partnerConnectionStatus={partnerConnectionStatus}
          />
        )}

        <View style={[styles.stageTopBar, !selfExpanded && styles.stageTopBarCompact]}>
          {!selfVisible && !selfExpanded && (
            <Pressable style={styles.stageChip} onPress={() => setSelfVisible(true)}>
              <Ionicons name="eye-outline" size={14} color={colors.text} />
              <Text style={styles.stageChipText}>Show camera</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.stageControls}>
          <OverlayIcon
            icon={isVoiceMuted ? 'mic-off' : 'mic'}
            onPress={toggleMute}
            active={isVoiceMuted}
            label={isVoiceMuted ? 'Unmute' : 'Mute'}
          />
          <OverlayIcon
            icon="camera-reverse-outline"
            onPress={flipCamera}
            disabled={!isVideoOn || !hasMediaAccess}
            label="Flip camera"
          />
          <OverlayIcon
            icon={isVideoOn ? 'videocam' : 'videocam-off'}
            onPress={() => setIsVideoOn(!isVideoOn)}
            active={!isVideoOn}
            label="Video"
          />
          <OverlayIcon
            icon={isSpeakerOn ? 'volume-high' : 'volume-mute'}
            onPress={() => setIsSpeakerOn(!isSpeakerOn)}
            active={!isSpeakerOn}
            label="Speaker"
          />
        </View>
      </View>
      </View>

      <View style={styles.footerActions}>
        <Button title="End date early" onPress={handleEndEarly} variant="outline" size="md" />
        <View style={styles.safetyLinks}>
          <Pressable
            onPress={handleReport}
            style={({ pressed }) => [styles.safetyLink, pressed && styles.safetyLinkPressed]}
            accessibilityLabel="Report"
          >
            <Ionicons name="flag-outline" size={15} color={colors.error} />
            <Text style={styles.safetyLinkText}>Report</Text>
          </Pressable>
          <View style={styles.safetyLinkDivider} />
          <Pressable
            onPress={handleBlock}
            style={({ pressed }) => [styles.safetyLink, pressed && styles.safetyLinkPressed]}
            accessibilityLabel="Block"
          >
            <Ionicons name="ban-outline" size={15} color={colors.error} />
            <Text style={styles.safetyLinkText}>Block</Text>
          </Pressable>
        </View>
      </View>

      {dragBounds.width > 0 && showPipOverlay && !selfExpanded && selfVisible ? (
        <DraggableVideoPiP
          key="self-pip"
          boundsWidth={dragBounds.width}
          boundsHeight={dragBounds.height}
          initialPosition={pipInitialPosition}
          onSwap={toggleSelfView}
          onHide={() => setSelfVisible(false)}
        >
          {selfCamera}
        </DraggableVideoPiP>
      ) : null}

      {dragBounds.width > 0 && showPipOverlay && selfExpanded ? (
        <DraggableVideoPiP
          key="partner-pip"
          boundsWidth={dragBounds.width}
          boundsHeight={dragBounds.height}
          initialPosition={pipInitialPosition}
          onSwap={toggleSelfView}
          onHide={() => {}}
          showCloseButton={false}
        >
          <PartnerVideoPane
            compact
            voiceMode={Boolean(speedDateId)}
            partnerConnected={partnerConnected}
            connectionState={voiceConnectionState}
            partnerConnectionStatus={partnerConnectionStatus}
          />
        </DraggableVideoPiP>
      ) : null}
      </View>
    </ScreenContainer>

    <DateConfirmModal
      visible={showEndConfirm}
      title="End this date?"
      cancelLabel="Stay"
      confirmLabel="End date"
      onCancel={() => setShowEndConfirm(false)}
      onConfirm={goToFeedback}
    />

    <DateConfirmModal
      visible={showReportConfirm}
      title={`Report ${partner.name}?`}
      message="This date will end and our team will review."
      cancelLabel="Cancel"
      confirmLabel="Report & end"
      onCancel={() => setShowReportConfirm(false)}
      onConfirm={confirmReport}
    />

    <DateConfirmModal
      visible={showBlockConfirm}
      title={`Block ${partner.name}?`}
      message="They won't be able to match or message you again."
      cancelLabel="Cancel"
      confirmLabel="Block & leave"
      onCancel={() => setShowBlockConfirm(false)}
      onConfirm={() => void confirmBlock()}
    />
    </>
  );
}

function DateConfirmModal({
  visible,
  title,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message?: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.confirmOverlay} onPress={onCancel} accessibilityLabel="Dismiss">
        <Pressable style={styles.confirmCard} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.confirmTitle}>{title}</Text>
          {message ? <Text style={styles.confirmText}>{message}</Text> : null}
          <View style={styles.confirmActions}>
            <Button title={cancelLabel} onPress={onCancel} variant="outline" size="sm" style={styles.confirmBtn} />
            <Button title={confirmLabel} onPress={onConfirm} size="sm" style={styles.confirmBtn} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PartnerVideoPane({
  compact = false,
  voiceMode = false,
  partnerConnected = false,
  connectionState = 'idle',
  partnerConnectionStatus = 'waiting',
}: {
  compact?: boolean;
  voiceMode?: boolean;
  partnerConnected?: boolean;
  connectionState?: string;
  partnerConnectionStatus?: string;
}) {
  const paneSub = voiceMode
    ? partnerConnected
      ? 'Voice connected'
      : partnerConnectionStatus === 'reconnecting' || connectionState === 'reconnecting'
        ? 'Reconnecting voice…'
        : connectionState === 'connecting' || partnerConnectionStatus === 'connecting'
          ? 'Connecting voice…'
          : 'Waiting for date…'
    : 'Live video';

  return (
    <View style={[compact ? styles.partnerPiPFeed : styles.mainFeed, styles.partnerFeed]}>
      <View style={styles.videoPaneGradient} />
      <View style={[styles.videoIconRing, compact && styles.videoIconRingSmall]}>
        <Ionicons
          name={voiceMode ? 'mic' : 'videocam'}
          size={compact ? 22 : 40}
          color={colors.sparkOrange}
        />
      </View>
      {!compact && (
        <>
          <Text style={styles.paneLabelLarge}>Your date</Text>
          <Text style={styles.paneSub}>{paneSub}</Text>
        </>
      )}
    </View>
  );
}

function OverlayIcon({
  icon,
  onPress,
  active = false,
  disabled = false,
  danger = false,
  small = false,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  small?: boolean;
  label?: string;
}) {
  const size = small ? 28 : 40;
  const iconSize = small ? 14 : 24;
  const iconColor = danger
    ? colors.error
    : disabled
      ? colors.textMuted
      : active
        ? colors.sparkOrange
        : '#FFFFFF';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.overlayBtn,
        { width: size, height: size },
        active && styles.overlayBtnActive,
        danger && styles.overlayBtnDanger,
        disabled && styles.overlayBtnDisabled,
        pressed && !disabled && styles.overlayBtnPressed,
      ]}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={iconSize} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  pipHost: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    position: 'relative',
  },
  videoSection: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignSelf: 'stretch',
  },
  permissionBanner: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: 'rgba(245, 130, 32, 0.35)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    width: '100%',
  },
  permissionTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  permissionText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  permissionError: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  permissionBtn: {
    width: '100%',
    marginTop: spacing.xs,
  },
  topBar: {
    width: '100%',
    alignSelf: 'stretch',
    marginBottom: spacing.sm,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(230, 30, 37, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(230, 30, 37, 0.35)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.sparkRed,
  },
  livePillText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.sparkRed,
    letterSpacing: 0.6,
  },
  timer: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  timerUrgent: {
    color: colors.sparkOrange,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.sparkOrange,
    borderRadius: 2,
  },
  stage: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  mainFeed: {
    ...StyleSheet.absoluteFill,
  },
  partnerFeed: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  partnerPiPFeed: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPaneGradient: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(245, 130, 32, 0.04)',
  },
  videoIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  videoIconRingSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: spacing.xs,
  },
  paneLabelLarge: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  paneSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  stageTopBar: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    zIndex: 20,
  },
  stageTopBarCompact: {
    justifyContent: 'flex-end',
  },
  stageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  stageChipText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.text,
    fontWeight: '600',
  },
  stageControls: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
    zIndex: 20,
  },
  overlayBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
  },
  overlayBtnActive: {
    opacity: 0.75,
  },
  overlayBtnDanger: {
    opacity: 1,
  },
  overlayBtnDisabled: {
    opacity: 0.4,
  },
  overlayBtnPressed: {
    opacity: 0.85,
  },
  footerActions: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow('md'),
  },
  confirmTitle: {
    ...typography.subtitle,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  confirmText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  confirmBtn: {
    flex: 1,
  },
  safetyLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  safetyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
  },
  safetyLinkPressed: {
    opacity: 0.75,
  },
  safetyLinkText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '600',
  },
  safetyLinkDivider: {
    width: 1,
    height: 14,
    backgroundColor: colors.border,
  },
});
