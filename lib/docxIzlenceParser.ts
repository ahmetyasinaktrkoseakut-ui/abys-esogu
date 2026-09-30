import zlib from 'zlib';

export interface ParsedIzlenceData {
  ogretimElemani: string;
  eposta: string;
  gorusmeGunSaat: string;
  ofis: string;
  donem: string;
  gunSaat: string;
  egitimDili: string;
  ogretimTuru: string;
  derslik: string;
  onkosul: string;
  amac: string;
  ogrenimCiktilari: Array<{
    cikti: string;
    bilgi: boolean;
    beceri: boolean;
    yetkinlik: boolean;
    ogretim: string;
    olcme: string;
  }>;
  temelKaynaklar: string;
  yardimciKaynaklar: string;
  politikalar: string;
  haftalikIcerik: Array<{
    hafta: string;
    konu: string;
    kaynaklar: string;
    isYuku: string;
  }>;
  degerlendirme: Array<{
    tur: string;
    aciklama: string;
    yuzde: number;
  }>;
  harfNotu: string;
  aktsIsYuku: Array<{
    etkinlik: string;
    sayisi: string;
    suresi: string;
    toplam: string;
  }>;
}

const AKTS_ROWS = [
  'Ders Süresi (Sınav Haftası Dahil Haftalık Toplam Ders Saati)',
  'Sınıf Dışı Ders Çalışma Süresi (Tekrar, Pekiştirme, Ön Çalışma vb.)',
  'Ödev',
  'Kısa Sınav',
  'Kısa Sınav Hazırlık',
  'Sözlü Sınav',
  'Sözlü Sınav Hazırlık',
  'Rapor (Hazırlık ve Sunum Süresi Dahil)',
  'Proje (Hazırlık ve Sunum Süresi Dahil)',
  'Sunum (Hazırlık Süresi Dahil)',
  'Ara Sınav',
  'Ara Sınav Hazırlık',
  'Yarıyıl Sonu Sınavı',
  'Yarıyıl Sonu Sınavı Hazırlık'
];

