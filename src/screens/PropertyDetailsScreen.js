import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { getBuyerProperty } from "../services/propertyService";
import { formatPrice } from "../services/buyerFilters";
import { FavouriteButton, PropertyImage } from "../components/PropertyCard";
import { buyerStyles as s, buyerColors as c } from "../styles/buyerTheme";
export default function PropertyDetailsScreen({
  propertyId,
  onBack,
  onAction,
  onEnquiry,
  onFavourite,
  saved,
  favouriteDisabled,
}) {
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      setProperty(null);
      getBuyerProperty(propertyId)
        .then((data) => {
          if (alive) setProperty(data);
        })
        .catch(() => {
          if (alive)
            setError("Unable to load this property. Please try again.");
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [propertyId, retry]);
  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to property list"
          onPress={onBack}
        >
          <Text style={s.heading}>← Details</Text>
        </Pressable>
        {property && (
          <FavouriteButton
            saved={saved}
            disabled={favouriteDisabled}
            onPress={() => onFavourite(property.id)}
          />
        )}
      </View>
      {loading ? (
        <ActivityIndicator
          color={c.red}
          accessibilityLabel="Loading property"
        />
      ) : error ? (
        <>
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={s.button}
            onPress={() => setRetry((x) => x + 1)}
          >
            <Text style={s.text}>Retry</Text>
          </Pressable>
        </>
      ) : !property ? (
        <Text style={s.text}>This property is no longer available.</Text>
      ) : (
        <>
          <PropertyImage
            key={property.id + property.image_url}
            property={property}
            height={190}
          />
          <Text style={[s.heading, { fontSize: 23 }]}>{property.title}</Text>
          <Text style={s.text}>
            {formatPrice(property)} ·{" "}
            {property.listing_type === "sale" ? "Sale" : "Rent"} ·{" "}
            {property.property_type}
          </Text>
          <Text style={s.text}>{property.location}</Text>
          <View style={s.badge}>
            <Text style={s.label}>Active</Text>
          </View>
          <View
            style={[
              s.input,
              { height: undefined, minHeight: 80, paddingVertical: 14 },
            ]}
          >
            <Text style={s.text}>
              {property.description || "No description available."}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            style={[s.button, s.primary]}
            onPress={() =>
              onAction(property)
            }
          >
            <Text style={s.primaryText}>
              {property.listing_type === "sale"
                ? "Make offer"
                : "Apply to rent"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.button}
            onPress={() => onEnquiry(property)}
          >
            <Text style={s.text}>Send enquiry</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
