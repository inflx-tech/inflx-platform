/**
 * Profile › Notifications — the latest fifty things INFLX told her, newest first.
 * Contract: features/shopper-app-fixes · F15 · decisions X4 (a plain list), X5 (where a tap leads)
 *
 * Each row: its title, its words, when. One she has not read is bold. Tapping one about an order
 * opens that order's details; one about a placed order opens My orders; any other has nowhere
 * further to go — this list is where it leads. Opening the list reads them all: the ones that were
 * unread stay bold for this visit, so she can see which are new.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import { CS, whenLabel } from '../../components/shop/copyShop';
import { TopBar, Loading, Empty, C } from '../../components/shop/bitsShop';
import { notificationTarget, NOTIFICATIONS_ROUTE } from '../../components/shop/notifications';
import { fonts } from '../../theme/tokens';

export default function NotificationsScreen({ navigation }) {
  const [list, setList] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const res = await followerApi.notifications();
    if (!res || !res.success) { setFailed(true); return; }
    setList(res.data.notifications || []);
    // The list has been opened: they are read from now on. Nothing waits on this.
    Promise.resolve(followerApi.markNotificationsRead()).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  function open(n) {
    const [name, params] = notificationTarget(n.data_json);
    if (name !== NOTIFICATIONS_ROUTE) navigation.navigate(name, params);
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={CS.notificationsRow} onBack={() => navigation.goBack()} />
      {failed && !list ? (
        <Empty title={CS.loadError} action={CS.retry} onAction={load} testID="notifications-error" />
      ) : !list ? <Loading /> : (
        <FlatList
          data={list}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24 }}
          ListEmptyComponent={<Empty title={CS.noNotifications} testID="notifications-empty" />}
          renderItem={({ item: n }) => {
            const leads = notificationTarget(n.data_json)[0] !== NOTIFICATIONS_ROUTE;
            return (
              <TouchableOpacity style={st.row} onPress={() => open(n)} disabled={!leads} testID={`notification-${n.id}`}
                accessibilityRole={leads ? 'button' : 'text'} accessibilityState={{ disabled: !leads }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[st.title, !n.is_read && st.unread]} testID={`notification-title-${n.id}`}>{n.title}</Text>
                  {n.body ? <Text style={[st.body, !n.is_read && st.unreadBody]}>{n.body}</Text> : null}
                  <Text style={st.when}>{whenLabel(n.created_at)}</Text>
                </View>
                {leads ? <Text style={st.chev}>›</Text> : null}
              </TouchableOpacity>
            );
          }}
          testID="notifications-list"
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: C.ink },
  body: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: C.ink2 },
  unread: { fontFamily: fonts.sansBold },
  unreadBody: { fontFamily: fonts.sansSemiBold, color: C.ink },
  when: { fontFamily: fonts.sansRegular, fontSize: 11, color: C.ink3 },
  chev: { fontSize: 18, color: C.ink3 },
});
