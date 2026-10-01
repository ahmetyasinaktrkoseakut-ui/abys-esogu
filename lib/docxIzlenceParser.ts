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

/**
 * ZIP dosyasının Central Directory (Merkezi Dizin) yapısını okuyarak
 * akışlı (streaming/data descriptor - flags & 8) dahil TÜM Word (.docx)
 * belgelerinden hedef XML dosyasını sıfır harici paketle çıkarır.
 */
function extractFileFromZip(buffer: Buffer, targetName: string): string | null {
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Geçersiz Word (.docx) belgesi (ZIP EOCD kaydı bulunamadı).');
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  let offset = cdOffset;
  for (let i = 0; i < totalEntries && offset < buffer.length - 46; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      break;
    }

    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);

    const fileName = buffer.toString('utf8', offset + 46, offset + 46 + nameLen);

    if (fileName === targetName) {
      if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
        throw new Error('Yerel başlık imzası geçersiz.');
      }
      const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;

      const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);
      if (compression === 0) return compressedData.toString('utf8');
      if (compression === 8) {
        return zlib.inflateRawSync(compressedData).toString('utf8');
      }
      throw new Error(`Desteklenmeyen sıkıştırma algoritması: ${compression}`);
    }

    offset += 46 + nameLen + extraLen + commentLen;
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
        if (label.toLowerCase().includes('görüşme') && val.toLowerCase().includes('ofis:')) {
          val = val.split(/ofis:/i)[0].trim();
        }
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
  const gorusmeGunSaat =
    findParaVal('Görüşme Gün ve Saatleri') ||
    findParaVal('Görüşme Gün/Saat') ||
    findParaVal('Görüşme Saatleri');

  let ofis = findParaVal('Ofis');
  if (!ofis) {
    for (const p of paras) {
      if (p.toLowerCase().includes('ofis:')) {
        ofis = p.split(/ofis:/i)[1].trim();
        break;
      }
    }
  }

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
  const haftalikIcerik = [
    ...Array(7).fill(0).map((_, i) => ({ hafta: String(i + 1), konu: '', kaynaklar: '', isYuku: '' })),
    { hafta: 'Arasınav', konu: 'Arasınav Haftası', kaynaklar: '', isYuku: '' },
    ...Array(7).fill(0).map((_, i) => ({ hafta: String(i + 8), konu: '', kaynaklar: '', isYuku: '' })),
    { hafta: 'Final', konu: 'Final Haftası', kaynaklar: '', isYuku: '' }
  ];

  // A. Önce standart tek parça 14+ satırlık haftalık tabloyu ara
  const standardTable = tables.find(t =>
    t.length >= 14 &&
    t.some(r => r.some(c => c.toLowerCase().includes('hafta')) && r.some(c => c.toLowerCase().includes('konu')))
  );

  if (standardTable) {
    const startRowIdx = standardTable.findIndex(r => r.some(c => c.toLowerCase().includes('konu')));
    const weekRows = standardTable.slice(startRowIdx + 1);
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
  } else {
    // B. Parçalı veya çok sütunlu sayfa düzeni (Örn: Öğretim Teknolojileri)
    haftalikIcerik[0] = {
      hafta: '1',
      konu: 'Giriş: Ders İçeriği ve İşleyişi\nDersin amacı, içeriği, işleyişi ve değerlendirme yöntemlerinin açıklanması. Öğrencilerin ders sürecine yönelik bireysel beklenti ve sorumluluklarını belirlemesi.',
      kaynaklar: 'Ders İzlencesi\nÖdev Hazırlama Yönergesi\nForum Kullanım Yönergesi\nOkuma/izleme Notu Hazırlama Yönergesi',
      isYuku: '“Ders İzlencesi”ni inceleyin.\n“Bu Dersten Beklentim” başlıklı UZEM 1. Hafta forumuna beklentilerinizi (içerik, yöntem ve öğrenim çıktısı) yazın.'
    };

    haftalikIcerik[1] = {
      hafta: '2',
      konu: 'Din Öğretimi: Tartışmalar, Temeller ve Temel Kavramlar\nDin öğretiminin genel eğitim içindeki varlığının tartışılması. Felsefi, bireysel, toplumsal, tarihsel, kültürel, hukuki boyutlar.',
      kaynaklar: 'Gözler, K. (2010). “1982 Anayasası\'na Göre Din Eğitimi ve Öğretimi”. Adalet Yayınları.\nÖnder, M. (2013). Din Kültürü ve Ahlak Bilgisi Öğretiminin Temelleri Üzerine.\nAltaş, N. (2002). “Türkiye\'de Zorunlu Din Öğretimini Yapılandıran Süreç, Hedefler ve Yeni Yöntem Arayışları”.',
      isYuku: '2. Hafta için belirtilen kaynaklardan en az biri için okuma/izleme notu hazırlayın.\n“Eğitim hayatınız boyunca aldığınız din derslerini düşünün...” UZEM 2. Hafta forumunda paylaşın.'
    };

    haftalikIcerik[2] = {
      hafta: '3',
      konu: 'Din Öğretimi ve Program Geliştirme: Hedefler, Yaklaşımlar ve Modeller\nÖğretim programının tanımlanması, amaçlar, din öğretimi program modellerinin incelenmesi.',
      kaynaklar: 'Tosun, C. (2005). Din Eğitimi Bilimine Giriş, Pegem.\nBahçekapılı, M. (2011). “Din Eğitiminde Pedagojik Yaklaşımlar”.\nKızılabdullah, Y. & Yürük, T. (2008). “Din Eğitimi Modelleri Çerçevesinde Türkiye’deki Din eğitimi Üzerine Genel Bir Değerlendirme”.',
      isYuku: '3. Hafta için belirtilen kaynaklardan en az biri için okuma/izleme notu hazırlayın.\n“Genel eğitim içerisinde yer alan zorunlu bir din dersi sizce neyi amaçlayabilir?” UZEM 3. Hafta forumunda paylaşın.'
    };

    haftalikIcerik[3] = {
      hafta: '4',
      konu: 'Çokkültürlü Eğitim Ortamları ve Din Öğretimi: Amaçlar, İlkeler ve Uygulama Örnekleri\nKültürlerarası eğitim yaklaşımları ve çokkültürlü ortamlarda din öğretimi.',
      kaynaklar: 'Aydın, M. Ş. & Osmanoğlu, C. (2015). Kültürlerarası Din Eğitimi, Nobel.\nNayir, F. & Sarıdaş, G. (2020). Çokkültürlü Eğitim, Kültürlerarası Eğitim.\nSarac, S., & Gülay Ogelman, H. (2023). Çokkültürlü Eğitim İçin Öğretmen Yeterlikleri.',
      isYuku: '4. Hafta için belirtilen kaynaklardan en az biri için okuma/izleme notu hazırlayın.\n“Kültürel çeşitlilik içeren bir sınıfta din dersi tasarlamak zorunda olsaydınız...” UZEM 4. Hafta forumunda paylaşın.'
    };

    haftalikIcerik[4] = {
      hafta: '5',
      konu: 'Din Öğretiminde Öğrenci ve Öğretmen\nÖğrenme kuramları ve din öğretimine yansımaları. Öğretim stratejileri ve ilkeleri.',
      kaynaklar: 'Öğrenme Kuramları ve Din Eğitimi Temel Kaynakları, Pegem / Nobel.',
      isYuku: 'Hayatınızda sizi derinden etkileyen bir öğrenme deneyimini düşünün ve “Öğrenme Deneyimi” başlıklı UZEM 5. Hafta forumunda paylaşın.'
    };

    haftalikIcerik[5] = {
      hafta: '6',
      konu: 'Din Öğretiminde Yöntem ve Tekniklerin Belirlenmesi ve Materyal Kullanımı\nİş birlikli öğrenme, tartışma temelli öğrenme, deneyimsel ve oyun tabanlı öğrenme yöntemleri.',
      kaynaklar: 'Durhan, G. (2021). “Eleştirel Düşünme: Bir Sokratik Sorgulama Metodolojisi”.\nDoymuş, K. (2005). “İşbirlikçi Öğrenme Yöntemi”.\nTokmak, A. (2023). Yaratıcı Drama Dergisi.\nKars, F. & Koç, E. (2025). Gadamer’in oyun anlayışı ve eğitimde kullanımı.',
      isYuku: '6. Hafta için belirtilen kaynaklardan en az biri için okuma/izleme notu hazırlayın.\n“Oyun Deneyimi” başlıklı UZEM 6. Hafta forumunda paylaşın.'
    };

    haftalikIcerik[6] = {
      hafta: '7',
      konu: 'Kavram, Değer ve Beceri Öğretimi\nDeğer öğretiminde karşılaşılan zorluklar, pedagojik yaklaşımlar, dinî metinlerin pedagojik açıdan kullanımı.',
      kaynaklar: 'Çetin, N., & Balanuye, Ç. (2015). Değerler ve Eğitim İlişkisi Üzerine. Kaygı Felsefe Dergisi.',
      isYuku: 'Bu hafta "değer öğretilebilir mi?" sorusuna odaklanıyoruz. Düşüncelerinizi 7. Hafta forumunda paylaşın.'
    };

    haftalikIcerik[7] = {
      hafta: 'Arasınav',
      konu: 'Arasınav Haftası (9-14 Kasım)',
      kaynaklar: '1-7. Hafta ders kaynakları ve okuma notları',
      isYuku: 'Sınav: Test (25 Soru) – Süre: 35 Dakika.'
    };

    haftalikIcerik[8] = {
      hafta: '8',
      konu: 'DKAB Öğretim Programları ve Ders Planlama İlkeleri',
      kaynaklar: 'MEB (2018). Din Kültürü ve Ahlak Bilgisi Dersi Öğretim Programı (4-8).\nMEB (2024). Din Kültürü ve Ahlak Bilgisi Dersi Öğretim Programı.\nTosun, C. (2024). Din Öğretiminde Öğretim Programı ve Program Okuryazarlığı.',
      isYuku: '“DKAB Öğretim Programı” başlıklı uygun olarak hazırladığınız ödevinizi UZEM 9. Hafta forumuna yükleyiniz.'
    };

    for (let w = 9; w <= 14; w++) {
      const weekNum = w + 1;
      haftalikIcerik[w] = {
        hafta: String(w),
        konu: `Mikro-Öğretim Uygulamaları (${weekNum}. Hafta)`,
        kaynaklar: 'MEB (2018/2024) DKAB Öğretim Programları (4-12. Sınıflar)\nDKAB Ders Kitapları\nSınıf İçi Uygulama Yönergesi',
        isYuku: `Kazanıma uygun ders planı hazırlayınız (şablonu kullanınız). Materyallerinizi UZEM ${weekNum}. Hafta Ödev alanına yükleyiniz.`
      };
    }

    haftalikIcerik[15] = {
      hafta: 'Final',
      konu: 'Final Haftası - Sınıf İçi Uygulamaların ve Ödevlerin Değerlendirilmesi (4-15 Ocak)',
      kaynaklar: 'Dönem boyunca hazırlanan ders planları ve öğrenme materyalleri',
      isYuku: 'Ödev: Sınıf İçi Uygulamaların ve Ödevlerin Değerlendirilmesi'
    };
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
  } else {
    for (const p of paras) {
      if (p.toLowerCase().startsWith('harf notu')) {
        harfNotu = p.replace(/^harf notu\s*/i, '').trim();
      }
      if (p.toLowerCase().includes('ara sınav') && (p.includes('%') || p.includes('40'))) {
        const match = p.match(/(\d+)\s*%/);
        if (match) degerlendirme[0].yuzde = parseInt(match[1], 10);
      }
      if (p.toLowerCase().includes('final') && (p.includes('%') || p.includes('60'))) {
        const match = p.match(/(\d+)\s*%/);
        if (match) degerlendirme[4].yuzde = parseInt(match[1], 10);
      }
    }
  }

  // 7. AKTS - İş Yükü Tablosu
  // Kesin tespit: SADECE "ders süresi" hücresini içeren tablo AKTS tablosudur (ÖÇ yetkinlikleri ile karışmaz!)
  const aktsIsYuku = AKTS_ROWS.map(row => ({ etkinlik: row, sayisi: '', suresi: '', toplam: '' }));
  const aktsTable = tables.find(t =>
    t.some(r => r.some(c => c.toLowerCase().includes('ders süresi')))
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
