import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';

// ============================================================================
// 1. BRAND THEME & REMOTE SUPABASE CONFIG
// ============================================================================
const colors = {
  primary: '#B6311E',       // Exact Figma Terracotta Red from authTheme.js
  primaryHover: '#982414',
  primaryLight: '#FBEFEA',
  background: '#F6F5F0',    // Exact Figma Ivory Background
  cardBg: '#FFFFFF',
  surfaceAlt: '#EEF2F0',
  textPrimary: '#2A2424',   // Exact Figma Dark Text
  secondary: '#5D7068',
  border: '#E5DFD9',
  accentGreen: '#2E7D32',
  accentOrange: '#E65100',
  accentBlue: '#1565C0',
  accentPurple: '#6A1B9A',
  danger: '#B6311E',
};

// Exact Vector Logo from Figma Wireframes (traced in HolmiaLogo.js)
function HolmiaLogo() {
  const stroke = { borderWidth: 4.5, borderColor: colors.primary, backgroundColor: colors.background };
  return (
    <View style={logoStyles.container}>
      <View style={logoStyles.mark}>
        <View style={[stroke, logoStyles.outer]} />
        <View style={[stroke, logoStyles.inner]} />
        <View style={[stroke, logoStyles.leftCircle]} />
        <View style={[stroke, logoStyles.rightCircle]} />
      </View>
      <Text style={logoStyles.word}>HOLMIA</Text>
    </View>
  );
}

const logoStyles = StyleSheet.create({
  container: { width: 140, height: 130, alignSelf: 'center', alignItems: 'center', marginBottom: 6 },
  mark: { width: 100, height: 90 },
  outer: { position: 'absolute', left: 16, top: 0, width: 74, height: 86, borderTopLeftRadius: 42, borderTopRightRadius: 42 },
  inner: { position: 'absolute', left: 31, top: 15, width: 44, height: 60, borderTopLeftRadius: 27, borderTopRightRadius: 27 },
  leftCircle: { position: 'absolute', left: 3, top: 15, width: 44, height: 44, borderRadius: 22 },
  rightCircle: { position: 'absolute', left: 48, top: 38, width: 44, height: 44, borderRadius: 22 },
  word: { color: colors.primary, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -1, marginTop: 4 },
});

const SUPABASE_URL = 'https://icfqjwfmcwlejqpezhyi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_UfdcgZ0_jAf90ZHCP54vBQ_DNUKzpjF';

