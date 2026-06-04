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
const PIP_MARGIN = 12;
const DRAG_THRESHOLD = 8;

interface DraggableVideoPiPProps {
  stageWidth: number;
  stageHeight: number;
  visible: boolean;
  children: React.ReactNode;
  onSwap: () => void;
  onHide: () => void;
  style?: ViewStyle;
}

export function DraggableVideoPiP({
  stageWidth,
  stageHeight,
  visible,
  children,
  onSwap,
  onHide,
  style,
}: DraggableVideoPiPProps) {
  const maxX = Math.max(PIP_MARGIN, stageWidth - PIP_WIDTH - PIP_MARGIN);
  const maxY = Math.max(PIP_MARGIN, stageHeight - PIP_HEIGHT - PIP_MARGIN);

  const [position, setPosition] = useState({ x: maxX, y: maxY });
  const [isDragging, setIsDragging] = useState(false);
  const positionRef = useRef(position);
  positionRef.current = position;

  const dragStartRef = useRef<{ x: number; y: number; pageX: number; pageY: number } | null>(
    null,
  );
  const didDragRef = useRef(false);
  const hasPositionedRef = useRef(false);

  useEffect(() => {
    if (stageWidth > 0 && stageHeight > 0 && !hasPositionedRef.current) {
      hasPositionedRef.current = true;
      setPosition({
        x: Math.max(PIP_MARGIN, stageWidth - PIP_WIDTH - PIP_MARGIN),
        y: Math.max(PIP_MARGIN, stageHeight - PIP_HEIGHT - PIP_MARGIN),
      });
    }
  }, [stageWidth, stageHeight]);

  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.min(maxX, Math.max(PIP_MARGIN, x)),
      y: Math.min(maxY, Math.max(PIP_MARGIN, y)),
    }),
    [maxX, maxY],
  );

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
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: (_, gesture) => {
        didDragRef.current = false;
        dragStartRef.current = {
          x: positionRef.current.x,
          y: positionRef.current.y,
          pageX: gesture.x0,
          pageY: gesture.y0,
        };
        setIsDragging(true);
      },
      onPanResponderMove: (_, gesture) => {
        if (Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD) {
          didDragRef.current = true;
        }
        const start = dragStartRef.current;
        if (!start) return;
        setPosition(clamp(start.x + gesture.dx, start.y + gesture.dy));
      },
      onPanResponderRelease: finishGesture,
      onPanResponderTerminate: finishGesture,
    }),
  ).current;

  const onWebPointerDown = useCallback(
    (event: { nativeEvent: { pageX: number; pageY: number } }) => {
      if (Platform.OS !== 'web' || typeof window === 'undefined') {
        return;
      }

      didDragRef.current = false;
      const start = {
        x: positionRef.current.x,
        y: positionRef.current.y,
        pageX: event.nativeEvent.pageX,
        pageY: event.nativeEvent.pageY,
      };
      dragStartRef.current = start;
      setIsDragging(true);

      const handleMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.pageX - start.pageX;
        const dy = moveEvent.pageY - start.pageY;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
          didDragRef.current = true;
        }
        setPosition(clamp(start.x + dx, start.y + dy));
      };

      const handleUp = () => {
        finishGesture();
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [clamp, finishGesture],
  );

  if (!visible || stageWidth === 0 || stageHeight === 0) {
    return null;
  }

  const dragHandlers =
    Platform.OS === 'web'
      ? { onPointerDown: onWebPointerDown }
      : panResponder.panHandlers;

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
    >
      <View
        style={styles.dragSurface}
        {...dragHandlers}
        accessibilityLabel="Your camera. Tap the small preview to swap views, drag to move."
      >
        {children}
      </View>

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
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.45)',
          userSelect: 'none',
          cursor: 'pointer',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          elevation: 8,
        }),
  },
  pipDragging: {
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 10px 32px rgba(0, 0, 0, 0.55)' }
      : { opacity: 0.95 }),
  },
  dragSurface: {
    flex: 1,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ touchAction: 'none' } as object) : null),
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
