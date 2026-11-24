import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { formatLocalISO, requestViewing, VIEWING_SLOTS } from '../services/viewingService';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday = 0 ... Sunday = 6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Figma Screen 18 — Book a viewing (bonus)
 * Exact #F6F5F0 ivory surface, #292424 borders/ink, rgba(182,51,30,0.1) calendar box,
 * 10:00 / 14:00 / 17:00 pills, and #B6331E Request viewing primary CTA.
 */
export default function BookViewingScreen({ property, onBack, onBooked }) {
  const { profile } = useAuth();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayISO = useMemo(() => formatLocalISO(today), [today]);

  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);

  const [viewYear, setViewYear] = useState(tomorrow.getFullYear());
  const [viewMonth, setViewMonth] = useState(tomorrow.getMonth());
  const [selectedDate, setSelectedDate] = useState(formatLocalISO(tomorrow));
  const [selectedTime, setSelectedTime] = useState('14:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      }),
    [viewYear, viewMonth]
  );

  const shiftMonth = (delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const booking = await requestViewing({
        property,
        date: selectedDate,
        time: selectedTime,
        buyerId: profile?.id,
        buyerName: profile?.full_name || profile?.username || 'Demo Buyer',
      });
      onBooked?.(booking);
    } catch (failure) {
      setError(failure.message || 'Unable to book viewing. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onBack}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Figma 18 Header */}
          <Pressable accessibilityRole="button" onPress={onBack} disabled={busy}>
            <Text style={styles.headerTitle}>← Book a viewing</Text>
          </Pressable>

          {/* Property Summary Card */}
          <View style={styles.propertyCard}>
            <Text style={styles.propertyTitle} numberOfLines={1}>
              {property?.title || 'Property'}
            </Text>
            <Text style={styles.propertyLocation} numberOfLines={1}>
              {property?.location || 'Location'}
            </Text>
          </View>

          {/* Pick a date */}
          <Text style={styles.sectionLabel}>Pick a date</Text>

          {/* Figma 18 Calendar Box — rgba(182,51,30,0.1), rounded-6 */}
          <View style={styles.calendarBox}>
            <View style={styles.calendarHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                style={styles.monthNavBtn}
                onPress={() => shiftMonth(-1)}
              >
                <Text style={styles.monthNavText}>‹</Text>
              </Pressable>
              <Text style={styles.monthTitle}>{monthLabel}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                style={styles.monthNavBtn}
                onPress={() => shiftMonth(1)}
              >
                <Text style={styles.monthNavText}>›</Text>
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={styles.weekdayText}>
                  {w}
                </Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {cells.map((dayObj, idx) => {
                if (!dayObj) {
                  return <View key={`empty-${idx}`} style={styles.dayCell} />;
                }
                const iso = formatLocalISO(dayObj);
                const isPast = iso < todayISO;
                const isSelected = iso === selectedDate;
                return (
                  <Pressable
                    key={iso}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled: isPast }}
                    disabled={isPast}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                      isPast && styles.dayCellDisabled,
                    ]}
                    onPress={() => setSelectedDate(iso)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isSelected && styles.dayTextSelected,
                        isPast && styles.dayTextDisabled,
                      ]}
                    >
                      {dayObj.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Pick a time */}
          <Text style={styles.sectionLabel}>Pick a time</Text>
          <View style={styles.timeRow}>
            {VIEWING_SLOTS.map((slot) => {
              const active = selectedTime === slot;
              return (
                <Pressable
                  key={slot}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.timePill, active && styles.timePillActive]}
                  onPress={() => setSelectedTime(slot)}
                >
                  <Text style={[styles.timePillText, active && styles.timePillTextActive]}>
                    {slot}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {error}
            </Text>
          ) : null}

          <View style={styles.spacer} />

          {/* Figma 18 Primary CTA: Request viewing (#B6331E, h-52) */}
          <Pressable
            accessibilityRole="button"
            disabled={busy || !selectedDate || !selectedTime}
            style={[styles.primaryBtn, (busy || !selectedDate) && styles.primaryBtnDisabled]}
            onPress={submit}
          >
            {busy ? (
              <ActivityIndicator color="#F6F5F0" />
            ) : (
              <Text style={styles.primaryBtnText}>Request viewing</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F5F0',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 28,
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#292424',
  },
  propertyCard: {
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    padding: 12,
    gap: 6,
    backgroundColor: '#F6F5F0',
  },
  propertyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#292424',
  },
  propertyLocation: {
    fontSize: 13,
    fontWeight: '400',
    color: '#292424',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: '#292424',
  },
  calendarBox: {
    backgroundColor: 'rgba(182, 51, 30, 0.1)',
    borderRadius: 6,
    padding: 12,
    minHeight: 220,
    gap: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  monthNavBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  monthNavText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#292424',
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#292424',
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#66605A',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.285%',
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  dayCellSelected: {
    backgroundColor: '#B6331E',
  },
  dayCellDisabled: {
    opacity: 0.35,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#292424',
  },
  dayTextSelected: {
    color: '#F6F5F0',
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: '#66605A',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timePill: {
    backgroundColor: '#F6F5F0',
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  timePillActive: {
    backgroundColor: '#292424',
  },
  timePillText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#292424',
  },
  timePillTextActive: {
    color: '#F6F5F0',
    fontWeight: '700',
  },
  errorText: {
    fontSize: 13,
    color: '#B6331E',
  },
  spacer: {
    flex: 1,
    minHeight: 16,
  },
  primaryBtn: {
    height: 52,
    backgroundColor: '#B6331E',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F6F5F0',
  },
});
