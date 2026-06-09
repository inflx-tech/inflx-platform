import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts } from '../theme/tokens';

/**
 * ErrorBoundary — catches render errors in a screen subtree so a single bad
 * screen degrades to a readable fallback instead of crashing the whole app.
 * The fallback shows the error message (so it can be screenshotted + fixed) and
 * a "Try again" reset. Wrap risky screens: <ErrorBoundary><Screen/></ErrorBoundary>.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', this.props.screen || '', error?.message, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      const msg = String(this.state.error?.message || this.state.error || 'Unknown error');
      return (
        <View style={st.wrap}>
          <Text style={st.emoji}>😕</Text>
          <Text style={st.title}>Couldn't load {this.props.screen || 'this screen'}</Text>
          <ScrollView style={st.msgBox} contentContainerStyle={{ padding: 12 }}>
            <Text style={st.msg}>{msg.slice(0, 500)}</Text>
          </ScrollView>
          <TouchableOpacity style={st.btn} onPress={() => this.setState({ error: null })}>
            <Text style={st.btnTxt}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.screenBg, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emoji: { fontSize: 44, marginBottom: 10 },
  title: { fontSize: 17, fontWeight: '800', color: C.ink, marginBottom: 10, fontFamily: fonts.displayBold },
  msgBox: { maxHeight: 180, alignSelf: 'stretch', backgroundColor: C.soft, borderWidth: 1, borderColor: C.line, borderRadius: 12 },
  msg: { fontSize: 11, color: C.muted, fontFamily: fonts.monoMedium },
  btn: { marginTop: 16, backgroundColor: C.brown, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  btnTxt: { fontSize: 13, fontWeight: '800', color: '#fff', fontFamily: fonts.sansBold },
});
