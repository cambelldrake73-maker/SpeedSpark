import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  CameraEffectsPanel,
  DraggableVideoPiP,
  LocalCameraPreview,
  PIP_HEIGHT,
  PIP_WIDTH,
  ScreenContainer,
  usePiPStageLayout,
} from '../components';
import type { BlurLevel, VirtualBackground } from '../constants/cameraEffects';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { DATE_DURATION_SECONDS } from '../data/mockSpeedDates';
import { useMediaAccess } from '../hooks/useMediaAccess';
import { useSpeedDateCall } from '../hooks/useSpeedDateCall';
import { useApp } from '../context/AppContext';
import { isSupabaseConfigured, reportUser, updateSpeedDateStatus } from '../services';
import type { ActiveDateScreenProps } from '../navigation/types';

const ZOOM_LEVELS = [0, 0.12, 0.24, 0.36];
const PIP_MARGIN = 12;

export function ActiveDateScreen({ navigation, route }: ActiveDateScreenProps) {
  const { partner, speedDateId } = route.params;
  const { blockUser, setCurrentDatePartner, currentUser } = useApp();
  const [secondsLeft, setSecondsLeft] = useState(DATE_DURATION_SECONDS);
  const hasEndedRef = useRef(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [selfExpanded, setSelfExpanded] = useState(false);
  const [selfVisible, setSelfVisible] = useState(true);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [blurLevel, setBlurLevel] = useState<BlurLevel>('off');
  const [virtualBackground, setVirtualBackground] = useState<VirtualBackground>('none');
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [showSelfSettings, setShowSelfSettings] = useState(false);

  const { granted: hasMediaAccess, pending: permissionsPending, denied, errorMessage, requestAccess } =
    useMediaAccess();
  const { stageWidth, stageHeight, onStageLayout } = usePiPStageLayout();

  const voiceCallEnabled =
    Boolean(speedDateId) &&
    hasMediaAccess &&
    Boolean(currentUser.id) &&
    currentUser.id !== 'user-1';

  const {
    connectionState: voiceConnectionState,
    partnerConnected,
    isMuted: voiceMuted,
    setMuted: setVoiceMuted,
    statusLabel: voiceStatusLabel,
    leave: leaveVoiceCall,
  } = useSpeedDateCall({
    speedDateId,
    userId: currentUser.id,
    enabled: voiceCallEnabled,
  });

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
    if (!selfExpanded) {
      setShowSelfSettings(false);
    }
  }, [selfExpanded]);

  const goToFeedback = useCallback(async () => {
    if (hasEndedRef.current) {
      return;
    }
    hasEndedRef.current = true;

    if (speedDateId) {
      await leaveVoiceCall('complete');
    }

    const dateId = speedDateId ?? `date-${Date.now()}`;

    if (speedDateId) {
      void updateSpeedDateStatus(speedDateId, 'completed').catch((error) => {
        console.log('[SpeedSpark Pair] Failed to mark speed date completed', error);
      });
    }

    navigation.replace('PostDateFeedback', {
      partnerId: partner.id,
      dateId,
    });
  }, [navigation, partner.id, speedDateId, leaveVoiceCall]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      goToFeedback();
      return;
    }

    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, goToFeedback]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = 1 - secondsLeft / DATE_DURATION_SECONDS;
  const isUrgent = secondsLeft <= 30;
  const zoom = ZOOM_LEVELS[zoomIndex];

  const handleEndEarly = () => {
    if (Platform.OS === 'web') {
      setShowEndConfirm(true);
      return;
    }
    Alert.alert(
      'End this date?',
      'You can leave anytime. Your comfort always comes first.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'End date', style: 'destructive', onPress: goToFeedback },
      ],
    );
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
    if (Platform.OS === 'web') {
      setShowReportConfirm(true);
      return;
    }
    Alert.alert(
      `Report ${partner.name}?`,
      'Thanks for letting us know. This date will end and our safety team will review.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report & end', style: 'destructive', onPress: () => void submitReport() },
      ],
    );
  };

  const confirmReport = () => {
    void submitReport();
  };

  const handleBlock = () => {
    if (Platform.OS === 'web') {
      setShowBlockConfirm(true);
      return;
    }
    Alert.alert(
      `Block ${partner.name}?`,
      'This ends the call immediately. They will not be able to match or message you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block & leave',
          style: 'destructive',
          onPress: confirmBlock,
        },
      ],
    );
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

  const selfCamera = (
    <LocalCameraPreview
      enabled={isVideoOn && hasMediaAccess}
      zoom={zoom}
      facing={facing}
      blurLevel={blurLevel}
      virtualBackground={virtualBackground}
      mute={isVoiceMuted}
      compact={!selfExpanded}
      label="You"
    />
  );

  return (
    <ScreenContainer style={styles.container} contentStyle={styles.content}>
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
            title={permissionsPending ? 'Requesting…' : 'Allow camera & mic'}
            onPress={() => void requestAccess()}
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

      <View style={styles.stage} onLayout={onStageLayout}>
        {selfExpanded ? (
          <>
            <View style={styles.mainFeed}>{selfCamera}</View>
            <Pressable
              style={[
                styles.partnerPiP,
                {
                  left: Math.max(PIP_MARGIN, stageWidth - PIP_WIDTH - PIP_MARGIN),
                  top: Math.max(PIP_MARGIN, stageHeight - PIP_HEIGHT - PIP_MARGIN),
                },
              ]}
              onPress={toggleSelfView}
              accessibilityLabel="Partner video. Tap to swap views."
            >
              <PartnerVideoPane
                compact
                voiceMode={Boolean(speedDateId)}
                partnerConnected={partnerConnected}
                connectionState={voiceConnectionState}
              />
            </Pressable>
          </>
        ) : (
          <>
            <PartnerVideoPane
              voiceMode={Boolean(speedDateId)}
              partnerConnected={partnerConnected}
              connectionState={voiceConnectionState}
            />
            <DraggableVideoPiP
              stageWidth={stageWidth}
              stageHeight={stageHeight}
              visible={selfVisible}
              onSwap={toggleSelfView}
              onHide={() => setSelfVisible(false)}
            >
              {selfCamera}
            </DraggableVideoPiP>
          </>
        )}

        {selfExpanded && showSelfSettings && (
          <View style={styles.expandedEffectsBar} pointerEvents="box-none">
            <CameraEffectsPanel
              blurLevel={blurLevel}
              virtualBackground={virtualBackground}
              onBlurChange={setBlurLevel}
              onBackgroundChange={setVirtualBackground}
              onZoomOut={() => setZoomIndex((i) => Math.max(0, i - 1))}
              onZoomIn={() => setZoomIndex((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
              onFlip={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
              onClose={() => setShowSelfSettings(false)}
              zoomOutDisabled={zoomIndex === 0}
              zoomInDisabled={zoomIndex === ZOOM_LEVELS.length - 1}
            />
          </View>
        )}

        <View style={[styles.stageTopBar, !selfExpanded && styles.stageTopBarCompact]}>
          {!selfVisible && !selfExpanded && (
            <Pressable style={styles.stageChip} onPress={() => setSelfVisible(true)}>
              <Ionicons name="eye-outline" size={14} color={colors.text} />
              <Text style={styles.stageChipText}>Show camera</Text>
            </Pressable>
          )}
          {selfExpanded && (
            <Pressable
              style={[styles.stageChip, showSelfSettings && styles.stageChipActive]}
              onPress={() => setShowSelfSettings((v) => !v)}
            >
              <Ionicons name="options-outline" size={14} color={colors.text} />
              <Text style={styles.stageChipText}>Effects</Text>
            </Pressable>
          )}
          <View style={styles.stageStatusChip}>
            <Ionicons
              name={
                speedDateId
                  ? voiceConnectionState === 'connected' && partnerConnected
                    ? 'radio'
                    : voiceConnectionState === 'failed'
                      ? 'alert-circle-outline'
                      : 'radio-outline'
                  : hasMediaAccess
                    ? 'radio-outline'
                    : 'alert-circle-outline'
              }
              size={12}
              color={
                speedDateId
                  ? voiceConnectionState === 'connected' && partnerConnected
                    ? colors.success
                    : voiceConnectionState === 'failed'
                      ? colors.error
                      : colors.sparkOrange
                  : hasMediaAccess
                    ? colors.success
                    : colors.sparkOrange
              }
            />
            <Text style={styles.stageStatusText}>
              {speedDateId
                ? voiceStatusLabel
                : hasMediaAccess
                  ? 'Mic ready'
                  : denied
                    ? 'No access'
                    : 'Waiting…'}
            </Text>
          </View>
        </View>

        <View style={styles.stageControls}>
          <OverlayIcon
            icon={isVoiceMuted ? 'mic-off' : 'mic'}
            onPress={toggleMute}
            active={isVoiceMuted}
            label={isVoiceMuted ? 'Unmute' : 'Mute'}
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
          <OverlayIcon icon="flag" onPress={handleReport} danger label="Report" />
          <OverlayIcon icon="ban" onPress={handleBlock} danger label="Block" />
        </View>
      </View>

      <Text style={styles.stageHint}>
        Tap the small video to swap views · drag your camera to move it
      </Text>

      {showEndConfirm && (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>End this date?</Text>
          <Text style={styles.confirmText}>
            You can leave anytime. Your comfort always comes first.
          </Text>
          <View style={styles.confirmActions}>
            <Button title="Stay" onPress={() => setShowEndConfirm(false)} variant="outline" size="sm" />
            <Button title="End date" onPress={goToFeedback} variant="primary" size="sm" />
          </View>
        </View>
      )}

      {showReportConfirm && (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Report {partner.name}?</Text>
          <Text style={styles.confirmText}>
            Thanks for letting us know. This date will end and our safety team will review.
          </Text>
          <View style={styles.confirmActions}>
            <Button title="Cancel" onPress={() => setShowReportConfirm(false)} variant="outline" size="sm" />
            <Button title="Report & end" onPress={confirmReport} size="sm" />
          </View>
        </View>
      )}

      {showBlockConfirm && (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Block {partner.name}?</Text>
          <Text style={styles.confirmText}>
            This ends the call immediately. They won't be able to match or message you again.
          </Text>
          <View style={styles.confirmActions}>
            <Button title="Cancel" onPress={() => setShowBlockConfirm(false)} variant="outline" size="sm" />
            <Button title="Block & leave" onPress={confirmBlock} size="sm" />
          </View>
        </View>
      )}

      <View style={styles.safety}>
        <Ionicons name="shield-checkmark" size={16} color={colors.sparkOrange} />
        <Text style={styles.safetyText}>
          End, report, or block anytime. You never owe anyone your time.
        </Text>
      </View>

      <Button title="End date early" onPress={handleEndEarly} variant="outline" size="md" />
    </ScreenContainer>
  );
}

function PartnerVideoPane({
  compact = false,
  voiceMode = false,
  partnerConnected = false,
  connectionState = 'idle',
}: {
  compact?: boolean;
  voiceMode?: boolean;
  partnerConnected?: boolean;
  connectionState?: string;
}) {
  const paneSub = voiceMode
    ? partnerConnected
      ? 'Voice connected'
      : connectionState === 'connecting' || connectionState === 'reconnecting'
        ? 'Connecting voice…'
        : 'Waiting for date…'
    : 'Live video';
  const badgeText = voiceMode
    ? partnerConnected
      ? 'On call'
      : 'Voice'
    : compact
      ? 'Date'
      : 'Video feed';

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
      <View style={[styles.feedBadge, compact && styles.feedBadgeCompact]}>
        <View style={[styles.feedDot, voiceMode && partnerConnected && styles.feedDotLive]} />
        <Text style={styles.feedBadgeText}>{badgeText}</Text>
      </View>
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
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  permissionBanner: {
    alignItems: 'center',
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
    marginBottom: spacing.md,
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
    width: '100%',
    aspectRatio: 3 / 4,
    maxHeight: 440,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
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
  partnerPiP: {
    position: 'absolute',
    width: PIP_WIDTH,
    height: PIP_HEIGHT,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 10,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
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
  feedBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  feedBadgeCompact: {
    top: spacing.xs,
    left: spacing.xs,
    paddingHorizontal: 6,
  },
  feedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
  feedDotLive: {
    backgroundColor: colors.success,
  },
  feedBadgeText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.text,
    fontWeight: '600',
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
  stageChipActive: {
    borderWidth: 1,
    borderColor: colors.sparkOrange,
  },
  stageChipText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.text,
    fontWeight: '600',
  },
  stageStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    marginLeft: 'auto',
  },
  stageStatusText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
  },
  expandedEffectsBar: {
    position: 'absolute',
    bottom: 58,
    left: spacing.sm,
    right: spacing.sm,
    zIndex: 25,
  },
  stageControls: {
    position: 'absolute',
    bottom: spacing.lg,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
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
  stageHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    width: '100%',
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
  safety: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  safetyText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
});
