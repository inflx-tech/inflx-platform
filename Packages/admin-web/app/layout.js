import './globals.css';

export const metadata = {
  title: 'INFLX Admin',
  description: 'INFLX Admin Dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
