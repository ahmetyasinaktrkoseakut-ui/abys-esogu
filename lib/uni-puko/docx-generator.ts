import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { getYokakMappingForIaa } from './iaa-yokak-mapping';
import { normalizeStorageKey } from './drive-service';

export interface ResolvedEvidenceItem {
  no: number;
  name: string;
  originalUrl: string;
  driveUrl: string;
}

export interface CriterionFormInput {
  iaaKodu: string;
  iaaAdi: string;
  hazirlamaTarihi: string;
  faaliyetAdi: string;
  icPaydaslar: string;
  disPaydaslar: string;
  uluslararasiPaydaslar: string;
  planlama: {
    aciklamaHtml: string;
    tarih: string;
    kanitlar: ResolvedEvidenceItem[];
  };
  uygulama: {
    aciklamaHtml: string;
    tarih: string;
    kanitlar: ResolvedEvidenceItem[];
  };
  kontrol: {
    aciklamaHtml: string;
    tarih: string;
    kanitlar: ResolvedEvidenceItem[];
  };
  onlem: {
    aciklamaHtml: string;
    tarih: string;
    kanitlar: ResolvedEvidenceItem[];
  };
  olgunlukPuani: number; // 1..5
  odrRaporHtml: string;
  odrKanitlar: ResolvedEvidenceItem[];
  sorumluAdSoyad: string;
  sorumluTarih: string;
  degerlendirmeTarihi: string;
}

function escapeXml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&rsquo;/gi, '’')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

function stripTagsToLines(html: string): string[] {
  if (!html) return [];
  const withBreaks = html
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ');
  const plain = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ''));
  return plain
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function replaceParagraphWithXml(docXml: string, token: string, replacementParagraphsXml: string): string {
  const idx = docXml.indexOf(token);
  if (idx === -1) return docXml;

  let pStart = docXml.lastIndexOf('<w:p', idx);
  while (pStart >= 0 && !/^<w:p[\s>]/.test(docXml.slice(pStart, pStart + 6))) {
    pStart = docXml.lastIndexOf('<w:p', pStart - 1);
  }
  const pEnd = docXml.indexOf('</w:p>', idx);
  if (pStart === -1 || pEnd === -1) return docXml;

  return docXml.slice(0, pStart) + replacementParagraphsXml + docXml.slice(pEnd + 6);
}

