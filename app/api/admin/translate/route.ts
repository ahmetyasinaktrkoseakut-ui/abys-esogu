import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function translateText(text: string, targetLang: string) {
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=tr&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
    const data = await res.json();
    return data[0][0][0];
  } catch (error) {
    console.error(`Çeviri hatası (${targetLang}):`, error);
    return null;
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: any = { ana_basliklar: [], alt_olcutler: [] };

  // 1. Ana Başlıklar
  const { data: anaBasliklar } = await supabase.from('ana_basliklar').select('*');
  if (anaBasliklar) {
    for (const row of anaBasliklar) {
      if (!row.baslik_adi) continue;
      
      let needsUpdate = false;
      const updates: any = {};

      if (!row.baslik_adi_en) {
        const enTrans = await translateText(row.baslik_adi, 'en');
        if (enTrans) { updates.baslik_adi_en = enTrans; needsUpdate = true; }
      }

      if (!row.baslik_adi_ar) {
        const arTrans = await translateText(row.baslik_adi, 'ar');
        if (arTrans) { updates.baslik_adi_ar = arTrans; needsUpdate = true; }
      }

      if (needsUpdate) {
        await supabase.from('ana_basliklar').update(updates).eq('id', row.id);
        results.ana_basliklar.push({ id: row.id, updates });
      }
    }
  }

  // 2. Alt Ölçütler
  const { data: altOlcutler } = await supabase.from('alt_olcutler').select('*');
  if (altOlcutler) {
    for (const row of altOlcutler) {
      if (!row.olcut_adi) continue;
      
      let needsUpdate = false;
      const updates: any = {};

      if (!row.olcut_adi_en) {
        const enTrans = await translateText(row.olcut_adi, 'en');
        if (enTrans) { updates.olcut_adi_en = enTrans; needsUpdate = true; }
      }

      if (!row.olcut_adi_ar) {
        const arTrans = await translateText(row.olcut_adi, 'ar');
        if (arTrans) { updates.olcut_adi_ar = arTrans; needsUpdate = true; }
      }

      if (needsUpdate) {
        await supabase.from('alt_olcutler').update(updates).eq('id', row.id);
        results.alt_olcutler.push({ id: row.id, updates });
      }
    }
  }

  return NextResponse.json({
    message: 'Veritabanı çevirileri başarıyla tamamlandı.',
    updated_records: results
  });
}
