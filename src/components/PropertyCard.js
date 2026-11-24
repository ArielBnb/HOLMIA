import propertyIllustration from "../../assets/propertyIllustration";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { buyerStyles as s, buyerColors as c } from "../styles/buyerTheme";
import { formatPrice } from "../services/buyerFilters";
export function PropertyImage({ property, height }) {
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={{
        height,
        borderRadius: 6,
        backgroundColor: c.image,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {!failed ? (
        <Image
          accessibilityLabel={
            property.image_url
              ? `Photo of ${property.title}`
              : "Illustrative property photo"
          }
          source={
            property.image_url
              ? { uri: property.image_url }
              : { uri: propertyIllustration }
          }
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      ) : (
        <Text style={s.label}>No photo available</Text>
      )}
      {!property.image_url && !failed && (
        <Text
          style={{
            position: "absolute",
            bottom: 4,
            right: 6,
            backgroundColor: c.background,
            paddingHorizontal: 4,
            fontSize: 10,
          }}
        >
          Illustrative photo
        </Text>
      )}
    </View>
  );
}
export function FavouriteButton({ onPress, saved = false, disabled = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? "Remove from favourites" : "Add to favourites"}
      disabled={disabled}
      accessibilityState={{ disabled, selected: saved }}
      onPress={onPress}
      hitSlop={10}
    >
      <Text style={{ fontSize: 23, color: saved ? c.red : c.text }}>{saved ? "♥" : "♡"}</Text>
    </Pressable>
  );
}
export default function PropertyCard({ property, onOpen, onFavourite, saved, favouriteDisabled }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 8,
        padding: 10,
        gap: 6,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${property.title}`}
        onPress={() => onOpen(property.id)}
        style={{ gap: 6 }}
      >
        <PropertyImage
          key={property.id + property.image_url}
          property={property}
          height={110}
        />
        <Text style={[s.text, { fontWeight: "700", paddingRight: 28 }]}>
          {property.title}
        </Text>
        <Text style={[s.label, { fontSize: 13 }]}>
          {formatPrice(property)} · {property.location}
        </Text>
        <View style={s.badge}>
          <Text style={{ color: c.text, fontSize: 12 }}>
            Active · {property.listing_type === "rent" ? "Rent" : "Sale"}
          </Text>
        </View>
      </Pressable>
      <View style={{ position: "absolute", right: 12, top: 123 }}>
        <FavouriteButton saved={saved} disabled={favouriteDisabled} onPress={() => onFavourite(property.id)} />
      </View>
    </View>
  );
}
