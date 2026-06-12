import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors } from '../constants/theme';

export const PIP_WIDTH = 120;
export const PIP_HEIGHT = 160;
const PIP_MARGIN = 8;
const TAP_SLOP = 6;

interface DraggableVideoPiPProps {
  boundsWidth: number;
  boundsHeight: number;
  initialPosition?: { x: number; y: number } | null;
  visible?: boolean;
  children: React.ReactNode;
  onSwap: () => void;
  onHide: () => void;
  showCloseButton?: boolean;
  style?: ViewStyle;
}

function clampPosition(
  x: number,
  y: number,
  boundsWidth: number,
  boundsHeight: number,
) {
  const maxX = Math.max(PIP_MARGIN, boundsWidth - PIP_WIDTH - PIP_MARGIN);
  const maxY = Math.max(PIP_MARGIN, boundsHeight - PIP_HEIGHT - PIP_MARGIN);
  return {
    x: Math.min(maxX, Math.max(PIP_MARGIN, x)),
    y: Math.min(maxY, Math.max(PIP_MARGIN, y)),
  };
}

function defaultPiPPosition(boundsWidth: number, boundsHeight: number) {
  return clampPosition(
    boundsWidth - PIP_WIDTH - PIP_MARGIN,
    PIP_MARGIN,
    boundsWidth,
    boundsHeight,
  );
}

export function DraggableVideoPiP({
  boundsWidth,
  boundsHeight,
  initialPosition,
  visible = true,
  children,
  onSwap,
  onHide,
  showCloseButton = true,
  style,
}: DraggableVideoPiPProps) {
  const boundsRef = useRef({ width: boundsWidth, height: boundsHeight });
  boundsRef.current = { width: boundsWidth, height: boundsHeight };

  const [position, setPosition] = useState(() =>
    initialPosition
      ? clampPosition(initialPosition.x, initialPosition.y, boundsWidth, boundsHeight)
      : defaultPiPPosition(boundsWidth, boundsHeight),
  );
  const [isDragging, setIsDragging] = useState(false);
  const positionRef = useRef(position);
  positionRef.current = position;

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const appliedInitialRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (boundsWidth <= 0 || boundsHeight <= 0) {
      return;
    }

    if (initialPosition) {
      const sameAsApplied =
        appliedInitialRef.current?.x === initialPosition.x &&
        appliedInitialRef.current?.y === initialPosition.y;
      if (!sameAsApplied && !isDragging) {
        const next = clampPosition(
          initialPosition.x,
          initialPosition.y,
          boundsWidth,
          boundsHeight,
        );
        appliedInitialRef.current = initialPosition;
        positionRef.current = next;
        setPosition(next);
        hasInitializedRef.current = true;
      }
      return;
    }

    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;
    const next = defaultPiPPosition(boundsWidth, boundsHeight);
    positionRef.current = next;
    setPosition(next);
  }, [boundsWidth, boundsHeight, initialPosition, isDragging]);

  useEffect(() => {
    if (isDragging || boundsWidth <= 0 || boundsHeight <= 0) {
      return;
    }
    setPosition((prev) => clampPosition(prev.x, prev.y, boundsWidth, boundsHeight));
  }, [boundsWidth, boundsHeight, isDragging]);

  const finishGesture = useCallback(() => {
    if (!didDragRef.current) {
      onSwap();
    }
    dragStartRef.current = null;
    didDragRef.current = false;
    setIsDragging(false);
  }, [onSwap]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (_, gesture) => {
        didDragRef.current = false;
        dragStartRef.current = {
          x: positionRef.current.x - gesture.dx,
          y: positionRef.current.y - gesture.dy,
        };
        setIsDragging(true);
      },
      onPanResponderMove: (_, gesture) => {
        if (Math.abs(gesture.dx) > TAP_SLOP || Math.abs(gesture.dy) > TAP_SLOP) {
          didDragRef.current = true;
        }
        const start = dragStartRef.current;
        if (!start) {
          return;
        }
        const { width, height } = boundsRef.current;
        const next = clampPosition(start.x + gesture.dx, start.y + gesture.dy, width, height);
        positionRef.current = next;
        setPosition(next);
      },
      onPanResponderRelease: finishGesture,
      onPanResponderTerminate: finishGesture,
    }),
  ).current;

  const onWebPointerDown = useCallback(
    (event: { nativeEvent: { pageX: number; pageY: number; target: EventTarget | null } }) => {
      if (Platform.OS !== 'web' || typeof window === 'undefined') {
        return;
      }

      const target = event.nativeEvent.target as HTMLElement | null;
      const pointerId = (event as unknown as { pointerId?: number }).pointerId;
      if (target && pointerId != null && target.setPointerCapture) {
        target.setPointerCapture(pointerId);
      }

      didDragRef.current = false;
      const originPageX = event.nativeEvent.pageX;
      const originPageY = event.nativeEvent.pageY;
      dragStartRef.current = {
        x: positionRef.current.x,
        y: positionRef.current.y,
      };
      setIsDragging(true);

      const handleMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.pageX - originPageX;
        const dy = moveEvent.pageY - originPageY;
        if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) {
          didDragRef.current = true;
        }
        const start = dragStartRef.current;
        if (!start) {
          return;
        }
        const { width, height } = boundsRef.current;
        const next = clampPosition(start.x + dx, start.y + dy, width, height);
        positionRef.current = next;
        setPosition(next);
      };

      const handleUp = () => {
        finishGesture();
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
    },
    [finishGesture],
  );

  if (!visible || boundsWidth <= 0 || boundsHeight <= 0) {
    return null;
  }

  const panHandlers =
    Platform.OS === 'web' ? { onPointerDown: onWebPointerDown } : panResponder.panHandlers;

  return (
    <View
      style={[
        styles.pip,
        isDragging && styles.pipDragging,
        {
          left: position.x,
          top: position.y,
          width: PIP_WIDTH,
          height: PIP_HEIGHT,
        },
        style,
      ]}
      {...panHandlers}
      accessibilityLabel="Video preview. Tap to swap views, drag anywhere to move."
    >
      <View style={styles.preview} pointerEvents="none">
        {children}
      </View>

      {showCloseButton ? (
        <Pressable
          style={styles.iconBtnClose}
          onPress={onHide}
          hitSlop={10}
          {...(Platform.OS === 'web'
            ? { onPointerDown: (event) => event.stopPropagation() }
            : {})}
        >
          <Ionicons name="close" size={13} color={colors.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function usePiPStageLayout() {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const onStageLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  };

  return { stageWidth: layout.width, stageHeight: layout.height, onStageLayout };
}

const styles = StyleSheet.create({
  pip: {
    position: 'absolute',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    zIndex: 1000,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.45)',
          userSelect: 'none',
          cursor: 'grab',
          touchAction: 'none',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          elevation: 16,
        }),
  },
  pipDragging: {
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 10px 32px rgba(0, 0, 0, 0.55)', cursor: 'grabbing' }
      : { opacity: 0.98, elevation: 20 }),
  },
  preview: {
    flex: 1,
    overflow: 'hidden',
  },
  iconBtnClose: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
  },
});