// 6 Curated, Highly Coherent UK Properties
const INITIAL_PROPERTIES = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    title: 'Bright 2-Bed Apartment in Westminster',
    description: 'Stunning modern two-bedroom apartment featuring high ceilings, open-plan reception room, private south-facing balcony, and concierge service. Just 3 minutes from St James Park station.',
    price: 650000,
    listing_type: 'sale',
    property_type: 'Flat',
    location: 'London, Westminster (SW1)',
    status: 'active',
    seller_name: 'Sarah Jenkins',
    agent_name: 'Timothy Agent',
    bedrooms: 2,
    bathrooms: 2,
    sqft: 820,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    title: 'Spacious 4-Bed Detached House with Garden',
    description: 'Superb family residence situated in a quiet tree-lined avenue. Includes four double bedrooms, expansive landscaped rear garden, double garage, and state-of-the-art kitchen-diner.',
    price: 495000,
    listing_type: 'sale',
    property_type: 'House',
    location: 'Manchester, Didsbury (M20)',
    status: 'active',
    seller_name: 'Sarah Jenkins',
    agent_name: 'Timothy Agent',
    bedrooms: 4,
    bathrooms: 3,
    sqft: 1850,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    title: 'Furnished Modern Studio near Universities',
    description: 'Fully furnished studio apartment ideal for students or working professionals. High-speed broadband included, fully fitted kitchenette, power shower room, and secure bicycle storage.',
    price: 850,
    listing_type: 'rent',
    property_type: 'Studio',
    location: 'Oxford, City Centre (OX1)',
    status: 'active',
    seller_name: 'David Wilson',
    agent_name: 'Timothy Agent',
    bedrooms: 1,
    bathrooms: 1,
    sqft: 340,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000004',
    title: 'Luxury Harbourside 2-Bed Flat with Terrace',
    description: 'Contemporary waterfront apartment offering panoramic views over the Floating Harbour. Large private terrace, floor-to-ceiling windows, and dedicated secure underground parking space.',
    price: 1450,
    listing_type: 'rent',
    property_type: 'Flat',
    location: 'Bristol, Harbourside (BS1)',
    status: 'under_offer',
    seller_name: 'David Wilson',
    agent_name: 'Timothy Agent',
    bedrooms: 2,
    bathrooms: 2,
    sqft: 790,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000005',
    title: 'Industrial Converted Loft in Jewellery Quarter',
    description: 'Authentic warehouse loft conversion with original exposed brick walls, steel beams, and polished concrete flooring. Features generous open-plan living and mezzanine bedroom suite.',
    price: 325000,
    listing_type: 'sale',
    property_type: 'Loft',
    location: 'Birmingham, Jewellery Quarter (B1)',
    status: 'draft',
    seller_name: 'Oliver Clarke',
    agent_name: 'Timothy Agent',
    bedrooms: 1,
    bathrooms: 1,
    sqft: 950,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000006',
    title: 'Charming 3-Bed Victorian House with Driveway',
    description: 'Delightful Victorian home located in desirable Newnham. Retains period fireplaces, private lawn garden, spacious kitchen breakfast room, and driveway parking for two vehicles.',
    price: 1800,
    listing_type: 'rent',
    property_type: 'House',
    location: 'Cambridge, Newnham (CB3)',
    status: 'rented',
    seller_name: 'Oliver Clarke',
    agent_name: 'Timothy Agent',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1250,
  },
];

const statusMeta = {
  draft:       { label: 'Draft',       color: '#757575', bg: '#EEEEEE', icon: '📝' },
  active:      { label: 'Active',      color: colors.accentGreen, bg: '#E8F5E9', icon: '✅' },
  under_offer: { label: 'Under Offer', color: colors.accentOrange, bg: '#FFF3E0', icon: '🤝' },
  sold:        { label: 'Sold',        color: colors.accentBlue, bg: '#E3F2FD', icon: '🏷️' },
  rented:      { label: 'Rented',      color: colors.accentPurple, bg: '#F3E5F5', icon: '🔑' },
};

// ============================================================================
// 2. SCREEN COMPONENTS
// ============================================================================

