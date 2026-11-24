import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';
import BrowseScreen from '../screens/BrowseScreen';
import BookViewingScreen from '../screens/BookViewingScreen';
import BuyerOffersScreen from '../screens/BuyerOffersScreen';
import FavouritesScreen from '../screens/FavouritesScreen';
import FiltersScreen from '../screens/FiltersScreen';
import PropertyDetailsScreen from '../screens/PropertyDetailsScreen';
import PropertySubmissionScreen from '../screens/PropertySubmissionScreen';
import SendEnquiryScreen from '../screens/SendEnquiryScreen';
import { emptyFilters } from '../services/buyerFilters';
import { getFavourites, setFavourite } from '../services/favouriteService';
import { buyerStyles as s, buyerColors as c } from '../styles/buyerTheme';

export default function BuyerNavigator({ tab, onTab }) {
  const [page, setPage] = useState(null);
  const [propertyId, setPropertyId] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [search, setSearch] = useState('');
  const [quickType, setQuickType] = useState('all');
  const [enquiry, setEnquiry] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(new Set());
  const pending = useRef(new Set());
  const ids = new Set(rows?.map((row) => row.property_id));

  const loadFavourites = useCallback(async () => {
    try {
      setRows(await getFavourites());
      setError('');
    } catch (failure) {
      setError(failure.message || 'Unable to load favourites.');
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(loadFavourites, 0);
    return () => clearTimeout(first);
  }, [loadFavourites]);

  async function toggle(id) {
    if (!rows || pending.current.size) return;
    pending.current.add(id);
    setBusy(new Set(pending.current));
    try {
      await setFavourite(id, !ids.has(id));
      await loadFavourites();
    } catch (failure) {
      setError(failure.message || 'Unable to update favourites.');
    } finally {
      pending.current.delete(id);
      setBusy(new Set(pending.current));
    }
  }

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (enquiry) setEnquiry(null);
      else if (submission) return true;
      else if (page) setPage(null);
      else if (tab !== 'Browse') onTab('Browse');
      else return false;
      return true;
    });
    return () => listener.remove();
  }, [enquiry, submission, page, tab, onTab]);

  function open(id) {
    setPropertyId(id);
    setPage('details');
  }

  return (
    <View style={s.page}>
      {!!error && (
        <View style={[s.row, { paddingHorizontal: 32, paddingTop: 12 }]}>
          <Text accessibilityRole="alert" style={[s.error, { flex: 1 }]}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={loadFavourites}><Text style={s.text}>Retry</Text></Pressable>
        </View>
      )}
      <View style={[s.page, (page || tab !== 'Browse') && { display: 'none' }]}>
        <BrowseScreen filters={filters} search={search} onSearch={setSearch} quickType={quickType}
          onQuickType={setQuickType} onFilters={() => setPage('filters')} onOpen={open}
          onFavourite={toggle} favouriteIds={ids} favouriteBusy={busy} favouritesReady={!!rows && !busy.size} />
      </View>
      {!page && tab === 'Favourites' && (
        <FavouritesScreen rows={rows} loading={!rows && !error} onOpen={open} onRemove={toggle} busy={busy} />
      )}
      {!page && tab === 'Offers' && <BuyerOffersScreen submitted={submitted} />}
      {page === 'filters' && (
        <FiltersScreen filters={filters} onClose={() => setPage(null)}
          onApply={(value, { resetAll }) => {
            setFilters(value);
            if (resetAll) { setQuickType('all'); setSearch(''); }
            setPage(null);
          }} />
      )}
      {page === 'details' && (
        <PropertyDetailsScreen propertyId={propertyId} onBack={() => setPage(null)}
          onAction={setSubmission} onEnquiry={setEnquiry} onViewing={setViewing} onFavourite={toggle}
          saved={ids.has(propertyId)} favouriteDisabled={!rows || !!busy.size} />
      )}
      {submission && (
        <PropertySubmissionScreen property={submission} onBack={() => setSubmission(null)}
          onSubmitted={(kind) => { setSubmitted(kind); setSubmission(null); setPage(null); onTab('Offers'); }} />
      )}
      {viewing && (
        <BookViewingScreen property={viewing} onBack={() => setViewing(null)}
          onBooked={() => { setSubmitted('viewing'); setViewing(null); setPage(null); onTab('Offers'); }} />
      )}
      {!page && (
        <View style={{ marginHorizontal: 32, paddingVertical: 16, borderTopWidth: 1, borderColor: '#ddd',
          flexDirection: 'row', justifyContent: 'space-between' }}>
          {['Browse', 'Favourites', 'Offers', 'Profile'].map((label) => (
            <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: tab === label }}
              onPress={() => {
                onTab(label);
                setSubmitted(null);
                if (label === 'Favourites' && !pending.current.size) loadFavourites();
              }}>
              <Text style={{ color: c.text, fontSize: 12, fontWeight: tab === label ? '700' : '400' }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {enquiry && <SendEnquiryScreen property={enquiry} onBack={() => setEnquiry(null)} />}
    </View>
  );
}
