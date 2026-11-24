import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import PropertyCard from "../components/PropertyCard";
import FilterChip from "../components/FilterChip";
import { getBuyerProperties } from "../services/propertyService";
import { buyerStyles as s, buyerColors as c } from "../styles/buyerTheme";
export default function BrowseScreen({
  filters,
  search,
  onSearch,
  quickType,
  onQuickType,
  onFilters,
  onOpen,
  onFavourite,
  favouriteIds,
  favouriteBusy,
  favouritesReady,
  isActive = true,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const signature = JSON.stringify({ filters, search, quickType });
  const [pagination, setPagination] = useState({ signature, page: 0 });
  const page = pagination.signature === signature ? pagination.page : 0;
  const [more, setMore] = useState(false);
  const [reload, setReload] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    const id = ++request.current;
    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      if (!page) {
        setRows([]);
        setMore(false);
      }
      try {
        const data = await getBuyerProperties({
          filters,
          search,
          quickType,
          page,
        });
        if (alive && id === request.current) {
          setRows((old) => (page ? [...old, ...data] : data));
          setMore(data.length === 20);
        }
      } catch {
        if (alive) {
          if (!page) setRows([]);
          setError(
            "Unable to load properties. Check your connection and try again.",
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [filters, search, quickType, page, reload]);

  // Silent background sync on page 0 so listings that move to Under Offer / Sold
  // disappear automatically from the Buyer catalogue without interrupting scroll.
  useEffect(() => {
    if (page !== 0 || !isActive) return;
    let alive = true;
    const interval = setInterval(async () => {
      try {
        const data = await getBuyerProperties({ filters, search, quickType, page: 0 });
        if (alive && Array.isArray(data)) {
          setRows(data);
          setMore(data.length === 20);
        }
      } catch {
        // Silent background refresh
      }
    }, 5000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [filters, search, quickType, page, isActive]);
  return (
    <View style={s.page}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[s.content, { gap: 0 }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={s.heading}>Browse</Text>
              <Pressable accessibilityRole="button" onPress={onFilters}>
                <Text style={{ fontSize: 20, color: c.text }}>Filters</Text>
              </Pressable>
            </View>
            <TextInput
              accessibilityLabel="Search properties"
              placeholder="Search..."
              placeholderTextColor={c.text}
              value={search}
              onChangeText={onSearch}
              style={s.input}
            />
            <View style={s.row}>
              {["all", "sale", "rent"].map((type) => (
                <FilterChip
                  key={type}
                  label={type[0].toUpperCase() + type.slice(1)}
                  selected={quickType === type}
                  onPress={() => onQuickType(type)}
                />
              ))}
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <PropertyCard
            property={item}
            onOpen={onOpen}
            onFavourite={onFavourite}
            saved={favouriteIds.has(item.id)}
            favouriteDisabled={!favouritesReady || favouriteBusy.has(item.id)}
          />
        )}
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={s.text}>No properties match your criteria.</Text>
          ) : null
        }
        ListFooterComponent={
          <View style={{ gap: 12 }}>
            {loading && (
              <ActivityIndicator
                accessibilityLabel="Loading properties"
                color={c.red}
              />
            )}
            {!!error && (
              <>
                <Text accessibilityRole="alert" style={s.error}>
                  {error}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={s.button}
                  onPress={() => setReload((x) => x + 1)}
                >
                  <Text style={s.text}>Retry</Text>
                </Pressable>
              </>
            )}
            {more && !loading && !error && (
              <Pressable
                accessibilityRole="button"
                style={s.button}
                onPress={() => setPagination({ signature, page: page + 1 })}
              >
                <Text style={s.text}>Load more</Text>
              </Pressable>
            )}
          </View>
        }
      />
    </View>
  );
}
