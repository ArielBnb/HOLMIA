import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import FilterChip from "../components/FilterChip";
import { emptyFilters, validateFilters } from "../services/buyerFilters";
import { buyerStyles as s, buyerColors as c } from "../styles/buyerTheme";
export default function FiltersScreen({ filters, onApply, onClose }) {
  const [resetAll, setResetAll] = useState(false);
  const [draft, setDraft] = useState(() => ({ ...filters }));
  const [error, setError] = useState("");
  const change = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setError("");
  };
  const toggle = (key, value) =>
    change(
      key,
      draft[key].includes(value)
        ? draft[key].filter((x) => x !== value)
        : [...draft[key], value],
    );
  return (
    <KeyboardAvoidingView
      style={s.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.content, { flexGrow: 1 }]}
      >
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Text style={s.heading}>Filters</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close filters"
            hitSlop={12}
            onPress={onClose}
          >
            <Text style={{ fontSize: 25, color: c.text }}>×</Text>
          </Pressable>
        </View>
        <Text style={s.label}>Price range</Text>
        <View style={s.row}>
          {[
            ["minPrice", "Min £"],
            ["maxPrice", "Max £"],
          ].map(([key, label]) => (
            <TextInput
              key={key}
              accessibilityLabel={label}
              placeholder={label}
              placeholderTextColor={c.text}
              keyboardType="decimal-pad"
              value={draft[key]}
              onChangeText={(value) => change(key, value)}
              style={[s.input, { flex: 1 }]}
            />
          ))}
        </View>
        <Text style={s.label}>Location</Text>
        <TextInput
          accessibilityLabel="Location"
          placeholder="Any location"
          placeholderTextColor={c.text}
          value={draft.location}
          onChangeText={(value) => change("location", value)}
          style={s.input}
        />
        <Text style={s.label}>Property type</Text>
        <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
          {["house", "flat", "studio", "other"].map((type) => (
            <FilterChip
              key={type}
              label={type[0].toUpperCase() + type.slice(1)}
              selected={draft.propertyTypes.includes(type)}
              onPress={() => toggle("propertyTypes", type)}
            />
          ))}
        </View>
        <Text style={s.label}>Listing type</Text>
        <View style={s.row}>
          {["sale", "rent"].map((type) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                selected: draft.listingTypes.includes(type),
              }}
              key={type}
              style={[
                s.button,
                { flex: 1 },
                draft.listingTypes.includes(type) && {
                  backgroundColor: c.text,
                },
              ]}
              onPress={() => toggle("listingTypes", type)}
            >
              <Text
                style={[
                  s.text,
                  draft.listingTypes.includes(type) && { color: "#fff" },
                ]}
              >
                {type === "sale" ? "Sale" : "Rent"}
              </Text>
            </Pressable>
          ))}
        </View>
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
        <View style={{ flex: 1, minHeight: 30 }} />
        <View style={s.row}>
          <Pressable
            accessibilityRole="button"
            style={[s.button, { flex: 1 }]}
            onPress={() => {
              setDraft(emptyFilters());
              setResetAll(true);
              setError("");
            }}
          >
            <Text style={s.text}>Reset</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[s.button, s.primary, { flex: 1 }]}
            onPress={() => {
              const message = validateFilters(draft);
              if (message) setError(message);
              else onApply(draft, { resetAll });
            }}
          >
            <Text style={s.primaryText}>Apply</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