export function generateCriterionDocxBuffer(input: CriterionFormInput): Buffer {
  const templatePath = path.join(process.cwd(), 'lib', 'uni-puko', 'template', 'puko-kontrol-formu.docx');
  const templateBuffer = fs.readFileSync(templatePath);
  const zip = new PizZip(templateBuffer);

  let docXml = zip.file('word/document.xml')!.asText();
  let relsXml = zip.file('word/_rels/document.xml.rels')!.asText();

  let nextRelCounter = 100;
  const newRelationships: string[] = [];

  const registerHyperlink = (targetUrl: string, displayText: string): string => {
    const rId = `rId${nextRelCounter++}`;
    newRelationships.push(
      `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(targetUrl)}" TargetMode="External"/>`
    );
    return `<w:hyperlink r:id="${rId}" w:history="1"><w:r><w:rPr><w:b/><w:color w:val="0563C1"/><w:u w:val="single"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeXml(displayText)}</w:t></w:r></w:hyperlink>`;
  };

  const buildPlainParagraphsXml = (html: string, emptyFallback = '-'): string => {
    const lines = stripTagsToLines(html);
    if (lines.length === 0) {
      return `<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:color w:val="222222"/><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(emptyFallback)}</w:t></w:r></w:p>`;
    }
    return lines
      .map(
        line =>
          `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:color w:val="222222"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
      )
      .join('');
  };

  const buildStageEvidencesXml = (evidences: ResolvedEvidenceItem[]): string => {
    if (!evidences || evidences.length === 0) {
      return `<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:color w:val="555555"/><w:sz w:val="19"/></w:rPr><w:t>Bu aşama için ek dosya yüklenmemiştir.</w:t></w:r></w:p>`;
    }
    return evidences
      .map((ev, i) => {
        if (!ev.driveUrl) {
          throw new Error(`Aşama kanıtı için Drive bağlantısı eksik (${input.iaaKodu} - ${ev.name}).`);
        }
        const prefix = `• Kanıt ${ev.no || i + 1}: `;
        const linkXml = registerHyperlink(ev.driveUrl, `${ev.name} [Drive Bağlantısı]`);
        return `<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="222222"/><w:sz w:val="19"/></w:rPr><w:t xml:space="preserve">${escapeXml(prefix)}</w:t></w:r>${linkXml}</w:p>`;
      })
      .join('');
  };

  const buildOdrRichParagraphsXml = (html: string, odrEvidences: ResolvedEvidenceItem[]): string => {
    if (!html) {
      return buildPlainParagraphsXml('', 'Özdeğerlendirme raporu metni bulunmamaktadır.');
    }

    // Build strict lookup maps by normalized URL, storageKey (bucket/filePath), and evidence number
    const urlToDriveMap = new Map<string, string>();
    const storageKeyToDriveMap = new Map<string, string>();
    const noToDriveMap = new Map<number, string>();
    const allEvidences = [
      ...odrEvidences,
      ...input.planlama.kanitlar,
      ...input.uygulama.kanitlar,
      ...input.kontrol.kanitlar,
      ...input.onlem.kanitlar,
    ];

    allEvidences.forEach(ev => {
      if (!ev.driveUrl) return;
      if (ev.originalUrl) {
        const norm = ev.originalUrl.split('#')[0].split('?')[0].trim();
        urlToDriveMap.set(norm, ev.driveUrl);
        const sKey = normalizeStorageKey(norm);
        if (sKey) {
          storageKeyToDriveMap.set(sKey, ev.driveUrl);
        }
      }
      if (ev.no && !noToDriveMap.has(Number(ev.no))) {
        noToDriveMap.set(Number(ev.no), ev.driveUrl);
      }
    });

    odrEvidences.forEach((ev, idx) => {
      if (!ev.driveUrl) return;
      const num = Number(ev.no || idx + 1);
      noToDriveMap.set(num, ev.driveUrl);
    });

    const processedHtml = html.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, innerHtml) => {
      const cleanLabel = decodeHtmlEntities(innerHtml.replace(/<[^>]+>/g, '')).trim() || '[Kanıt]';
      const normHref = String(href || '').split('#')[0].split('?')[0].trim();
      const sKey = normalizeStorageKey(normHref);

      let targetUrl =
        (sKey ? storageKeyToDriveMap.get(sKey) : undefined) ||
        urlToDriveMap.get(normHref);

      if (!targetUrl) {
        const kanitNumMatch = cleanLabel.match(/kan[ıi]t\s*(\d+)/i);
        if (kanitNumMatch) {
          targetUrl = noToDriveMap.get(Number(kanitNumMatch[1]));
        }
      }

      if (!targetUrl) {
        // If this link is a Supabase storage link, it MUST have a resolved Google Drive link; never guess or use another evidence!
        if (sKey) {
          throw new Error(
            `ÖDR metnindeki depolama kanıt bağlantısı Drive ile eşleştirilemedi (${input.iaaKodu} - ${cleanLabel}): ${href}`
          );
        }
        // If it is a direct external web URL (e.g., faculty news/event page), keep its exact external URL
        if (/^https?:\/\//i.test(normHref)) {
          targetUrl = String(href).trim();
        } else {
          throw new Error(
            `ÖDR metnindeki bağlantı hedefi çözümlenemedi (${input.iaaKodu} - ${cleanLabel}): ${href}`
          );
        }
      }

      return `[[__HLINK__::${targetUrl}::${cleanLabel}]]`;
    });

    const lines = stripTagsToLines(processedHtml);
    if (lines.length === 0) {
      return buildPlainParagraphsXml('', '-');
    }

    return lines
      .map(line => {
        // Also convert standalone [Kanıt X] that wasn't already inside an <a> tag
        const normalizedLine = line.replace(/\[Kanıt\s*(\d+)\]/gi, (full, numStr, offset, fullStr) => {
          // Do not double-wrap if already inside [[__HLINK__::...]]
          const before = fullStr.slice(Math.max(0, offset - 120), offset);
          if (before.includes('[[__HLINK__::') && !before.slice(before.lastIndexOf('[[__HLINK__::')).includes(']]')) {
            return full;
          }
          const dUrl = noToDriveMap.get(Number(numStr));
          if (!dUrl) {
            return full;
          }
          return `[[__HLINK__::${dUrl}::${full}]]`;
        });

        const parts = normalizedLine.split(/(\[\[__HLINK__::[^\]]+\]\])/g);
        const runsXml = parts
          .filter(Boolean)
          .map(part => {
            if (part.startsWith('[[__HLINK__::') && part.endsWith(']]')) {
              const inner = part.slice('[[__HLINK__::'.length, -2);
              const sepIdx = inner.indexOf('::');
              if (sepIdx !== -1) {
                const url = inner.slice(0, sepIdx);
                const label = inner.slice(sepIdx + 2);
                return registerHyperlink(url, label);
              }
            }
            return `<w:r><w:rPr><w:color w:val="222222"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`;
          })
          .join('');

        return `<w:p><w:pPr><w:spacing w:after="100"/></w:pPr>${runsXml}</w:p>`;
      })
      .join('');
  };

  // 1. Replace rich XML paragraph blocks
  docXml = replaceParagraphWithXml(docXml, '{{PLANLAMA_METNI_XML}}', buildPlainParagraphsXml(input.planlama.aciklamaHtml));
  docXml = replaceParagraphWithXml(docXml, '{{PLANLAMA_KANITLARI_XML}}', buildStageEvidencesXml(input.planlama.kanitlar));

  docXml = replaceParagraphWithXml(docXml, '{{UYGULAMA_METNI_XML}}', buildPlainParagraphsXml(input.uygulama.aciklamaHtml));
  docXml = replaceParagraphWithXml(docXml, '{{UYGULAMA_KANITLARI_XML}}', buildStageEvidencesXml(input.uygulama.kanitlar));

  docXml = replaceParagraphWithXml(docXml, '{{KONTROL_METNI_XML}}', buildPlainParagraphsXml(input.kontrol.aciklamaHtml));
  docXml = replaceParagraphWithXml(docXml, '{{KONTROL_KANITLARI_XML}}', buildStageEvidencesXml(input.kontrol.kanitlar));

  docXml = replaceParagraphWithXml(docXml, '{{ONLEM_METNI_XML}}', buildPlainParagraphsXml(input.onlem.aciklamaHtml));
  docXml = replaceParagraphWithXml(docXml, '{{ONLEM_KANITLARI_XML}}', buildStageEvidencesXml(input.onlem.kanitlar));

  docXml = replaceParagraphWithXml(docXml, '{{ODR_RAPOR_METNI_XML}}', buildOdrRichParagraphsXml(input.odrRaporHtml, input.odrKanitlar));

  // 2. Replace plain text tokens
  const mapping = getYokakMappingForIaa(input.iaaKodu);
  const yokakDisplay = mapping ? `${mapping.yokakKodu}. ${mapping.yokakAdi}` : '-';
  const iaaDisplay = `${input.iaaKodu} - ${input.iaaAdi}`;

  const totalEvidenceCount = Math.max(
    input.odrKanitlar.length,
    input.planlama.kanitlar.length +
      input.uygulama.kanitlar.length +
      input.kontrol.kanitlar.length +
      input.onlem.kanitlar.length
  );
  const kanitKoduList =
    totalEvidenceCount > 0
      ? Array.from({ length: Math.min(totalEvidenceCount, 6) }, (_, i) => `${input.iaaKodu}_K${i + 1}`).join(' / ')
      : `${input.iaaKodu}_K1`;

  const paydasParts: string[] = [];
  if (input.icPaydaslar) paydasParts.push(`İç Paydaşlar: ${input.icPaydaslar}`);
  if (input.disPaydaslar) paydasParts.push(`Dış Paydaşlar: ${input.disPaydaslar}`);
  if (input.uluslararasiPaydaslar) paydasParts.push(`Uluslararası Paydaşlar: ${input.uluslararasiPaydaslar}`);
  const paydasDisplay = paydasParts.length > 0 ? paydasParts.join(' | ') : 'Akademik ve İdari Personel, Öğrenciler, Dış Paydaşlar';

  const textTokens: Record<string, string> = {
    '{{HAZIRLAMA_TARIHI}}': input.hazirlamaTarihi,
    '{{FAALIYET_ADI}}': input.faaliyetAdi || iaaDisplay,
    '{{YOKAK_OLCUT}}': yokakDisplay,
    '{{ODR_KANIT_KODU}}': kanitKoduList,
    '{{IAA_OLCUT}}': iaaDisplay,
    '{{PAYDASLAR}}': paydasDisplay,
    '{{PLANLAMA_TARIHI}}': input.planlama.tarih,
    '{{UYGULAMA_TARIHI}}': input.uygulama.tarih,
    '{{KONTROL_TARIHI}}': input.kontrol.tarih,
    '{{ONLEM_TARIHI}}': input.onlem.tarih,
    '{{SORUMLU_AD_SOYAD}}': input.sorumluAdSoyad || 'Birim Kalite Komisyonu',
    '{{SORUMLU_TARIH}}': input.sorumluTarih || input.hazirlamaTarihi,
    '{{DEGERLENDIRME_TARIHI}}': input.degerlendirmeTarihi || input.hazirlamaTarihi,
  };

  for (let lvl = 1; lvl <= 5; lvl++) {
    const isSelected = Number(input.olgunlukPuani) === lvl;
    if (lvl === 5) {
      textTokens[`{{OLGUNLUK_${lvl}}}`] = isSelected ? '☑ (Hedef)' : '□ (Hedef)';
    } else {
      textTokens[`{{OLGUNLUK_${lvl}}}`] = isSelected ? '☑' : '□';
    }
  }

  for (const [token, val] of Object.entries(textTokens)) {
    docXml = docXml.split(token).join(escapeXml(val));
  }

  // 3. Replace YÖKAK checklist tokens {{CHK_...}}
  const targetYokakCode = mapping ? mapping.yokakKodu.replace(/\./g, '_') : '';
  const targetYokakParent = mapping ? mapping.yokakKodu.split('.').slice(0, 2).join('_') : '';

  docXml = docXml.replace(/\{\{CHK_([A-D0-9_]+)\}\}/g, (_, codeKey) => {
    if (codeKey === targetYokakCode || codeKey === targetYokakParent) {
      return '☑';
    }
    return '□';
  });

  // 4. Append hyperlink relationships into word/_rels/document.xml.rels
  if (newRelationships.length > 0) {
    relsXml = relsXml.replace('</Relationships>', `${newRelationships.join('')}</Relationships>`);
    zip.file('word/_rels/document.xml.rels', relsXml);
  }

  zip.file('word/document.xml', docXml);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