// --- SCREEN 1: AUTHENTICATION / LOGIN ---
function LoginScreen({ session, onLogin, onLogout }) {
  const [username, setUsername] = useState(session?.username || 'demo_agent');
  const [password, setPassword] = useState('Password123!');
  const [role, setRole] = useState(session?.role || 'agent');
  const [message, setMessage] = useState('');

  const accounts = [
    { role: 'buyer', label: 'Buyer', user: 'demo_buyer', desc: 'Browse, favourites & make offers' },
    { role: 'seller', label: 'Seller', user: 'demo_seller', desc: 'Create & manage own property ads' },
    { role: 'agent', label: 'Agent', user: 'demo_agent', desc: 'Moderate, review portfolio & lifecycle' },
  ];

  const handlePickAccount = (acc) => {
    setRole(acc.role);
    setUsername(acc.user);
    setMessage('');
  };

  const handleSignIn = () => {
    if (!username.trim()) {
      setMessage('Please enter a valid username or email.');
      return;
    }
    const newSession = {
      username: username.trim(),
      role: role,
      loginTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessage(`Signed in successfully as [${role.toUpperCase()}]!`);
    if (onLogin) onLogin(newSession);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <HolmiaLogo />
      <Text style={styles.wireframeTitle}>City Estate</Text>
      <Text style={styles.wireframeSubtitle}>buyers &amp; sellers</Text>

      {session ? (
        <View style={styles.sessionBox}>
          <Text style={styles.sessionTitle}>Active Session</Text>
          <Text style={styles.sessionDetail}>User: <Text style={styles.bold}>{session.username}</Text></Text>
          <Text style={styles.sessionDetail}>Role: <Text style={[styles.bold, { color: colors.primary }]}>{session.role.toUpperCase()}</Text></Text>
          <Text style={styles.sessionDetail}>Signed In: {session.loginTime}</Text>
          <Pressable style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.labelBold}>Select Test Account:</Text>
      <View style={styles.rolePickerGrid}>
        {accounts.map((acc) => {
          const active = role === acc.role;
          return (
            <Pressable
              key={acc.role}
              style={[styles.roleCard, active && styles.roleCardActive]}
              onPress={() => handlePickAccount(acc)}
            >
              <Text style={[styles.roleCardTitle, active && styles.roleCardTitleActive]}>
                {acc.label}
              </Text>
              <Text style={[styles.roleCardDesc, active && styles.roleCardDescActive]}>
                {acc.desc}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>Username or Email</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      {message ? (
        <Text style={[styles.feedbackMsg, message.startsWith('Please') ? styles.errorMsg : styles.successMsg]}>
          {message}
        </Text>
      ) : null}

      <Pressable style={styles.primaryButton} onPress={handleSignIn}>
        <Text style={styles.primaryButtonText}>Sign In to HOLMIA</Text>
      </Pressable>
    </ScrollView>
  );
}

// --- SCREEN 2: WELCOME SCREEN ---
function WelcomeScreen() {
  return (
    <View style={styles.welcomeContainer}>
      <View style={styles.accentBar} />
      <Text style={styles.brand}>HOLMIA</Text>
      <Text style={styles.welcomeHeading}>Welcome to HOLMIA</Text>
      <Text style={styles.welcomeSubtitle}>The UK Real Estate Marketplace</Text>
      <Text style={styles.welcomeBody}>
        Connecting Buyers, Sellers, and Real Estate Agents through verified listings, fair price negotiations, and end-to-end transaction lifecycle tracking.
      </Text>

      <View style={styles.featureBox}>
        <Text style={styles.featureTitle}>Key Platform Capabilities</Text>
        <Text style={styles.featureItem}>• <Text style={styles.bold}>Buyer:</Text> Explore active properties, save favourites, submit purchase offers.</Text>
        <Text style={styles.featureItem}>• <Text style={styles.bold}>Seller:</Text> Publish sale/rental adverts, manage price, review incoming offers.</Text>
        <Text style={styles.featureItem}>• <Text style={styles.bold}>Agent:</Text> Moderate drafts, oversee assigned portfolio, verify legal status.</Text>
      </View>
    </View>
  );
}

// --- SCREEN 3: PUBLIC DIRECTORY (Connected to Supabase) ---
function CatalogScreen({ onSelectProperty }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // all | sale | rent
  const [dataSource, setDataSource] = useState('Connecting to Supabase...');

  const loadProperties = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/properties?select=id,title,description,price,listing_type,property_type,location,status&status=eq.active&order=created_at.desc`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setItems(data);
          setDataSource('Connected to Supabase (Cloud Database)');
          setLoading(false);
          return;
        }
      }
      throw new Error('Using fallback');
    } catch {
      setItems(INITIAL_PROPERTIES.filter((p) => p.status === 'active'));
      setDataSource('Local UK Property Dataset');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const filtered = items.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.location.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || p.listing_type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.brand}>HOLMIA</Text>
      <Text style={styles.heading}>Property Directory</Text>
      <Text style={styles.subheading}>{dataSource}</Text>

      {/* Search Input */}
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Search by city (e.g. London, Oxford)..."
          value={search}
          onChangeText={setSearch}
        />
        <Pressable style={styles.refreshBtn} onPress={loadProperties}>
          <Text style={styles.refreshBtnText}>🔄</Text>
        </Pressable>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterPills}>
        {['all', 'sale', 'rent'].map((t) => (
          <Pressable
            key={t}
            style={[styles.pill, filterType === t && styles.pillActive]}
            onPress={() => setFilterType(t)}
          >
            <Text style={[styles.pillText, filterType === t && styles.pillTextActive]}>
              {t === 'all' ? 'All Listings' : t === 'sale' ? 'For Sale' : 'To Rent'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
          <Text style={styles.emptyTitle}>No listings found</Text>
          <Text style={styles.emptySubtitle}>Try adjusting your search criteria</Text>
        </View>
      ) : (
        filtered.map((item) => (
          <Pressable
            key={item.id}
            style={styles.propertyCard}
            onPress={() => onSelectProperty && onSelectProperty(item)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.listingTypeTag}>
                {item.listing_type === 'rent' ? 'TO RENT' : 'FOR SALE'}
              </Text>
              <Text style={styles.activeTag}>● Active</Text>
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDescription} numberOfLines={2}>
              {item.description}
            </Text>

            <Text style={styles.cardPrice}>
              {item.listing_type === 'rent'
                ? `£${Number(item.price).toLocaleString()} / month`
                : `£${Number(item.price).toLocaleString()}`}
            </Text>

            <View style={styles.cardMetaRow}>
              <Text style={styles.cardMeta}>📍 {item.location}</Text>
              <Text style={styles.cardMeta}>🏠 {item.property_type}</Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

// --- SCREEN 4: AGENT PORTFOLIO (Week 3 Deliverable) ---
function AgentPortfolioScreen({ session, properties }) {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? properties : properties.filter((p) => p.status === filter);

  const counts = properties.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.brand}>HOLMIA</Text>
      <Text style={styles.heading}>Agent Portfolio</Text>
      <Text style={styles.subheading}>
        Assigned Properties · Agent: <Text style={styles.bold}>{session?.username || 'demo_agent'}</Text>
      </Text>

      {/* KPI Stats Grid */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{properties.length}</Text>
          <Text style={styles.kpiLabel}>Total</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: colors.accentGreen }]}>{counts.active || 0}</Text>
          <Text style={styles.kpiLabel}>Active</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: colors.accentOrange }]}>{counts.under_offer || 0}</Text>
          <Text style={styles.kpiLabel}>Under Offer</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#757575' }]}>{counts.draft || 0}</Text>
          <Text style={styles.kpiLabel}>Drafts</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
            { id: 'draft', label: 'Drafts' },
            { id: 'under_offer', label: 'Under Offer' },
            { id: 'sold', label: 'Sold' },
            { id: 'rented', label: 'Rented' },
          ].map((tab) => (
            <Pressable
              key={tab.id}
              style={[styles.smallPill, filter === tab.id && styles.smallPillActive]}
              onPress={() => setFilter(tab.id)}
            >
              <Text style={[styles.smallPillText, filter === tab.id && styles.smallPillTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {filtered.map((item) => {
        const st = statusMeta[item.status] || statusMeta.active;
        return (
          <View key={item.id} style={styles.propertyCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                <Text style={{ color: st.color, fontWeight: '700', fontSize: 12 }}>
                  {st.icon} {st.label}
                </Text>
              </View>
              <Text style={styles.listingTypeTag}>
                {item.listing_type === 'rent' ? 'RENT' : 'SALE'}
              </Text>
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>

            <Text style={styles.cardPrice}>
              {item.listing_type === 'rent'
                ? `£${Number(item.price).toLocaleString()} / month`
                : `£${Number(item.price).toLocaleString()}`}
            </Text>

            <View style={styles.sellerRow}>
              <Text style={styles.cardMeta}>📍 {item.location}</Text>
              <Text style={styles.cardMeta}>👤 Seller: {item.seller_name || 'Sarah Jenkins'}</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

// --- SCREEN 5: AGENT MODERATION (Week 3 Deliverable) ---
function AgentModerationScreen({ properties, onUpdateProperty }) {
  const [selected, setSelected] = useState(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [notice, setNotice] = useState('');

  const handleEdit = (p) => {
    setSelected(p);
    setTitle(p.title);
    setPrice(String(p.price));
    setLocation(p.location);
    setNotice('');
  };

  const handleSave = () => {
    if (!title.trim() || title.trim().length < 3) {
      setNotice('Error: Title must contain at least 3 characters.');
      return;
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setNotice('Error: Price must be a positive number.');
      return;
    }

    const updated = {
      ...selected,
      title: title.trim(),
      price: numPrice,
      location: location.trim(),
    };
    onUpdateProperty(updated);
    setSelected(updated);
    setNotice('✅ Listing modifications saved successfully!');
  };

  const handleActivate = (p) => {
    const activated = { ...p, status: 'active' };
    onUpdateProperty(activated);
    if (selected && selected.id === p.id) setSelected(activated);
    setNotice(`✅ "${p.title}" successfully approved and set to Active!`);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.brand}>HOLMIA</Text>
      <Text style={styles.heading}>Listing Moderation</Text>
      <Text style={styles.subheading}>Review, Edit & Publish Assigned Adverts · Agent</Text>

      {selected ? (
        <View style={styles.editCard}>
          <Pressable onPress={() => { setSelected(null); setNotice(''); }} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back to moderation list</Text>
          </Pressable>

          <Text style={styles.cardTitle}>Edit Property Details</Text>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Price (£)</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Location</Text>
            <TextInput style={styles.input} value={location} onChangeText={setLocation} />
          </View>

          {notice ? (
            <Text style={[styles.feedbackMsg, notice.startsWith('Error') ? styles.errorMsg : styles.successMsg]}>
              {notice}
            </Text>
          ) : null}

          <View style={styles.actionBtnRow}>
            <Pressable style={[styles.primaryButton, { flex: 1 }]} onPress={handleSave}>
              <Text style={styles.primaryButtonText}>💾 Save Changes</Text>
            </Pressable>

            {selected.status === 'draft' ? (
              <Pressable
                style={[styles.primaryButton, { flex: 1, backgroundColor: colors.accentGreen }]}
                onPress={() => handleActivate(selected)}
              >
                <Text style={styles.primaryButtonText}>✅ Publish (Active)</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        properties.map((p) => {
          const st = statusMeta[p.status] || statusMeta.active;
          const isDraft = p.status === 'draft';
          return (
            <View key={p.id} style={styles.propertyCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                  <Text style={{ color: st.color, fontWeight: '700', fontSize: 12 }}>
                    {st.icon} {st.label}
                  </Text>
                </View>
                <Text style={styles.cardPriceSmall}>
                  £{Number(p.price).toLocaleString()}
                </Text>
              </View>

              <Text style={styles.cardTitle}>{p.title}</Text>
              <Text style={styles.cardMeta}>📍 {p.location}</Text>

              <View style={styles.moderationActions}>
                <Pressable style={styles.btnSecondary} onPress={() => handleEdit(p)}>
                  <Text style={styles.btnSecondaryText}>✏️ Review & Edit</Text>
                </Pressable>

                {isDraft ? (
                  <Pressable style={styles.btnSuccess} onPress={() => handleActivate(p)}>
                    <Text style={styles.btnSuccessText}>✅ Approve</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

// --- SCREEN 6: PROPERTY LIFECYCLE & TIMELINE (Week 3 Deliverable) ---
function PropertyLifecycleScreen() {
  const transitions = [
    { from: 'Draft',       to: 'Active',      trigger: 'Agent verification & approval' },
    { from: 'Active',      to: 'Under Offer', trigger: 'Seller or Agent accepts purchase offer' },
    { from: 'Under Offer', to: 'Active',      trigger: 'Buyer withdrew offer or sale fell through' },
    { from: 'Under Offer', to: 'Sold',        trigger: 'Legal conveyancing completed (TERMINAL)' },
    { from: 'Under Offer', to: 'Rented',      trigger: 'Tenancy agreement signed (TERMINAL)' },
  ];

  const auditEvents = [
    { date: '10 Nov 2026, 10:00', title: 'Listing Created', actor: 'Sarah Jenkins (Seller)', state: 'Draft', color: '#757575' },
    { date: '11 Nov 2026, 14:30', title: 'Ad Approved & Published', actor: 'Timothy Agent (Agent)', state: 'Active', color: colors.accentGreen },
    { date: '16 Nov 2026, 09:15', title: 'Offer Accepted (£640,000)', actor: 'System Automation', state: 'Under Offer', color: colors.accentOrange },
  ];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.brand}>HOLMIA</Text>
      <Text style={styles.heading}>Property Lifecycle</Text>
      <Text style={styles.subheading}>State Machine, Transitions & Audit History</Text>

      {/* Allowed Transitions Diagram */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}>Allowed State Machine Transitions</Text>
        {transitions.map((t, idx) => (
          <View key={idx} style={styles.transitionRow}>
            <Text style={styles.badgeState}>{t.from}</Text>
            <Text style={styles.arrowIcon}>→</Text>
            <Text style={[styles.badgeState, { backgroundColor: '#E8F5E9', color: colors.accentGreen }]}>
              {t.to}
            </Text>
            <Text style={styles.transitionTrigger}>{t.trigger}</Text>
          </View>
        ))}
      </View>

      {/* Audit History Timeline */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}>Live Property Audit Trail (status_history)</Text>
        {auditEvents.map((evt, idx) => (
          <View key={idx} style={styles.timelineItem}>
            <View style={[styles.timelineDot, { backgroundColor: evt.color }]} />
            <View style={styles.timelineContent}>
              <View style={styles.timelineHeader}>
                <Text style={styles.timelineEventTitle}>{evt.title}</Text>
                <Text style={styles.timelineDate}>{evt.date}</Text>
              </View>
              <Text style={styles.timelineActor}>Changed by: {evt.actor}</Text>
              <Text style={[styles.timelineStateTag, { color: evt.color }]}>Status: {evt.state}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Integrity Rules */}
      <View style={[styles.card, { backgroundColor: '#FFF8E1', borderColor: '#FFE082' }]}>
        <Text style={[styles.sectionHeader, { color: colors.accentOrange }]}>
          ⚠️ Strict Business Rules Enforcement
        </Text>
        <Text style={styles.ruleNotice}>
          • <Text style={styles.bold}>Sold & Rented</Text> are irreversible terminal states (cannot revert to Active).
        </Text>
        <Text style={styles.ruleNotice}>
          • <Text style={styles.bold}>Price & Listing Type</Text> are strictly locked once reaching Under Offer.
        </Text>
        <Text style={styles.ruleNotice}>
          • Accepting one offer automatically sets all concurrent competing offers to <Text style={styles.bold}>Rejected</Text>.
        </Text>
      </View>
    </ScrollView>
  );
}

// ============================================================================
// 3. MAIN APP ORCHESTRATION & NAVIGATION
// ============================================================================
export default function App() {
  const [tab, setTab] = useState('catalog');
  const [properties, setProperties] = useState(INITIAL_PROPERTIES);
  const [session, setSession] = useState({
    username: 'demo_agent',
    role: 'agent',
    loginTime: '10:30',
  });

  const handleUpdateProperty = (updated) => {
    setProperties((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  };

  const navTabs = [
    { id: 'catalog', label: 'Directory', icon: '📋' },
    { id: 'portfolio', label: 'Portfolio', icon: '🏢' },
    { id: 'moderation', label: 'Moderate', icon: '✏️' },
    { id: 'lifecycle', label: 'Lifecycle', icon: '🔄' },
    { id: 'welcome', label: 'About', icon: '🏠' },
    { id: 'login', label: 'Account', icon: '👤' },
  ];

  const renderActiveScreen = () => {
    switch (tab) {
      case 'catalog':
        return <CatalogScreen />;
      case 'portfolio':
        return <AgentPortfolioScreen session={session} properties={properties} />;
      case 'moderation':
        return <AgentModerationScreen properties={properties} onUpdateProperty={handleUpdateProperty} />;
      case 'lifecycle':
        return <PropertyLifecycleScreen />;
      case 'welcome':
        return <WelcomeScreen />;
      case 'login':
        return <LoginScreen session={session} onLogin={setSession} onLogout={() => setSession(null)} />;
      default:
        return <CatalogScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.mainView}>{renderActiveScreen()}</View>

      {/* Navigation Bar */}
      <View style={styles.navBar}>
        {navTabs.map((item) => {
          const isActive = tab === item.id;
          return (
            <Pressable
              key={item.id}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => setTab(item.id)}
            >
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// 4. CLEAN, PROFESSIONAL STYLESHEET
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mainView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 36,
    paddingBottom: 40,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  brand: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 3,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 4,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 13,
    color: colors.secondary,
    marginBottom: 16,
  },
  bold: {
    fontWeight: '700',
  },
  wireframeTitle: {
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    marginTop: 8,
  },
  wireframeSubtitle: {
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  propertyCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.secondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  cardPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 6,
  },
  cardPriceSmall: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardMeta: {
    fontSize: 12,
    color: colors.secondary,
  },
  listingTypeTag: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.secondary,
    backgroundColor: '#EEF2F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeTag: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentGreen,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  refreshBtn: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshBtnText: {
    fontSize: 18,
  },
  filterPills: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  smallPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  smallPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondary,
  },
  smallPillTextActive: {
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.secondary,
    marginTop: 4,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  kpiLabel: {
    fontSize: 11,
    color: colors.secondary,
    marginTop: 2,
    fontWeight: '600',
  },
  sellerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  moderationActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#EEF2F0',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  btnSuccess: {
    flex: 1,
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSuccessText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accentGreen,
  },
  editCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 10,
  },
  transitionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  badgeState: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#EEEEEE',
    fontWeight: '700',
    fontSize: 11,
    color: '#444',
  },
  arrowIcon: {
    fontSize: 13,
    color: colors.secondary,
  },
  transitionTrigger: {
    fontSize: 11,
    color: colors.secondary,
    flex: 1,
    marginLeft: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: 10,
  },
  timelineContent: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  timelineEventTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  timelineDate: {
    fontSize: 11,
    color: '#888',
  },
  timelineActor: {
    fontSize: 12,
    color: colors.secondary,
  },
  timelineStateTag: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  ruleNotice: {
    fontSize: 12,
    color: '#5D4037',
    marginBottom: 4,
    lineHeight: 18,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  accentBar: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginBottom: 16,
  },
  welcomeHeading: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.secondary,
    marginBottom: 14,
  },
  welcomeBody: {
    fontSize: 14,
    color: colors.secondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  featureBox: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  featureItem: {
    fontSize: 12,
    color: colors.secondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  sessionBox: {
    backgroundColor: '#FBEFEA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5DFD9',
  },
  sessionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  sessionDetail: {
    fontSize: 12,
    color: colors.primary,
    marginBottom: 2,
  },
  logoutBtn: {
    marginTop: 8,
    backgroundColor: colors.danger,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  labelBold: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  rolePickerGrid: {
    gap: 6,
    marginBottom: 14,
  },
  roleCard: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
  },
  roleCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  roleCardTitleActive: {
    color: '#FFFFFF',
  },
  roleCardDesc: {
    fontSize: 11,
    color: colors.secondary,
    marginTop: 2,
  },
  roleCardDescActive: {
    color: '#DCE4E0',
  },
  formGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  feedbackMsg: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 8,
  },
  successMsg: {
    color: colors.accentGreen,
  },
  errorMsg: {
    color: colors.danger,
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 22 : 10,
    justifyContent: 'space-around',
  },
  navItem: {
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: '#FBEFEA',
  },
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 10,
    color: colors.secondary,
    fontWeight: '600',
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
});
