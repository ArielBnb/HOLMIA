import { useEffect, useState } from "react";
import { BackHandler, Modal, Pressable, Text, View } from "react-native";
import BrowseScreen from "../screens/BrowseScreen";
import FiltersScreen from "../screens/FiltersScreen";
import PropertyDetailsScreen from "../screens/PropertyDetailsScreen";
import { emptyFilters } from "../services/buyerFilters";
import { buyerStyles as s, buyerColors as c } from "../styles/buyerTheme";
// Future Buyer features receive their real property UUID; no simulated writes.
export default function BuyerNavigator({ onProfile, onNavigate }) {
  const [screen, setScreen] = useState("browse");
  const [propertyId, setPropertyId] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [search, setSearch] = useState("");
  const [quickType, setQuickType] = useState("all");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (screen !== "browse") {
          setScreen("browse");
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [screen]);
  function action(destination, id) {
    if (onNavigate) onNavigate(destination, { propertyId: id });
    else
      setNotice(
        "This feature is not available yet. Nothing has been saved or sent.",
      );
  }
  return (
    <View style={s.page}>
      <View style={[s.page, screen !== "browse" && { display: "none" }]}>
        <BrowseScreen
          filters={filters}
          search={search}
          onSearch={setSearch}
          quickType={quickType}
          onQuickType={setQuickType}
          onFilters={() => setScreen("filters")}
          onOpen={(id) => {
            setPropertyId(id);
            setScreen("details");
          }}
          onFavourite={(id) => action("favourites", id)}
        />
      </View>
      {screen === "filters" && (
        <FiltersScreen
          filters={filters}
          onClose={() => setScreen("browse")}
          onApply={(value, { resetAll }) => {
            setFilters(value);
            if (resetAll) {
              setQuickType("all");
              setSearch("");
            }
            setScreen("browse");
          }}
        />
      )}
      {screen === "details" && (
        <PropertyDetailsScreen
          propertyId={propertyId}
          onBack={() => setScreen("browse")}
          onAction={action}
        />
      )}
      {screen === "browse" && (
        <View
          style={{
            marginHorizontal: 32,
            paddingVertical: 16,
            borderTopWidth: 1,
            borderColor: "#ddd",
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          {["Browse", "Favourites", "Offers", "Profile"].map((label) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              onPress={() =>
                label === "Browse"
                  ? setScreen("browse")
                  : label === "Profile"
                    ? onProfile?.()
                    : action(label.toLowerCase())
              }
            >
              <Text
                style={{
                  color: c.text,
                  fontSize: 12,
                  fontWeight: label === "Browse" ? "700" : "400",
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Modal
        visible={!!notice}
        transparent
        animationType="fade"
        onRequestClose={() => setNotice("")}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#0006",
            justifyContent: "center",
            padding: 32,
          }}
        >
          <View
            style={{
              backgroundColor: c.background,
              borderRadius: 8,
              padding: 24,
              gap: 20,
            }}
          >
            <Text style={s.text}>{notice}</Text>
            <Pressable
              accessibilityRole="button"
              style={s.button}
              onPress={() => setNotice("")}
            >
              <Text style={s.text}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
