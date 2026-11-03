import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import JSZip from 'jszip';
import {
  UniPukoDriveManager,
  PukoStageKey,
  detectStageFromUrl,
  parseStorageUrl,
  normalizeStorageKey,
} from '@/lib/uni-puko/drive-service';
import { generateCriterionDocxBuffer, CriterionFormInput, ResolvedEvidenceItem } from '@/lib/uni-puko/docx-generator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function formatTrDate(isoOrDate?: string | null): string {
  if (!isoOrDate) {
    return new Date().toLocaleDateString('tr-TR');
  }
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) {
    return new Date().toLocaleDateString('tr-TR');
  }
  return d.toLocaleDateString('tr-TR');
}

export async function GET(request: NextRequest) {
  return handleExport(request);
}

export async function POST(request: NextRequest) {
  return handleExport(request);
}

async function handleExport(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    // 1. Sunucu Tarafı Oturum ve Yönetici Rol Kontrolü
    const {
      data: { user },
      error: authErr,
    } = await supabaseAuth.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Oturum açmanız gerekmektedir.' }, { status: 401 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiller')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) {
      throw new Error(`Kullanıcı rolü doğrulanamadı: ${profileErr.message}`);
    }

    const role = profile?.rol?.toLowerCase() || '';
    const isAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');

    if (!isAdmin) {
      return NextResponse.json({ error: 'Bu işlem yalnızca sistem yöneticileri tarafından yapılabilir.' }, { status: 403 });
    }

    // 2. Aktif Dönemi Bul
    const { data: activePeriod, error: periodErr } = await supabaseAdmin
      .from('donemler')
      .select('id, donem_adi, is_active')
      .eq('is_active', true)
      .maybeSingle();

    if (periodErr) {
      throw new Error(`Aktif dönem sorgulanamadı: ${periodErr.message}`);
    }

    if (!activePeriod) {
      return NextResponse.json({ error: 'Sistemde aktif dönem bulunamadı.' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const altOlcutIdParam = searchParams.get('alt_olcut_id');
    const isAll = searchParams.get('all') === 'true';

    if (!altOlcutIdParam && !isAll) {
      return NextResponse.json({ error: 'alt_olcut_id veya all=true parametresi gereklidir.' }, { status: 400 });
    }

    // 3. Onaylanmış ÖDR Kayıtlarını Çek (onay_durumu = 'onaylandi')
    let odrQuery = supabaseAdmin
      .from('ozdegerlendirme_raporlari')
      .select('id, alt_olcut_id, donem_id, icerik, kanitlar, olusturulma_tarihi, onay_durumu, birim_anket_degerlendirmesi')
      .eq('donem_id', activePeriod.id)
      .eq('onay_durumu', 'onaylandi');

    if (altOlcutIdParam && !isAll) {
      odrQuery = odrQuery.eq('alt_olcut_id', String(altOlcutIdParam));
    }

    const { data: approvedOdrs, error: odrErr } = await odrQuery;
    if (odrErr) {
      throw new Error(`Özdeğerlendirme raporları çekilemedi: ${odrErr.message}`);
    }

    if (!approvedOdrs || approvedOdrs.length === 0) {
      return NextResponse.json(
        { error: 'Seçilen kriter(ler) için aktif dönemde onaylanmış Özdeğerlendirme Raporu bulunamadı.' },
        { status: 404 }
      );
    }

    const targetAltOlcutIds = approvedOdrs.map(o => Number(o.alt_olcut_id));

    // 4. İlgili Alt Ölçüt, PUKÖ (durum = 'Onaylandı'), Eylem Planı ve Atama Verilerini Çek
    const [
      { data: altOlcutler, error: altOlcutErr },
      { data: pukoRecords, error: pukoErr },
      { data: eylemPlanlari, error: eylemErr },
      { data: atamalar, error: atamaErr },
      { data: profiller, error: profillerErr },
    ] = await Promise.all([
      supabaseAdmin
        .from('alt_olcutler')
        .select('id, kod, olcut_adi, kalite_el_kitabi')
        .in('id', targetAltOlcutIds),
      supabaseAdmin
        .from('puko_degerlendirmeleri')
        .select('id, alt_olcut_id, puko_asamasi, durum, olgunluk_puani, aciklama, kanit_dosyalari, olusturulma_tarihi, user_id')
        .eq('donem_id', activePeriod.id)
        .eq('durum', 'Onaylandı')
        .in('alt_olcut_id', targetAltOlcutIds)
        .in('puko_asamasi', [
          'planlama',
          'uygulama',
          'kontrol',
          'onlem',
          'olgunluk',
          'Planlama',
          'Uygulama',
          'Kontrol',
          'Onlem',
          'Olgunluk',
        ]),
      supabaseAdmin
        .from('eylem_planlari')
        .select('alt_olcut_id, iyilestirme_alani, eylem_faaliyet')
        .eq('donem_id', activePeriod.id)
        .in('alt_olcut_id', targetAltOlcutIds),
      supabaseAdmin
        .from('kullanici_olcut_atamalari')
        .select('alt_olcut_id, user_id')
        .eq('donem_id', activePeriod.id)
        .in('alt_olcut_id', targetAltOlcutIds),
      supabaseAdmin.from('profiller').select('id, ad_soyad'),
    ]);

    if (altOlcutErr) {
      throw new Error(`Alt ölçüt bilgileri çekilemedi: ${altOlcutErr.message}`);
    }
    if (pukoErr) {
      throw new Error(`PUKÖ aşama değerlendirmeleri çekilemedi: ${pukoErr.message}`);
    }
    if (eylemErr) {
      throw new Error(`Eylem planı bilgileri çekilemedi: ${eylemErr.message}`);
    }
    if (atamaErr) {
      throw new Error(`Ölçüt sorumlu atamaları çekilemedi: ${atamaErr.message}`);
    }
    if (profillerErr) {
      throw new Error(`Sorumlu profil bilgileri çekilemedi: ${profillerErr.message}`);
    }

    const profilMap = new Map<string, string>();
    (profiller || []).forEach(p => {
      if (p.id && p.ad_soyad) profilMap.set(p.id, p.ad_soyad.trim());
    });

    const altOlcutMap = new Map<number, any>();
    (altOlcutler || []).forEach(a => altOlcutMap.set(Number(a.id), a));

    const driveManager = new UniPukoDriveManager(supabaseAdmin);

    const buildFormForOdr = async (odr: any): Promise<{ fileName: string; buffer: Buffer }> => {
      const altId = Number(odr.alt_olcut_id);
      const altOlcut = altOlcutMap.get(altId);
      if (!altOlcut) {
        throw new Error(`Alt ölçüt kaydı bulunamadı (alt_olcut_id: ${altId}).`);
      }
      const iaaKodu = (altOlcut.kod || `OLCUT_${altId}`).trim();
      const iaaAdi = (altOlcut.olcut_adi || '').trim();
      const kek = altOlcut.kalite_el_kitabi || {};

      // Eylem planı iyileştirme alanı
      const eylemRows = (eylemPlanlari || []).filter(e => Number(e.alt_olcut_id) === altId);
      const iyilestirmeAlanlari = Array.from(
        new Set(
          eylemRows
            .map(e => (e.iyilestirme_alani || '').trim())
            .filter(Boolean)
        )
      );
      const faaliyetAdi =
        iyilestirmeAlanlari.length > 0 ? iyilestirmeAlanlari.join(' / ') : `${iaaKodu} - ${iaaAdi}`;

      // Sorumlu hoca
      const atamaRow = (atamalar || []).find(a => Number(a.alt_olcut_id) === altId);
      const sorumluAdSoyad =
        (atamaRow?.user_id && profilMap.get(atamaRow.user_id)) || 'Birim Kalite ve Akreditasyon Komisyonu';

      // PUKÖ kayıtlarını aşamalara ayır
      const pukosForCriterion = (pukoRecords || []).filter(p => Number(p.alt_olcut_id) === altId);
      const findPuko = (stageName: string) =>
        pukosForCriterion.find(p => (p.puko_asamasi || '').toLowerCase() === stageName.toLowerCase());

      const pPlanlama = findPuko('planlama');
      const pUygulama = findPuko('uygulama');
      const pKontrol = findPuko('kontrol');
      const pOnlem = findPuko('onlem');
      const pOlgunluk = findPuko('olgunluk');

      const resolveStageKanitlar = async (
        rawList: any[],
        stage: PukoStageKey
      ): Promise<ResolvedEvidenceItem[]> => {
        if (!Array.isArray(rawList) || rawList.length === 0) return [];
        const items: ResolvedEvidenceItem[] = [];
        for (let i = 0; i < rawList.length; i++) {
          const item = rawList[i];
          const rawUrl = item?.url || '';
          const name = item?.name || `Kanıt ${i + 1}`;
          const driveUrl = await driveManager.resolveEvidenceDriveUrl({
            rawUrl,
            displayName: name,
            iaaKodu,
            stage,
          });
          items.push({
            no: item?.no || item?.evidence_no || i + 1,
            name,
            originalUrl: rawUrl,
            driveUrl,
          });
        }
        return items;
      };

      const planlamaKanitlar = await resolveStageKanitlar(pPlanlama?.kanit_dosyalari || [], 'planlama');
      const uygulamaKanitlar = await resolveStageKanitlar(pUygulama?.kanit_dosyalari || [], 'uygulama');
      const kontrolKanitlar = await resolveStageKanitlar(pKontrol?.kanit_dosyalari || [], 'kontrol');
      const onlemKanitlar = await resolveStageKanitlar(pOnlem?.kanit_dosyalari || [], 'onlem');

      // ÖDR içindeki kanıtları çöz (Dosya adına göre kendi aşamasına veya 5_ODR_Kanitlari klasörüne yönlendir)
      const odrKanitlarRaw = Array.isArray(odr.kanitlar) ? [...odr.kanitlar] : [];

      // ÖDR metni (icerik) içinde doğrudan <a href="..."> olarak gömülü depolama kanıtları varsa onları da listeye ekle
      const existingOdrKeys = new Set(
        odrKanitlarRaw.map((k: any) => normalizeStorageKey(k?.url || '')).filter(Boolean)
      );
      const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let anchorMatch: RegExpExecArray | null;
      const icerikHtml = String(odr.icerik || '');
      while ((anchorMatch = anchorRegex.exec(icerikHtml)) !== null) {
        const href = (anchorMatch[1] || '').trim();
        const sKey = normalizeStorageKey(href);
        if (sKey && !existingOdrKeys.has(sKey)) {
          existingOdrKeys.add(sKey);
          const innerLabel = (anchorMatch[2] || '').replace(/<[^>]+>/g, '').trim();
          const numMatch = innerLabel.match(/kan[ıi]t\s*(\d+)/i);
          const parsedNo = numMatch ? Number(numMatch[1]) : odrKanitlarRaw.length + 1;
          const parsedFile = parseStorageUrl(href)?.filePath.split('/').pop() || `Kanıt ${parsedNo}.pdf`;
          odrKanitlarRaw.push({
            no: parsedNo,
            name: innerLabel && !innerLabel.startsWith('http') ? `${innerLabel} - ${parsedFile}` : parsedFile,
            url: href,
          });
        }
      }

      const odrKanitlar: ResolvedEvidenceItem[] = [];
      for (let i = 0; i < odrKanitlarRaw.length; i++) {
        const k = odrKanitlarRaw[i];
        const rawUrl = k?.url || '';
        const name = k?.name || `Kanıt ${k?.no || i + 1}`;
        const detectedStage = detectStageFromUrl(rawUrl, 'odr');
        const driveUrl = await driveManager.resolveEvidenceDriveUrl({
          rawUrl,
          displayName: name,
          iaaKodu,
          stage: detectedStage,
        });
        const resolvedItem: ResolvedEvidenceItem = {
          no: k?.no || i + 1,
          name,
          originalUrl: rawUrl,
          driveUrl,
        };
        odrKanitlar.push(resolvedItem);

        // Eğer PUKÖ aşamasında dosya listesi boş kalmış ama ÖDR kanıtlarında o aşamanın dosyası varsa aşamaya da ekle
        const sKey = normalizeStorageKey(rawUrl);
        const hasSameFile = (list: ResolvedEvidenceItem[]) =>
          list.some(x => (sKey && normalizeStorageKey(x.originalUrl) === sKey) || x.originalUrl === rawUrl);

        if (detectedStage === 'planlama' && !hasSameFile(planlamaKanitlar)) {
          planlamaKanitlar.push(resolvedItem);
        } else if (detectedStage === 'uygulama' && !hasSameFile(uygulamaKanitlar)) {
          uygulamaKanitlar.push(resolvedItem);
        } else if (detectedStage === 'kontrol' && !hasSameFile(kontrolKanitlar)) {
          kontrolKanitlar.push(resolvedItem);
        } else if (detectedStage === 'onlem' && !hasSameFile(onlemKanitlar)) {
          onlemKanitlar.push(resolvedItem);
        }
      }

      const odrDate = formatTrDate(odr.olusturulma_tarihi);

      const formInput: CriterionFormInput = {
        iaaKodu,
        iaaAdi,
        hazirlamaTarihi: odrDate,
        faaliyetAdi,
        icPaydaslar: kek.ic_paydaslar || '',
        disPaydaslar: kek.dis_paydaslar || '',
        uluslararasiPaydaslar: kek.uluslararasi_paydaslar || '',
        planlama: {
          aciklamaHtml: pPlanlama?.aciklama || '',
          tarih: formatTrDate(pPlanlama?.olusturulma_tarihi || odr.olusturulma_tarihi),
          kanitlar: planlamaKanitlar,
        },
        uygulama: {
          aciklamaHtml: pUygulama?.aciklama || '',
          tarih: formatTrDate(pUygulama?.olusturulma_tarihi || odr.olusturulma_tarihi),
          kanitlar: uygulamaKanitlar,
        },
        kontrol: {
          aciklamaHtml: pKontrol?.aciklama || odr.birim_anket_degerlendirmesi || '',
          tarih: formatTrDate(pKontrol?.olusturulma_tarihi || odr.olusturulma_tarihi),
          kanitlar: kontrolKanitlar,
        },
        onlem: {
          aciklamaHtml: pOnlem?.aciklama || '',
          tarih: formatTrDate(pOnlem?.olusturulma_tarihi || odr.olusturulma_tarihi),
          kanitlar: onlemKanitlar,
        },
        olgunlukPuani: Number(pOlgunluk?.olgunluk_puani || 0),
        odrRaporHtml: odr.icerik || '',
        odrKanitlar,
        sorumluAdSoyad,
        sorumluTarih: odrDate,
        degerlendirmeTarihi: odrDate,
      };

      const buffer = generateCriterionDocxBuffer(formInput);
      const safeKod = iaaKodu.replace(/[^A-Za-z0-9._-]/g, '_');
      return {
        fileName: `${safeKod}_PUKO_Kontrol_Formu.docx`,
        buffer,
      };
    };

    // Tekil İndirme Modu
    if (altOlcutIdParam && !isAll) {
      const singleResult = await buildFormForOdr(approvedOdrs[0]);
      return new NextResponse(new Uint8Array(singleResult.buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${singleResult.fileName}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // Toplu İndirme Modu (.ZIP)
    const sortedOdrs = [...approvedOdrs].sort((a, b) => {
      const kodA = altOlcutMap.get(Number(a.alt_olcut_id))?.kod || '';
      const kodB = altOlcutMap.get(Number(b.alt_olcut_id))?.kod || '';
      return kodA.localeCompare(kodB, 'tr', { numeric: true });
    });

    const zip = new JSZip();
    const rootZipFolder = zip.folder(`ESOGU_PUKO_Kontrol_Formlari_${activePeriod.donem_adi}`);

    for (const odr of sortedOdrs) {
      const { fileName, buffer } = await buildFormForOdr(odr);
      rootZipFolder?.file(fileName, buffer);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const zipFileName = `ESOGU_Uni_PUKO_Kontrol_Formlari_${activePeriod.donem_adi}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('Uni PUKO export error:', err);
    return NextResponse.json(
      { error: err?.message || 'PUKÖ Kontrol Formu oluşturulurken bir hata meydana geldi.' },
      { status: 500 }
    );
  }
}
