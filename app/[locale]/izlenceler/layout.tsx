import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function IzlencelerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={messages}>
      <div className="bg-white min-h-screen text-slate-900 font-sans">
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
