import React, { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
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
  LOOKING_FOR_OPTIONS,
  ORIENTATION_OPTIONS,
  PRESENTATION_OPTIONS,
} from '../constants/options';
import type { UserProfile } from '../types';
import { formatHeightInches } from '../utils/heightFormat';

interface DatingProfileCardProps {
  user: UserProfile;
}

function getLabel<T extends string>(
  options: { value: T; label: string }[],
  value: T,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function DatingProfileCard({ user }: DatingProfileCardProps) {
  const photos = useMemo(
    () => (user.photos.filter(Boolean).length > 0 ? user.photos.filter(Boolean) : ['']),
    [user.photos],
  );
  const [photoIndex, setPhotoIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const cardWidth = Dimensions.get('window').width;
  const photoWidth = Math.min(cardWidth - spacing.md * 2, 520);

  const onPhotoScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / photoWidth);
    setPhotoIndex(index);
  };

  const presLabels = user.presentationTags
    .filter((p) => p !== 'prefer_not_to_say')
    .map((p) => getLabel(PRESENTATION_OPTIONS, p));

  return (
    <View style={styles.card}>
      <View style={[styles.photoFrame, { width: photoWidth }]}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onPhotoScroll}
          style={styles.photoScroll}
        >
          {photos.map((uri, index) => (
            <View key={`${uri}-${index}`} style={[styles.photoSlide, { width: photoWidth }]}>
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
                  <Text style={styles.name}>
                    {user.name}
                    {user.age > 0 ? `, ${user.age}` : ''}
                  </Text>
                  {user.verificationStatus === 'verified' && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                    </View>
                  )}
                </View>
                {user.location ? <Text style={styles.location}>{user.location}</Text> : null}
                {user.heightInches ? (
                  <Text style={styles.meta}>{formatHeightInches(user.heightInches)}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>

        {photos.length > 1 && (
          <View style={styles.dots}>
            {photos.map((_, index) => (
              <View
                key={index}
                style={[styles.dot, photoIndex === index && styles.dotActive]}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.details}>
        <ProfileSection title="About">
          <Text style={styles.aboutText}>
            {user.personalityTags.slice(0, 3).join(' · ') || 'SpeedSpark member'}
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

        {user.lookingFor.length > 0 && (
          <ProfileSection title="Looking for">
            <TagRow tags={user.lookingFor.map((lf) => getLabel(LOOKING_FOR_OPTIONS, lf))} />
          </ProfileSection>
        )}

        {presLabels.length > 0 && (
          <ProfileSection title="Presentation">
            <TagRow tags={presLabels} />
          </ProfileSection>
        )}

        {user.personalityTags.length > 0 && (
          <ProfileSection title="Vibe">
            <TagRow tags={user.personalityTags} />
          </ProfileSection>
        )}

        {user.lifestyleTags && user.lifestyleTags.length > 0 && (
          <ProfileSection title="Lifestyle">
            <TagRow tags={user.lifestyleTags} />
          </ProfileSection>
        )}
      </View>
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

const styles = StyleSheet.create({
  card: {
    width: '100%',
    alignItems: 'center',
  },
  photoFrame: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  photoScroll: {
    width: '100%',
  },
  photoSlide: {
    aspectRatio: 3 / 4,
    position: 'relative',
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
