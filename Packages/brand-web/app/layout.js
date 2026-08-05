import './globals.css';

// `/` is a public marketing page, not a dashboard shell, so the root metadata
// has to read as one. The old title ("INFLX Brand") was what search engines
// and link previews showed for the whole public site.
export const metadata = {
  metadataBase: new URL('https://inflx.in'),
  title: {
    default: 'INFLX — Where local brands and creators grow together',
    template: '%s',
  },
  description:
    'INFLX connects local brands, creators and shoppers across India. Brands run campaigns, creators promote deals to the people who trust them, and every rupee of commission is tracked automatically.',
  applicationName: 'INFLX',
  alternates: { canonical: 'https://inflx.in' },
  openGraph: {
    title: 'INFLX — Where local brands and creators grow together',
    description:
      'Brands run campaigns. Creators promote deals to the people who actually trust them. Shoppers discover, book and pay.',
    url: 'https://inflx.in',
    siteName: 'INFLX',
    locale: 'en_IN',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
