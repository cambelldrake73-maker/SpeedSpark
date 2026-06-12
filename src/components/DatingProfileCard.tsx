import React, { useMemo, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import {
  GENDER_OPTIONS,
  INTERESTED_IN_GENDER_OPTIONS,
  LOOKING_FOR_OPTIONS,
  ORIENTATION_OPTIONS,
  PRESENTATION_OPTIONS,
} from '../constants/options';
import type { UserProfile } from '../types';
import { formatHeightInches } from '../utils/heightFormat';

interface DatingProfileCardProps {
  user: UserProfile;
  /** Lighter layout for post-date feedback — swipeable photos + full details on page. */
  variant?: 'full' | 'compact';
}

function getLabel<T extends string>(
  options: { value: T; label: string }[],
  value: T,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function DatingProfileCard({ user, variant = 'full' }: DatingProfileCardProps) {
  const isCompact = variant === 'compact';
  const photos = useMemo(
    () => (user.photos.filter(Boolean).length > 0 ? user.photos.filter(Boolean) : ['']),
    [user.photos],
  );
  const [photoIndex, setPhotoIndex] = useState(0);
  const [frameWidth, setFrameWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onFrameLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    if (width > 0 && width !== frameWidth) {
      setFrameWidth(width);
    }
  };

  const onPhotoScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (frameWidth <= 0) {
      return;
    }
    const index = Math.round(event.nativeEvent.contentOffset.x / frameWidth);
    setPhotoIndex(index);
  };

  const presLabels = user.presentationTags.map((p) => getLabel(PRESENTATION_OPTIONS, p));
  const intentionLabels = user.datingIntentions.map((i) => getLabel(LOOKING_FOR_OPTIONS, i));
  const interestedInLabels = user.interestedInGenders.map((g) =>
    getLabel(INTERESTED_IN_GENDER_OPTIONS, g),
  );

  return (
    <View style={styles.card}>
      <View style={[styles.photoFrame, isCompact && styles.photoFrameCompact]} onLayout={onFrameLayout}>
        {frameWidth > 0 ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onPhotoScroll}
            style={styles.photoScroll}
          >
            {photos.map((uri, index) => (
              <View key={`${uri}-${index}`} style={[styles.photoSlide, { width: frameWidth }]}>
                {uri ? (
                  <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                ) : (
                  <View style={styles.photoFallback}>
                    <Ionicons name="person" size={64} color={colors.textMuted} />
                  </View>
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.85)']}
                  style={styles.photoGradient}
                />
                <View style={styles.photoOverlay}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, isCompact && styles.nameCompact]}>
                      {user.name}
                      {user.age > 0 ? `, ${user.age}` : ''}
                    </Text>
                    {user.verificationStatus === 'verified' && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                      </View>
                    )}
                  </View>
                  {user.location ? (
                    <Text style={styles.location}>{user.location}</Text>
                  ) : null}
                  {!isCompact && user.heightInches ? (
                    <Text style={styles.meta}>{formatHeightInches(user.heightInches)}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.photoSlide, styles.photoPlaceholder]} />
        )}

        {photos.length > 1 && frameWidth > 0 ? (
          <View style={styles.dots}>
            {photos.map((_, index) => (
              <View
                key={index}
                style={[styles.dot, photoIndex === index && styles.dotActive]}
              />
            ))}
          </View>
        ) : null}
      </View>

      {isCompact ? (
        <View style={styles.compactDetails}>
          <DetailRow
            label="Gender"
            value={getLabel(GENDER_OPTIONS, user.genderIdentity)}
          />
          <DetailRow
            label="Orientation"
            value={getLabel(ORIENTATION_OPTIONS, user.sexualOrientation)}
          />
          {user.heightInches > 0 ? (
            <DetailRow label="Height" value={formatHeightInches(user.heightInches)} />
          ) : null}
          {intentionLabels.length > 0 ? (
            <DetailTags label="Dating intentions" tags={intentionLabels} />
          ) : null}
          {interestedInLabels.length > 0 ? (
            <DetailTags label="Interested in" tags={interestedInLabels} />
          ) : null}
          {presLabels.length > 0 ? (
            <DetailTags label="Presentation" tags={presLabels} />
          ) : null}
          {user.lifestyleTags.length > 0 ? (
            <DetailTags label="Lifestyle & values" tags={user.lifestyleTags} />
          ) : null}
        </View>
      ) : (
        <View style={styles.details}>
          <ProfileSection title="About">
            <Text style={styles.aboutText}>
              {user.lifestyleTags.slice(0, 3).join(' · ') || 'SpeedSpark member'}
            </Text>
          </ProfileSection>

          <ProfileSection title="Identity">
            <TagRow
              tags={[
                getLabel(GENDER_OPTIONS, user.genderIdentity),
                getLabel(ORIENTATION_OPTIONS, user.sexualOrientation),
              ]}
            />
          </ProfileSection>

          {intentionLabels.length > 0 && (
            <ProfileSection title="Dating intentions">
              <TagRow tags={intentionLabels} />
            </ProfileSection>
          )}

          {interestedInLabels.length > 0 && (
            <ProfileSection title="Interested in">
              <TagRow tags={interestedInLabels} />
            </ProfileSection>
          )}

          {presLabels.length > 0 && (
            <ProfileSection title="Presentation">
              <TagRow tags={presLabels} />
            </ProfileSection>
          )}

          {user.lifestyleTags.length > 0 && (
            <ProfileSection title="Lifestyle & values">
              <TagRow tags={user.lifestyleTags} />
            </ProfileSection>
          )}
        </View>
      )}
    </View>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function TagRow({ tags }: { tags: string[] }) {
  return (
    <View style={styles.tagRow}>
      {tags.map((tag) => (
        <View key={tag} style={styles.tag}>
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      ))}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function DetailTags({ label, tags }: { label: string; tags: string[] }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailTagRow}>
        {tags.map((tag) => (
          <View key={tag} style={styles.detailTag}>
            <Text style={styles.detailTagText}>{tag}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    alignItems: 'stretch',
  },
  photoFrame: {
    width: '100%',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  photoFrameCompact: {
    marginBottom: spacing.sm,
  },
  photoScroll: {
    width: '100%',
  },
  photoSlide: {
    aspectRatio: 3 / 4,
    position: 'relative',
  },
  photoPlaceholder: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  photoGradient: {
    ...StyleSheet.absoluteFill,
  },
  photoOverlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    ...typography.title,
    fontSize: 28,
    color: colors.text,
  },
  nameCompact: {
    fontSize: 24,
  },
  verifiedBadge: {
    marginTop: 4,
  },
  location: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  meta: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
  },
  dots: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: colors.text,
  },
  compactDetails: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  detailRow: {
    gap: spacing.xs,
  },
  detailLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  detailTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  detailTag: {
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailTagText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  details: {
    width: '100%',
    gap: spacing.md,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  aboutText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
});
