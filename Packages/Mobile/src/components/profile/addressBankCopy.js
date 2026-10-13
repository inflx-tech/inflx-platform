/**
 * creator-address-bank-save — every word on the creator's Delivery address screen, on the two
 * new lines of the Remote address form, and on her bank account form.
 * Contract: features/creator-address-bank-save · board P1–P3, R3, W1
 *
 * The address field labels and the red lines under them are item 11's own (copy11) — the two
 * forms ask the same things in the same words, because one fills the other.
 */

export const ADDR = {
  row: 'Delivery address',
  rowAsk: 'Where brands send products for a Remote collab',
  rowSaved: (a) => [a.cityName, a.pincode].filter(Boolean).join(' · '),
  title: 'Delivery address',
  lead: 'Brands send products here when you do a Remote collab. We fill it in for you each time — you can still change it for one parcel.',
  onlyYou: 'Only you see this. A brand gets an address only when you send it for a collab.',
  phoneHint: 'The courier calls this number. It starts as your login number.',
  cityHint: 'Starts as the city on your profile. Change it if parcels should go somewhere else.',
  save: 'Save',
  saved: 'Saved.',
  remove: 'Remove this address',
  removeTitle: 'Remove your delivery address?',
  removeBody: "You'll type it again the next time a brand sends you products. Addresses you have already sent stay as they are.",
  removeConfirm: 'Remove',
  removeCancel: 'Keep it',
  removed: 'Address removed.',
  // On the Remote address form (item 11's R3).
  fromProfile: 'Filled in from your profile. Change anything for this parcel — your profile stays as it is.',
  keep: 'Keep this address in my profile for next time',
};

export const BANK = {
  lead: 'INFLX pays your withdrawals into this account. The name must be exactly as it is on the account.',
  fields: [
    { key: 'bank_holder_name', label: 'Account holder name', placeholder: 'Name as on the bank account', autoCapitalize: 'words', maxLength: 80 },
    { key: 'bank_account_no', label: 'Account number', placeholder: 'Account number', keyboardType: 'number-pad', hidden: true, maxLength: 24 },
    { key: 'bank_account_no_confirm', label: 'Re-enter account number', placeholder: 'Type it again', keyboardType: 'number-pad', noPaste: true, maxLength: 24 },
    { key: 'bank_ifsc', label: 'IFSC', placeholder: 'e.g. SBIN0001234', autoCapitalize: 'characters', maxLength: 12 },
    { key: 'bank_name', label: 'Bank name', placeholder: 'e.g. State Bank of India', autoCapitalize: 'words', maxLength: 80 },
    { key: 'bank_branch', label: 'Branch', placeholder: 'e.g. Brodipet, Guntur', autoCapitalize: 'words', maxLength: 80 },
  ],
  // The red line under each box when it is left empty — the server's own words.
  required: {
    bank_holder_name: "Enter the account holder's name.",
    bank_account_no: 'Enter the account number.',
    bank_account_no_confirm: 'Enter the account number again.',
    bank_ifsc: 'Enter the IFSC.',
    bank_name: 'Enter the bank name.',
    bank_branch: 'Enter the branch.',
  },
  mismatch: "The two account numbers don't match.",
  rowSub: 'Name, account number, IFSC, bank and branch',
};
