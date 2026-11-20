import { Pressable, Text } from "react-native";
import { buyerColors as c } from "../styles/buyerTheme";
export default function FilterChip({ label, selected, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={5}
      style={{
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 24,
        paddingHorizontal: 13,
        paddingVertical: 6,
        backgroundColor: selected ? c.text : c.background,
      }}
    >
      <Text style={{ color: selected ? c.background : c.text, fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );
}
