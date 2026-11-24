import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Figma-styled floating pop-up notification banner (#292424 surface, #B6331E accent, #F6F5F0 text).
 * Works across Web, iOS, and Android with zero external dependencies.
 */
export default function NotificationBanner({ notification, onPress, onDismiss }) {
  // Created once per banner (lazy state), readable during render.
  const [translateY] = useState(() => new Animated.Value(-110));
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!notification) return;

    translateY.setValue(-110);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 70,
        friction: 11,
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -110,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: false,
        }),
      ]).start(() => {
        onDismiss?.();
      });
    }, 5200);

    return () => clearTimeout(timer);
  }, [notification, onDismiss, opacity, translateY]);

  if (!notification) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable
        accessibilityRole="alert"
        style={styles.banner}
        onPress={() => onPress?.(notification)}
      >
        <View style={styles.accentBar} />
        <View style={styles.bodyWrap}>
          <View style={styles.topRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{notification.badge || 'HOLMIA'}</Text>
            </View>
            <Text style={styles.title} numberOfLines={1}>
              {notification.title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss notification"
              hitSlop={10}
              onPress={(e) => {
                e?.stopPropagation?.();
                onDismiss?.();
              }}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          {notification.body ? (
            <Text style={styles.body} numberOfLines={2}>
              {notification.body}
            </Text>
          ) : null}
          {notification.targetTab ? (
            <Text style={styles.hint}>Tap to open →</Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  banner: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    backgroundColor: '#292424',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4A4242',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  accentBar: {
    width: 5,
    backgroundColor: '#B6331E',
  },
  bodyWrap: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#B6331E',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#F6F5F0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  title: {
    flex: 1,
    color: '#F6F5F0',
    fontSize: 14,
    fontWeight: '700',
  },
  closeText: {
    color: '#C7C1B8',
    fontSize: 14,
    fontWeight: '700',
    paddingLeft: 6,
  },
  body: {
    color: '#EAE6DF',
    fontSize: 13,
    lineHeight: 18,
  },
  hint: {
    color: '#E59A8B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
