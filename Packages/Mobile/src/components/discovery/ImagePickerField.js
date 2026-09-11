/**
 * ImagePickerField — brand logo (A2) and creator photo (A8): JPG or PNG, up to 5 MB.
 * The app refuses a bigger or different file before uploading; the server re-checks what
 * landed when the key is saved (founder Q16). Uses react-native-image-picker, already in
 * the binary, and the presigned-PUT helper the creator photo flow uses.
 * Contract: features/item3-discovery-profiles-groups
 *
 * onUploaded({ key, assetId? }) — the caller saves it through its own endpoint.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Avatar } from '../../screens/brand/BrandBlockedCreatorsScreen';
import { FieldError } from '../settings/primitives';
import { MSG3 } from './copy3';

export const MAX_BYTES = 5 * 1024 * 1024;
export function acceptable(asset) {
  const type = String(asset?.type || '').toLowerCase();
  const name = String(asset?.fileName || '').toLowerCase();
  const typeOk = /^image\/(jpe?g|png)$/.test(type) || /\.(jpe?g|png)$/.test(name);
  const sizeOk = asset?.fileSize == null || Number(asset.fileSize) <= MAX_BYTES;
  return typeOk && sizeOk;
}

export default function ImagePickerField({ label, hint, name, url, onPick, onRemove, busy, error, changeLabel = 'Change', removeLabel = 'Remove', testID }) {
  const [localErr, setLocalErr] = useState('');
  async function choose() {
    setLocalErr('');
    const r = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.9, maxWidth: 1600, maxHeight: 1600 });
    if (r.didCancel) return;
    const asset = r.assets?.[0];
    if (!asset?.uri) return;
    if (!acceptable(asset)) { setLocalErr(MSG3.IMAGE); return; }
    try { await onPick(asset); } catch (e) { setLocalErr(e?.message || MSG3.IMAGE); }
  }
  return (
    <View style={s.wrap} testID={testID}>
      <Avatar name={name} url={url} size={64} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.hint}>{hint}</Text>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <TouchableOpacity style={s.btn} onPress={choose} disabled={busy} testID={`${testID}-change`}>
            {busy ? <ActivityIndicator size="small" color={T.ink} /> : <Text style={s.btnText}>{changeLabel}</Text>}
          </TouchableOpacity>
          {onRemove && url ? (
            <TouchableOpacity style={[s.btn, { marginLeft: 8 }]} onPress={onRemove} disabled={busy} testID={`${testID}-remove`}>
              <Text style={s.btnText}>{removeLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <FieldError text={localErr || error} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 2 },
  btn: { borderWidth: 1, borderColor: T.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  btnText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink },
});
