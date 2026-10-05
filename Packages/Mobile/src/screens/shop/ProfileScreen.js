/**
 * F13 Profile — orders, following, her city, what she shops for, settings, policies. No wallet.
 * Returns and addresses come with the checkout discussion (greyed). A guest sees sign-in first.
 * Contract: features/follower-app-v2 · board F13 · rules v1.7 §5.1, §5.3
 * Replaces the profile-only MeScreen (profile-only-apps, 10 Sep); Edit and Log out carry over.
 *
 * shopper-app-fixes:
 *   F13 Orders shows the server's line as sent ("2 on the way" / "3 orders" / "No orders yet").
 *       Returns reads "Return an item from My orders" and opens My orders (it read "Coming next").
 *       Following opens the list of creators she follows, for a guest too. "1 creator", not "1 creators".
 *   F4  A shopper who has given no name sees "Add your name", which opens Edit profile.
 *   F15 A signed-in shopper has "Notifications".
 */
import React, { useCallback, useContext, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { followerApi, clearSession } from '../../services/api';
import { AuthContext } from '../../../App';
import { CS } from '../../components/shop/copyShop';
import { TopBar, Avatar, PrimaryBtn, Loading, C } from '../../components/shop/bitsShop';
import { shopStore, isSignedIn } from '../../components/shop/shopStore';
import { engaged } from '../../components/shop/engaged';
import { refreshBagCount } from '../../components/shop/bag';
import { fonts, settingsTokens as T } from '../../theme/tokens';

function Row({ title, sub, onPress, dim, testID, right }) {
  return (
    <TouchableOpacity style={st.row} onPress={onPress} disabled={!onPress} testID={testID}>
      <View style={{ flex: 1 }}>
        <Text style={[st.rowTitle, dim && { color: T.disabledText }]}>{title}</Text>
        {sub ? <Text style={[st.rowSub, dim && { color: T.disabledText }]}>{sub}</Text> : null}
      </View>
      {right || (onPress ? <Text style={st.chev}>›</Text> : null)}
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ navigation }) {
  const { setRole } = useContext(AuthContext);
  const [me, setMe] = useState(null);
  const [guest, setGuest] = useState(null);
  const [local, setLocal] = useState(null);
  const [sound, setSound] = useState(false);

  const load = useCallback(async () => {
    const signed = await isSignedIn();
    setGuest(!signed);
    const st = await shopStore.get();
    setLocal(st);
    try { setSound((await AsyncStorage.getItem('inflx_video_sound')) === '1'); } catch { /* default off */ }
    if (signed) {
      const r = await followerApi.profile();
      if (r && r.success) setMe(r.data);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function logOut() {
    await clearSession();
    await refreshBagCount().catch(() => {});   // F9: the icon now counts this phone's bag, not her account's
    engaged.clear();          // what she liked and saved this session was hers, not the next person's
    setMe(null);
    setRole('');
    load();
  }

  async function toggleSound(v) {
    setSound(v);
    try { await AsyncStorage.setItem('inflx_video_sound', v ? '1' : '0'); } catch { /* keep in memory */ }
  }

  if (guest === null) return <SafeAreaView style={st.safe}><TopBar title={CS.profile} /><Loading /></SafeAreaView>;

  const cityName = me ? (me.city ? me.city.name : CS.notSet) : (local && local.cityName) || (local && local.useLocation ? CS.locationOn : CS.notSet);
  const shopFor = me ? me.rows.shop_for : (local && local.shopFor.length ? local.shopFor.map((k) => k[0].toUpperCase() + k.slice(1)).join(' · ') : CS.notSet);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={CS.profile} onSearch={() => navigation.navigate('Search')} />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 4, paddingBottom: 30 }}>
        {guest ? (
          <View style={st.guest} testID="profile-guest">
            <Text style={st.guestTitle}>{CS.guestTitle}</Text>
            <Text style={st.rowSub}>{CS.guestBody}</Text>
            <PrimaryBtn label={CS.signIn} onPress={() => navigation.navigate('FollowerLogin')} testID="profile-sign-in" />
          </View>
        ) : me ? (
          <View style={st.head} testID="profile-me">
            <Avatar name={me.name_needed ? '' : me.name} size={48} />
            <View style={{ flex: 1 }}>
              {me.name_needed ? (
                <Text style={[st.name, st.addName]} onPress={() => navigation.navigate('EditProfile')} testID="profile-add-name" accessibilityRole="button">{CS.addYourName}</Text>
              ) : <Text style={st.name}>{me.name}</Text>}
              {me.phone ? <Text style={st.rowSub}>{me.phone}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} testID="profile-edit"><Text style={st.edit}>{CS.edit}</Text></TouchableOpacity>
          </View>
        ) : <Loading />}
        {!guest && me ? <Row title={CS.orders} sub={me.rows.orders} onPress={() => navigation.navigate('Orders')} testID="row-orders" /> : null}
        <Row title={CS.followingRow} sub={me ? me.rows.following : CS.creatorsCount((local && local.follows.length) || 0)}
          onPress={() => navigation.navigate('ShopFollowing')} testID="row-following" />
        {!guest && me ? <Row title={CS.notificationsRow} onPress={() => navigation.navigate('ShopNotifications')} testID="row-notifications" /> : null}
        <Row title={CS.myCityRow} sub={cityName} onPress={() => navigation.navigate('Welcome', { fromProfile: true })} testID="row-city" />
        <Row title={CS.shopForRow} sub={shopFor} onPress={() => navigation.navigate('Welcome', { fromProfile: true })} testID="row-shop-for" />
        <Row title={CS.videoSound} sub={CS.videoSoundSub} right={<Switch value={sound} onValueChange={toggleSound} testID="video-sound" />} />
        <Row title={CS.policies} sub={CS.policiesSub} onPress={() => navigation.navigate('LegalList', { audience: 'shopper' })} testID="row-policies" />
        {!guest ? <Row title={CS.addressesRow} sub={CS.addressesRowSub} onPress={() => navigation.navigate('Addresses')} testID="row-addresses" /> : null}
        {/* Returns is live: an item is returned from its order, so the row opens My orders (hers once signed in). */}
        {!guest ? <Row title={CS.returnsRow} sub={CS.returnsRowSub} onPress={() => navigation.navigate('Orders')} testID="row-returns" /> : null}
        {!guest ? (
          <TouchableOpacity onPress={logOut} style={st.logout} testID="log-out"><Text style={st.logoutText}>{CS.logOut}</Text></TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  name: { fontFamily: fonts.sansBold, fontSize: 16, color: C.ink },
  addName: { textDecorationLine: 'underline' },
  edit: { fontFamily: fonts.sansBold, fontSize: 13, color: C.ink, textDecorationLine: 'underline' },
  guest: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.border, borderRadius: 14, padding: 14, gap: 8, marginBottom: 6 },
  guestTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: C.ink },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  rowTitle: { fontFamily: fonts.sansBold, fontSize: 13.5, color: C.ink },
  rowSub: { fontFamily: fonts.sansRegular, fontSize: 12, color: C.ink2, marginTop: 1 },
  chev: { fontSize: 18, color: C.ink3 },
  logout: { marginTop: 18, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#F2B8B8' },
  logoutText: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.danger },
});
