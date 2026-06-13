import './globals.css';

export const metadata = {
  title: 'WAKE',
  description: 'To see, you must move. To move is to be seen.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head suppressHydrationWarning>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%2302040a'/%3E%3Ccircle cx='16' cy='16' r='6' fill='%2334efd0'/%3E%3C/svg%3E" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
