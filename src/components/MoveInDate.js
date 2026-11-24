import { useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { localDate } from '../services/submissionRules';
import { buyerStyles as s } from '../styles/buyerTheme';

export default function MoveInDate({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const ios = Platform.OS === 'ios';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Move-in date" disabled={disabled}
      onPress={() => { setDraft(value ? new Date(value + 'T12:00:00') : today); setOpen(!open); }} style={[s.input, { justifyContent: 'center' }]}>
      <Text style={s.label}>{value || 'Date'}</Text>
    </Pressable>
    {open && !disabled && <DateTimePicker mode="date" display={ios ? 'inline' : 'default'}
      value={draft || today} minimumDate={today}
      onDismiss={() => setOpen(false)}
      onValueChange={(_event, date) => {
        if (ios) setDraft(date);
        else { setOpen(false); onChange(localDate(date)); }
      }} />}
    {ios && open && !disabled &&
      <Pressable accessibilityRole="button" style={s.button}
        onPress={() => { onChange(localDate(draft || today)); setOpen(false); }}>
        <Text style={s.text}>Use this date</Text>
      </Pressable>}
  </>;
}
