import { useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { localDate } from '../services/submissionRules';
import { buyerStyles as s } from '../styles/buyerTheme';

export default function MoveInDate({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Move-in date" disabled={disabled}
      onPress={() => setOpen(!open)} style={[s.input, { justifyContent: 'center' }]}>
      <Text style={s.label}>{value || 'Date'}</Text>
    </Pressable>
    {open && !disabled && <DateTimePicker mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'}
      value={value ? new Date(value + 'T12:00:00') : today} minimumDate={today}
      onDismiss={() => setOpen(false)}
      onValueChange={(_event, date) => { setOpen(false); onChange(localDate(date)); }} />}
  </>;
}
