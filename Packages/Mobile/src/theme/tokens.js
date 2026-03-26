export const colors = {
  navy: '#1B2D5E',
  navyDeep: '#111E42',
  navyMid: '#243672',
  navyPale: '#EEF1FB',
  orange: '#F47920',
  orangeDeep: '#D4601A',
  orangePale: '#FEF0E4',
  gold: '#FFB800',
  goldPale: '#FFF8E1',
  teal: '#00B894',
  tealDeep: '#007A63',
  tealPale: '#E0FAF5',
  red: '#E8401A',
  redPale: '#FDEEE9',
  purple: '#7F77DD',
  purplePale: '#EEEDFE',
  bg: '#F4F6FB',
  surface: '#FFFFFF',
  surface2: '#F2F4F9',
  border: '#E0E4EF',
  border2: '#C8CEDF',
  t1: '#0D1630',
  t2: '#4A5278',
  t3: '#8B91AD',
  white: '#FFFFFF',
  black: '#000000',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 9999 };

export function fmtMoney(paise) {
  const rupees = (paise || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(rupees);
}

export function fmtNum(n) {
  return new Intl.NumberFormat('en-IN').format(n || 0);
}
