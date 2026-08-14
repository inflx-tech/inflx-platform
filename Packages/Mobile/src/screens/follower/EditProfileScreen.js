/**
 * EditProfileScreen — Profile → Edit (Slice 1).
 * Contract: features/follower-profile-repairs/
 * Mockup: 04-preview/mockups/profile-repairs-comprehensive.html, frame 4.
 *
 * THE FAULT THIS FIXES: Profile's Edit button raised "Coming with the account
 * settings slice", and PATCH /followers/me did not exist server-side either —
 * followers were the only role without it. A follower who mistyped their name
 * at signup was stuck with it permanently.
 *
 * Name and email only. Phone is the login identity, so it is shown read-only
 * with the reason stated plainly rather than silently disabled.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { followerApi } from '../../services/api';
import ErrorBoundary from '../../components/ErrorBoundary';

function prettyPhone(p) {
  const s = String(p || '');
  const m = s.match(/^(\+91)?(\d{5})(\d{5})$/);
  return m ? `+91 ${m[2]} ${m[3]}` : s;
}

function EditProfileInner({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  // Field-scoped errors — the mockup puts the message under the field it
  // belongs to, never in a toast that leaves you guessing which one failed.
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let alive = true;
    followerApi.getMe().then((res) => {
      if (!alive) return;
      const d = res?.data || res || {};
      const f = d.follower || d;
      setName(f.name || '');
      setEmail(f.email || '');
      setPhone(f.phone || '');
      setLoading(false);
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function save() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setErrors({ name: 'Please enter your name (at least 2 characters)' });
      return;
    }
    setErrors({});
    setSaving(true);
    const res = await followerApi.updateMe({ name: trimmed, email: email.trim() });
    setSaving(false);

    if (res?.success) { navigation.goBack(); return; }

    // The server names the offending field (e.g. a duplicate email); show its
    // message where it belongs instead of a generic failure.
    const err = res?.error || {};
    if (err.field) setErrors({ [err.field]: err.message || 'Please check this field' });
    else setErrors({ form: err.message || 'Could not save your changes. Please try again.' });
  }

  if (loading) return <View style={st.center}><ActivityIndicator color="#111" /></View>;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.nav}>
        <TouchableOpacity hitSlop={10} onPress={() => navigation.goBack()}>
          <Icon name="chevron-left" size={26} color="#111" />
        </TouchableOpacity>
        <Text style={st.title}>Edit profile</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={st.field}>
            <Text style={st.lab}>Name</Text>
            <TextInput
              style={[st.input, errors.name && st.inputErr]}
              value={name}
              onChangeText={(t) => { setName(t); if (errors.name) setErrors({}); }}
              placeholder="Your name"
              placeholderTextColor="#B5B5B5"
              autoCapitalize="words"
              returnKeyType="next"
            />
            {!!errors.name && <Text style={st.err}>{errors.name}</Text>}
          </View>

          <View style={st.field}>
            <Text style={st.lab}>Email</Text>
            <TextInput
              style={[st.input, errors.email && st.inputErr]}
              value={email}
              onChangeText={(t) => { setEmail(t); if (errors.email) setErrors({}); }}
              placeholder="you@example.com"
              placeholderTextColor="#B5B5B5"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="done"
            />
            {!!errors.email && <Text style={st.err}>{errors.email}</Text>}
          </View>

          <View style={st.field}>
            <Text style={st.lab}>Phone</Text>
            <View style={[st.input, st.inputRo]}><Text style={st.roTxt}>{prettyPhone(phone)}</Text></View>
            <Text style={st.hint}>Your phone is how you sign in, so it can’t be changed here.</Text>
          </View>

          {!!errors.form && <Text style={[st.err, { marginTop: 14 }]}>{errors.form}</Text>}

          <TouchableOpacity style={[st.cta, saving && { opacity: 0.6 }]} activeOpacity={0.85} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={st.ctaTxt}>Save changes</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={st.ghost} onPress={() => navigation.goBack()} disabled={saving}>
            <Text style={st.ghostTxt}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function EditProfileScreen(props) {
  return <ErrorBoundary><EditProfileInner {...props} /></ErrorBoundary>;
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 },
  title: { fontSize: 17, fontWeight: '800', color: '#111' },

  field: { marginTop: 14 },
  lab: { fontSize: 10.5, fontWeight: '800', color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#EEE', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, fontSize: 13, fontWeight: '600', color: '#111' },
  inputErr: { borderColor: '#D64545' },
  inputRo: { backgroundColor: '#FAFAFA', justifyContent: 'center' },
  roTxt: { fontSize: 13, fontWeight: '600', color: '#8A8A8A' },
  err: { fontSize: 10.5, color: '#D64545', marginTop: 6, fontWeight: '700' },
  hint: { fontSize: 10.5, color: '#9A9A9A', marginTop: 6, lineHeight: 15 },

  cta: { marginTop: 20, backgroundColor: '#111', borderRadius: 999, alignItems: 'center', paddingVertical: 13 },
  ctaTxt: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  ghost: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  ghostTxt: { fontSize: 12.5, fontWeight: '800', color: '#8A8A8A' },
});