function extractFileFromZip(buffer: Buffer, targetName: string): string | null {
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      offset++;
      continue;
    }
    const compression = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const fileName = buffer.toString('utf8', offset + 30, offset + 30 + nameLen);
    const dataOffset = offset + 30 + nameLen + extraLen;

    if (fileName === targetName) {
      const data = buffer.subarray(dataOffset, dataOffset + compressedSize);
      if (compression === 0) return data.toString('utf8');
      if (compression === 8) {
        return zlib.inflateRawSync(data).toString('utf8');
      }
      throw new Error(`Desteklenmeyen sıkıştırma algoritması: ${compression}`);
    }
    offset = dataOffset + compressedSize;
  }
  return null;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function parseDocxIzlence(buffer: Buffer): ParsedIzlenceData {
  const xml = extractFileFromZip(buffer, 'word/document.xml');
  if (!xml) {
    throw new Error('Geçersiz Word (.docx) dosyası. word/document.xml içeriği bulunamadı.');
  }

  // Paragrafları ayrıştır
  const pRegex = /<w:p(?: [^>]*)?>([\s\S]*?)<\/w:p>/g;
  const paras: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pRegex.exec(xml)) !== null) {
    const tRegex = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g;
    let pText = '';
    let tm: RegExpExecArray | null;
    while ((tm = tRegex.exec(m[1])) !== null) {
      pText += tm[1];
    }
    paras.push(decodeXmlEntities(pText.trim()));
  }

  // Tabloları ayrıştır (2D string dizi)
  const tblRegex = /<w:tbl(?: [^>]*)?>([\s\S]*?)<\/w:tbl>/g;
  const tables: string[][][] = [];
  while ((m = tblRegex.exec(xml)) !== null) {
    const trRegex = /<w:tr(?: [^>]*)?>([\s\S]*?)<\/w:tr>/g;
    const table: string[][] = [];
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRegex.exec(m[1])) !== null) {
      const tcRegex = /<w:tc(?: [^>]*)?>([\s\S]*?)<\/w:tc>/g;
      const row: string[] = [];
      let tcMatch: RegExpExecArray | null;
      while ((tcMatch = tcRegex.exec(trMatch[1])) !== null) {
        const tRegex = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g;
        let cellText = '';
        let tm: RegExpExecArray | null;
        while ((tm = tRegex.exec(tcMatch[1])) !== null) {
          cellText += tm[1];
        }
        row.push(decodeXmlEntities(cellText.trim()));
      }
      table.push(row);
    }
    tables.push(table);
  }

  const findParaVal = (label: string): string => {
    for (let i = 0; i < paras.length; i++) {
      const p = paras[i];
      if (p.toLowerCase().startsWith(label.toLowerCase())) {
        let val = p.substring(label.length).replace(/^[\s:]+/, '').trim();
        if (!val && i + 1 < paras.length && !paras[i + 1].includes(':')) {
          val = paras[i + 1].trim();
        }
        return val;
      }
    }
    return '';
  };

  const findSectionBetween = (startHeader: string, endHeader?: string): string => {
    const sIdx = paras.findIndex(p => p.toLowerCase().includes(startHeader.toLowerCase()));
    if (sIdx === -1) return '';
    const eIdx = endHeader
      ? paras.findIndex((p, idx) => idx > sIdx && p.toLowerCase().includes(endHeader.toLowerCase()))
      : -1;
    const lines = (eIdx !== -1 ? paras.slice(sIdx + 1, eIdx) : paras.slice(sIdx + 1, sIdx + 10))
      .filter(p => p && !p.toLowerCase().includes(startHeader.toLowerCase()));
    return lines.join('\n');
  };

  // 1. Künye Bilgileri
  const ogretimElemani = findParaVal('Öğretim Elemanı');
  const eposta = findParaVal('E-Posta');
  const gorusmeGunSaat = findParaVal('Görüşme Gün ve Saatleri') || findParaVal('Görüşme Gün/Saat') || findParaVal('Görüşme Saatleri');
  const ofis = findParaVal('Ofis');
  const donem = findParaVal('Dönem');
  const gunSaat = findParaVal('Gün ve Saat');
  const egitimDili = findParaVal('Eğitim Dili') || 'Türkçe';
  const ogretimTuru = findParaVal('Öğretim Türü') || 'Örgün Öğretim';
  const derslik = findParaVal('Derslik');
  const onkosul = findParaVal('Önkoşul Dersleri') || findParaVal('Ön Koşul') || '-';

  // Dersin Amacı
  let amac = '';
  const amacIdx = paras.findIndex(p => p.toLowerCase().includes('dersin amacı'));
  if (amacIdx !== -1) {
    for (let i = amacIdx + 1; i < amacIdx + 6; i++) {
      if (paras[i] && !paras[i].toLowerCase().includes('öğrenim çıktı') && paras[i].length > 5) {
        amac = paras[i];
        break;
      }
    }
  }

  // 2. Öğrenim Çıktıları
  const ocTable = tables.find(t => t.length > 0 && t[0].some(c => c.toLowerCase().includes('öğrenim çıktı')));
  const ogrenimCiktilari = Array(10).fill(0).map(() => ({
    cikti: '', bilgi: false, beceri: false, yetkinlik: false, ogretim: '', olcme: ''
  }));
  if (ocTable) {
    let ocIdx = 0;
    for (let r = 1; r < ocTable.length && ocIdx < 10; r++) {
      const row = ocTable[r];
      const text = row.length > 1 ? row[1] : row[0];
      if (text && text.length > 3) {
        const typeCol = row.length > 2 ? row[2].toLowerCase() : '';
        const olcmeCol = row.length > 3 ? row[3] : '';
        ogrenimCiktilari[ocIdx] = {
          cikti: text,
          bilgi: typeCol.includes('bilgi') || typeCol.includes('x') || typeCol.includes('✓') || typeCol.includes('✔') || typeCol.includes('☑'),
          beceri: typeCol.includes('beceri'),
          yetkinlik: typeCol.includes('yetkinlik'),
          ogretim: '',
          olcme: olcmeCol
        };
        ocIdx++;
      }
    }
  }

  // 3. Ders Kaynakları
  let temelKaynaklar = '';
  let yardimciKaynaklar = '';
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    if (p.toLowerCase().startsWith('temel ders kitabı:')) {
      temelKaynaklar = p.replace(/^temel ders kitabı:\s*/i, '').trim();
      if (!temelKaynaklar && i + 1 < paras.length) temelKaynaklar = paras[i + 1].trim();
    }
    if (p.toLowerCase().startsWith('yardımcı kaynaklar:')) {
      yardimciKaynaklar = p.replace(/^yardımcı kaynaklar:\s*/i, '').trim();
      if (!yardimciKaynaklar && i + 1 < paras.length) yardimciKaynaklar = paras[i + 1].trim();
    }
  }

  // 4. Politikalar
  const politikalar = findSectionBetween('Ders Politikaları', 'Haftalık Ders İçeriği');

  // 5. Haftalık Ders İçeriği (16 satır)
  const haftalikTable = tables.find(t =>
    t.length > 0 &&
    t[0].some(c => c.toLowerCase().includes('hafta')) &&
    t[0].some(c => c.toLowerCase().includes('konu'))
  );

  const haftalikIcerik = [
    ...Array(7).fill(0).map((_, i) => ({ hafta: String(i + 1), konu: '', kaynaklar: '', isYuku: '' })),
    { hafta: 'Arasınav', konu: 'Arasınav Haftası', kaynaklar: '', isYuku: '' },
    ...Array(7).fill(0).map((_, i) => ({ hafta: String(i + 8), konu: '', kaynaklar: '', isYuku: '' })),
    { hafta: 'Final', konu: 'Final Haftası', kaynaklar: '', isYuku: '' }
  ];

  if (haftalikTable) {
    const weekRows = haftalikTable.slice(1);
    weekRows.forEach((row, idx) => {
      if (idx < 16) {
        const konu = row[1] || '';
        const kaynak = row[2] || '';
        const isYuku = row[3] || '';
        if (idx === 7) {
          haftalikIcerik[7] = {
            hafta: 'Arasınav',
            konu: konu || 'Arasınav Haftası',
            kaynaklar: kaynak,
            isYuku: isYuku
          };
        } else if (idx === 15) {
          haftalikIcerik[15] = {
            hafta: 'Final',
            konu: konu || 'Final Haftası',
            kaynaklar: kaynak,
            isYuku: isYuku
          };
        } else {
          haftalikIcerik[idx].konu = konu;
          haftalikIcerik[idx].kaynaklar = kaynak;
          haftalikIcerik[idx].isYuku = isYuku;
        }
      }
    });
  }

  // 6. Değerlendirme Sistemi & Harf Notu
  const degTable = tables.find(t => t.length > 0 && t[0].some(c => c.toLowerCase().includes('değerlendirme türü')));
  const degerlendirme = [
    { tur: 'Ara Sınav', aciklama: '', yuzde: 40 },
    { tur: 'Ödev', aciklama: '', yuzde: 0 },
    { tur: 'Sunum', aciklama: '', yuzde: 0 },
    { tur: 'Uygulama', aciklama: '', yuzde: 0 },
    { tur: 'Final', aciklama: '', yuzde: 60 },
    { tur: 'Bütünleme', aciklama: '', yuzde: 0 }
  ];
  let harfNotu = 'AA: / BA: / BB: / CB: / CC: / DC: / DD:';

  if (degTable) {
    degTable.forEach(row => {
      const name = (row[0] || '').toLowerCase();
      const val = parseInt(row[row.length - 1], 10);
      if (name.includes('ara sınav')) degerlendirme[0].yuzde = isNaN(val) ? 40 : val;
      if (name.includes('ödev')) degerlendirme[1].yuzde = isNaN(val) ? 0 : val;
      if (name.includes('sunum')) degerlendirme[2].yuzde = isNaN(val) ? 0 : val;
      if (name.includes('uygulama')) degerlendirme[3].yuzde = isNaN(val) ? 0 : val;
      if (name.includes('final')) degerlendirme[4].yuzde = isNaN(val) ? 60 : val;
      if (name.includes('bütünleme')) degerlendirme[5].yuzde = isNaN(val) ? 0 : val;
      if (name.includes('harf notu')) {
        harfNotu = row.slice(1).join(' ').trim();
      }
    });
  }

  // 7. AKTS - İş Yükü Tablosu
  const aktsIsYuku = AKTS_ROWS.map(row => ({ etkinlik: row, sayisi: '', suresi: '', toplam: '' }));
  const aktsTable = tables.find(t =>
    t.some(r => r.some(c => c.toLowerCase().includes('akts') || c.toLowerCase().includes('etkinlikler')))
  );

  if (aktsTable) {
    aktsTable.forEach(row => {
      if (row.length >= 3) {
        const title = row[0].trim();
        const matchedIdx = AKTS_ROWS.findIndex(
          r => r.toLowerCase() === title.toLowerCase() || (title.length > 5 && r.toLowerCase().includes(title.toLowerCase()))
        );
        if (matchedIdx !== -1) {
          const sayisi = row[1] ? row[1].trim() : '';
          const suresi = row[2] ? row[2].trim() : '';
          const toplam = row[3]
            ? row[3].trim()
            : ((parseFloat(sayisi) || 0) * (parseFloat(suresi) || 0) || '').toString();

          aktsIsYuku[matchedIdx] = {
            etkinlik: AKTS_ROWS[matchedIdx],
            sayisi,
            suresi,
            toplam
          };
        }
      }
    });
  }

  return {
    ogretimElemani,
    eposta,
    gorusmeGunSaat,
    ofis,
    donem,
    gunSaat,
    egitimDili,
    ogretimTuru,
    derslik,
    onkosul,
    amac,
    ogrenimCiktilari,
    temelKaynaklar,
    yardimciKaynaklar,
    politikalar,
    haftalikIcerik,
    degerlendirme,
    harfNotu,
    aktsIsYuku
  };
}
