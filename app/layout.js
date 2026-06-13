import './globals.css';

export const metadata = {
  title: 'WAKE',
  description: 'To see, you must move. To move is to be seen.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>{children}</body>
    </html>
  );
}
