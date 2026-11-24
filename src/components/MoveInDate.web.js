import { localDate } from '../services/submissionRules';
import { buyerColors as c } from '../styles/buyerTheme';

export default function MoveInDate({ value, onChange, disabled }) {
  return <input type="date" aria-label="Move-in date" min={localDate()} value={value}
    disabled={disabled} onChange={(event) => onChange(event.target.value)}
    style={{ height: 48, padding: '0 16px', boxSizing: 'border-box', width: '100%', font: 'inherit',
      color: c.text, background: c.background, border: '1px solid ' + c.border, borderRadius: 8 }} />;
}
