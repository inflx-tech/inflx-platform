/**
 * BrandBlockedCreatorsScreen — B7. Contract: features/item2-pitch-invitation-settings
 * Rows: avatar · name · "Blocked {date}" · Unblock (immediate, toast "{Name} unblocked.").
 * Blocked creators are never told; they simply see this brand as paused.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { EmptyState } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { COPY, shortDate } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';

const C = COPY.brand;

export default function BrandBlockedCreatorsScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [rows, setRows] = useState([]);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await brandApi.listBlockedCreators();
    if (!r.success) { setStatus('error'); return; }
    setRows(r.data.blocked || []);
    setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  async function unblock(row) {
    const r = await brandApi.unblockCreator(row.influencerId);
    if (!r.success) { show(COPY.saveFailed); return; }
    setRows(prev => prev.filter(x => x.influencerId !== row.influencerId));
    show(C.unblocked(row.name || 'Creator'));
  }

  return (
    <View style={base.screen}>
      <Header title={C.blockedTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton rows={4} /> : status === 'error' ? <LoadError onRetry={load} /> : (
        <FlatList
          data={rows}
          keyExtractor={r => r.influencerId}
          contentContainerStyle={{ padding: 18 }}
          ListHeaderComponent={<Text style={base.hint}>{C.blockedHint}</Text>}
          ListEmptyComponent={<EmptyState title={C.blockedEmptyTitle} body={C.blockedEmptyBody} />}
          ListFooterComponent={rows.length ? <Text style={[base.hint, { marginTop: 14 }]}>{C.blockedFooter}</Text> : null}
          renderItem={({ item }) => (
            <View style={bl.row} testID={`blocked-${item.influencerId}`}>
              <Avatar name={item.name} url={item.avatarUrl} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={bl.name}>{item.name || item.instagramHandle || 'Creator'}</Text>
                <Text style={bl.sub}>{C.blockedOn(shortDate(item.blockedAt))}</Text>
              </View>
              <TouchableOpacity style={bl.unblock} onPress={() => unblock(item)} accessibilityRole="button" testID={`unblock-${item.influencerId}`}>
                <Text style={bl.unblockText}>{C.unblock}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
      {toast}
    </View>
  );
}

export function Avatar({ name, url, size = 40 }) {
  const initials = String(name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={[bl.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[bl.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

export const bl = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  avatar: { backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border },
  avatarText: { fontFamily: fonts.sansBold, color: T.ink },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 14.5, color: T.ink },
  sub: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 2 },
  unblock: { borderWidth: 1, borderColor: T.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  unblockText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink },
});
