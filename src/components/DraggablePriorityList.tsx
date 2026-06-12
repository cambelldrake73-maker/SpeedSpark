import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  MATCHING_PRIORITY_HINTS,
  MATCHING_PRIORITY_LABELS,
} from '../constants/matchingPriorities';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import type { MatchingPriorityCategory } from '../types';

interface DraggablePriorityListProps {
  order: MatchingPriorityCategory[];
  onChange: (order: MatchingPriorityCategory[]) => void;
  onDragStateChange?: (dragging: boolean) => void;
}

const DEFAULT_ROW_HEIGHT = 76;
const REORDER_THRESHOLD = 0.55;
/** Hold the handle this long before reorder drag starts (quick swipes still scroll). */
const DRAG_HOLD_MS = 400;
/** Finger movement before hold completes cancels drag and leaves scrolling alone. */
const HOLD_CANCEL_MOVE_PX = 10;

export function DraggablePriorityList({
  order,
  onChange,
  onDragStateChange,
}: DraggablePriorityListProps) {
  const orderRef = useRef(order);
  orderRef.current = order;

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  const draggingIndexRef = useRef<number | null>(null);
  const rowHeightsRef = useRef<Record<number, number>>({});
  const swapBaselineDyRef = useRef(0);

  const moveItem = useCallback(
    (from: number, to: number) => {
      if (from === to) {
        return;
      }
      const next = [...orderRef.current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      onChange(next);
      draggingIndexRef.current = to;
      setDraggingIndex(to);
    },
    [onChange],
  );

  const finishDrag = useCallback(() => {
    draggingIndexRef.current = null;
    swapBaselineDyRef.current = 0;
    setDraggingIndex(null);
    setDragOffsetY(0);
    onDragStateChange?.(false);
  }, [onDragStateChange]);

  const handleDragMove = useCallback(
    (dy: number) => {
      const currentIndex = draggingIndexRef.current;
      if (currentIndex === null) {
        return;
      }

      setDragOffsetY(dy - swapBaselineDyRef.current);

      let index = currentIndex;
      const height = rowHeightsRef.current[index] ?? DEFAULT_ROW_HEIGHT;
      let relativeDy = dy - swapBaselineDyRef.current;

      while (relativeDy > height * REORDER_THRESHOLD && index < orderRef.current.length - 1) {
        moveItem(index, index + 1);
        index = draggingIndexRef.current!;
        swapBaselineDyRef.current += height;
        relativeDy = dy - swapBaselineDyRef.current;
        setDragOffsetY(relativeDy);
      }

      while (relativeDy < -height * REORDER_THRESHOLD && index > 0) {
        moveItem(index, index - 1);
        index = draggingIndexRef.current!;
        swapBaselineDyRef.current -= height;
        relativeDy = dy - swapBaselineDyRef.current;
        setDragOffsetY(relativeDy);
      }
    },
    [moveItem],
  );

  const handleDragStart = useCallback(
    (index: number) => {
      onDragStateChange?.(true);
      draggingIndexRef.current = index;
      swapBaselineDyRef.current = 0;
      setDraggingIndex(index);
      setDragOffsetY(0);
    },
    [onDragStateChange],
  );

  const handleRowLayout = useCallback((index: number, event: LayoutChangeEvent) => {
    rowHeightsRef.current[index] = event.nativeEvent.layout.height;
  }, []);

  return (
    <View style={styles.list}>
      {order.map((category, index) => (
        <PriorityRow
          key={category}
          category={category}
          index={index}
          isDragging={draggingIndex === index}
          dragOffsetY={draggingIndex === index ? dragOffsetY : 0}
          onLayout={(event) => handleRowLayout(index, event)}
          onDragStart={() => handleDragStart(index)}
          onDragMove={handleDragMove}
          onDragEnd={finishDrag}
        />
      ))}
    </View>
  );
}

interface PriorityRowProps {
  category: MatchingPriorityCategory;
  index: number;
  isDragging: boolean;
  dragOffsetY: number;
  onLayout: (event: LayoutChangeEvent) => void;
  onDragStart: () => void;
  onDragMove: (dy: number) => void;
  onDragEnd: () => void;
}

function PriorityRow({
  category,
  index,
  isDragging,
  dragOffsetY,
  onLayout,
  onDragStart,
  onDragMove,
  onDragEnd,
}: PriorityRowProps) {
  const callbacksRef = useRef({ onDragStart, onDragMove, onDragEnd });
  callbacksRef.current = { onDragStart, onDragMove, onDragEnd };

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const isPendingHoldRef = useRef(false);
  const touchStartPageYRef = useRef(0);
  const dragStartPageYRef = useRef(0);
  const lastPageYRef = useRef(0);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const cancelPendingHold = useCallback(() => {
    clearHoldTimer();
    isPendingHoldRef.current = false;
  }, [clearHoldTimer]);

  const beginDrag = useCallback(() => {
    isPendingHoldRef.current = false;
    isDraggingRef.current = true;
    dragStartPageYRef.current = lastPageYRef.current;
    clearHoldTimer();
    callbacksRef.current.onDragStart();
  }, [clearHoldTimer]);

  const endDrag = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      callbacksRef.current.onDragEnd();
      return;
    }
    cancelPendingHold();
  }, [cancelPendingHold]);

  useEffect(() => () => clearHoldTimer(), [clearHoldTimer]);

  const handleTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      const pageY = event.nativeEvent.pageY;
      touchStartPageYRef.current = pageY;
      lastPageYRef.current = pageY;
      isPendingHoldRef.current = true;
      clearHoldTimer();
      holdTimerRef.current = setTimeout(() => {
        if (isPendingHoldRef.current) {
          beginDrag();
        }
      }, DRAG_HOLD_MS);
    },
    [beginDrag, clearHoldTimer],
  );

  const handleTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      const pageY = event.nativeEvent.pageY;
      lastPageYRef.current = pageY;

      if (isDraggingRef.current) {
        callbacksRef.current.onDragMove(pageY - dragStartPageYRef.current);
        return;
      }

      if (
        isPendingHoldRef.current &&
        Math.abs(pageY - touchStartPageYRef.current) > HOLD_CANCEL_MOVE_PX
      ) {
        cancelPendingHold();
      }
    },
    [cancelPendingHold],
  );

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.row,
        isDragging && styles.rowDragging,
        isDragging ? { transform: [{ translateY: dragOffsetY }] } : null,
        isDragging && Platform.OS === 'web'
          ? ({ zIndex: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' } as object)
          : null,
      ]}
    >
      <View style={styles.rank}>
        <Text style={styles.rankText}>{index + 1}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{MATCHING_PRIORITY_LABELS[category]}</Text>
        <Text style={styles.hint}>{MATCHING_PRIORITY_HINTS[category]}</Text>
      </View>
      <View
        style={[styles.handle, isDragging && styles.handleActive]}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={endDrag}
        onTouchCancel={endDrag}
        accessibilityRole="button"
        accessibilityLabel={`Hold to drag and reorder ${MATCHING_PRIORITY_LABELS[category]}`}
        accessibilityHint="Press and hold briefly, then drag up or down"
      >
        <Ionicons name="reorder-three" size={24} color={colors.textMuted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  rowDragging: {
    borderColor: colors.sparkOrange,
    backgroundColor: colors.surfaceAlt,
    ...(Platform.OS === 'android' ? { elevation: 6 } : {}),
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
        }
      : {}),
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 16,
    marginTop: 2,
  },
  handle: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleActive: {
    backgroundColor: colors.surfaceAlt,
  },
});
