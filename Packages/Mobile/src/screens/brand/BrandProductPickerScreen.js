import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ig } from '../../theme/ig';
import { ProductPicker } from '../../components/brand/ProductPicker';

/**
 * BrandProductPickerScreen — the route wrapper around the shared picker.
 * Contract: features/collab-terms-by-aim (item 8), merged by
 *           features/stage-2-build-a-campaign-from-the-phone (slice 1)
 *
 * The founder, originally: "also what they should promote, here you need to add products
 * also, we have now only entire store, category, apart from this add individual product
 * also as an option."
 *
 * WHY THIS MATTERS BEYOND CONVENIENCE:
 * "Their whole store" and "a category" both keep absorbing new arrivals — a saree added
 * next month is inside the deal without anybody agreeing to it. A hand-picked list never
 * does. That difference was invisible while the only options were the two broad ones.
 *
 * WHAT STAGE 2 CHANGED HERE:
 * The list, the search and the selection all moved into components/brand/ProductPicker,
 * which is now the single implementation shared with the offer builders and the campaign
 * wizard's allocation step. This file is only a route — it keeps the screen name and the
 * exact callback contract the request composer already relies on, `onDone(ids, names)`.
 * Changing a caller's contract while merging is how a merge becomes a regression.
 *
 * The names travel with the ids on purpose. A handshake is a record of what was agreed on
 * the day: if a product is renamed or removed later, the agreement should still say what
 * was offered rather than showing a creator "3 specific products" and nothing else.
 */
export default function BrandProductPickerScreen({ route, navigation }) {
  const { selected = [], onDone } = route.params || {};

  return (
    <View style={s.container}>
      <ProductPicker
        multi
        selected={selected}
        title="Pick products"
        onCancel={() => navigation.goBack()}
        onDone={(rows) => {
          if (typeof onDone === 'function') {
            onDone(rows.map((r) => r.id), rows.map((r) => r.name));
          }
          navigation.goBack();
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
});
