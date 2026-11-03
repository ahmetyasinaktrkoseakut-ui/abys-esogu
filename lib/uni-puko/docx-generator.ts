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

interface TemplateStructure {
  zip: PizZip;
  docXml: string;
  relsXml: string;
  bodyHeader: string;
  contentTemplate: string;
  sectPrXml: string;
}

function loadTemplateStructure(): TemplateStructure {
  const templatePath = path.join(process.cwd(), 'lib', 'uni-puko', 'template', 'puko-kontrol-formu.docx');
  const templateBuffer = fs.readFileSync(templatePath);
  const zip = new PizZip(templateBuffer);

  const docXml = zip.file('word/document.xml')!.asText();
  const relsXml = zip.file('word/_rels/document.xml.rels')!.asText();

  const bodyTag = '<w:body>';
  const bodyStartIdx = docXml.indexOf(bodyTag) + bodyTag.length;
  const bodyEndIdx = docXml.lastIndexOf('</w:body>');

  const bodyHeader = docXml.slice(0, bodyStartIdx);
  const fullBodyInner = docXml.slice(bodyStartIdx, bodyEndIdx);

  const sectPrMatch = fullBodyInner.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>$/);
  const sectPrXml = sectPrMatch ? sectPrMatch[0] : '<w:sectPr/>';
  const contentTemplate = sectPrMatch ? fullBodyInner.slice(0, sectPrMatch.index) : fullBodyInner;

  return { zip, docXml, relsXml, bodyHeader, contentTemplate, sectPrXml };
}

function renderSingleFormContentXml(
  input: CriterionFormInput,
  rawContentXml: string,
  relCounterRef: { count: number },
  newRelationships: string[]
): string {
  let formXml = rawContentXml;

  const registerHyperlink = (targetUrl: string, displayText: string): string => {
    const rId = `rId_${relCounterRef.count++}`;
    newRelationships.push(
      `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(targetUrl)}" TargetMode="External"/>`
    );
    return `<w:hyperlink r:id="${rId}" w:history="1"><w:r><w:rPr><w:b/><w:color w:val="0563C1"/><w:u w:val="single"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeXml(displayText)}</w:t></w:r></w:hyperlink>`;
  };

  const urlToDriveMap = new Map<string, string>();
  const storageKeyToDriveMap = new Map<string, string>();
  const noToDriveMap = new Map<number, string>();
  const allEvidences = [
    ...input.odrKanitlar,
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

  input.odrKanitlar.forEach((ev, idx) => {
    if (!ev.driveUrl) return;
    const num = Number(ev.no || idx + 1);
    noToDriveMap.set(num, ev.driveUrl);
  });

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

  const buildRichParagraphsXml = (
    html: string,
    emptyFallback = '-',
    appendOdrEvidenceList: ResolvedEvidenceItem[] = []
  ): string => {
    if (!html) {
      return buildPlainParagraphsXml('', emptyFallback);
    }

    const processedHtml = html.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, innerHtml) => {
      const rawLabel = decodeHtmlEntities(innerHtml.replace(/<[^>]+>/g, '')).trim();
      const normHref = String(href || '').split('#')[0].split('?')[0].trim();
      const sKey = normalizeStorageKey(normHref);
      const isKanitBadgeLabel = /^\[?\s*kan[ıi]t\s*\d*\s*\]?$/i.test(rawLabel);

      let targetUrl =
        (sKey ? storageKeyToDriveMap.get(sKey) : undefined) ||
        urlToDriveMap.get(normHref);

      if (!targetUrl && rawLabel) {
        const kanitNumMatch = rawLabel.match(/kan[ıi]t\s*(\d+)/i);
        if (kanitNumMatch) {
          targetUrl = noToDriveMap.get(Number(kanitNumMatch[1]));
        }
      }

      if (!targetUrl) {
        // If this link is a foreign [Kanıt X] badge or foreign storage link not present in this criterion's own evidences, strip it cleanly
        if (sKey || isKanitBadgeLabel || !rawLabel) {
          return '';
        }
        if (/^https?:\/\//i.test(normHref)) {
          targetUrl = String(href).trim();
        } else {
          return rawLabel;
        }
      }

      const cleanLabel = rawLabel || '[Kanıt]';
      return `[[__HLINK__::${targetUrl}::${cleanLabel}]]`;
    });

    const lines = stripTagsToLines(processedHtml);
    if (lines.length === 0 && appendOdrEvidenceList.length === 0) {
      return buildPlainParagraphsXml('', emptyFallback);
    }

    const paragraphsXml = lines
      .map(line => {
        const normalizedLine = line.replace(/\[Kanıt\s*(\d+)\]/gi, (full, numStr, offset, fullStr) => {
          const before = fullStr.slice(Math.max(0, offset - 120), offset);
          if (before.includes('[[__HLINK__::') && !before.slice(before.lastIndexOf('[[__HLINK__::')).includes(']]')) {
            return full;
          }
          const dUrl = noToDriveMap.get(Number(numStr));
          if (!dUrl) {
            return allEvidences.length === 0 ? '' : full;
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

    if (appendOdrEvidenceList.length > 0) {
      const headerXml = `<w:p><w:pPr><w:spacing w:before="140" w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="1E3A8A"/><w:sz w:val="20"/></w:rPr><w:t>ÖDR Kanıt Listesi:</w:t></w:r></w:p>`;
      const listXml = buildStageEvidencesXml(appendOdrEvidenceList);
      return `${paragraphsXml}${headerXml}${listXml}`;
    }

    return paragraphsXml;
  };

  // 1. Replace rich XML paragraph blocks
  formXml = replaceParagraphWithXml(formXml, '{{PLANLAMA_METNI_XML}}', buildRichParagraphsXml(input.planlama.aciklamaHtml));
  formXml = replaceParagraphWithXml(formXml, '{{PLANLAMA_KANITLARI_XML}}', buildStageEvidencesXml(input.planlama.kanitlar));

  formXml = replaceParagraphWithXml(formXml, '{{UYGULAMA_METNI_XML}}', buildRichParagraphsXml(input.uygulama.aciklamaHtml));
  formXml = replaceParagraphWithXml(formXml, '{{UYGULAMA_KANITLARI_XML}}', buildStageEvidencesXml(input.uygulama.kanitlar));

  formXml = replaceParagraphWithXml(formXml, '{{KONTROL_METNI_XML}}', buildRichParagraphsXml(input.kontrol.aciklamaHtml));
  formXml = replaceParagraphWithXml(formXml, '{{KONTROL_KANITLARI_XML}}', buildStageEvidencesXml(input.kontrol.kanitlar));

  formXml = replaceParagraphWithXml(formXml, '{{ONLEM_METNI_XML}}', buildRichParagraphsXml(input.onlem.aciklamaHtml));
  formXml = replaceParagraphWithXml(formXml, '{{ONLEM_KANITLARI_XML}}', buildStageEvidencesXml(input.onlem.kanitlar));

  formXml = replaceParagraphWithXml(
    formXml,
    '{{ODR_RAPOR_METNI_XML}}',
    buildRichParagraphsXml(input.odrRaporHtml, 'Özdeğerlendirme raporu metni bulunmamaktadır.', input.odrKanitlar)
  );

  // 2. Replace plain text tokens
  const mapping = getYokakMappingForIaa(input.iaaKodu);
  const yokakDisplay = mapping ? `${mapping.yokakKodu}. ${mapping.yokakAdi}` : '-';
  const iaaDisplay = `${input.iaaKodu} - ${input.iaaAdi}`;

  // ÖDR Kanıt Kodu: Fakülte standart formatı (Örnek: A.1.1_K1 / A.1.1_K2 veya kanıt sayısınca)
  const totalEvidenceCount = Math.max(
    input.odrKanitlar.length,
    input.planlama.kanitlar.length +
      input.uygulama.kanitlar.length +
      input.kontrol.kanitlar.length +
      input.onlem.kanitlar.length
  );
  const codeCount = Math.max(totalEvidenceCount, 2);
  const kanitKoduList = Array.from({ length: codeCount }, (_, i) => `${input.iaaKodu}_K${i + 1}`).join(' / ');

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
    formXml = formXml.split(token).join(escapeXml(val));
  }

  // 3. Replace YÖKAK checklist tokens {{CHK_...}}
  const targetYokakCode = mapping ? mapping.yokakKodu.replace(/\./g, '_') : '';
  const targetYokakParent = mapping ? mapping.yokakKodu.split('.').slice(0, 2).join('_') : '';

  formXml = formXml.replace(/\{\{CHK_([A-D0-9_]+)\}\}/g, (_, codeKey) => {
    if (codeKey === targetYokakCode || codeKey === targetYokakParent) {
      return '☑';
    }
    return '□';
  });

  return formXml;
}

export function generateCriterionDocxBuffer(input: CriterionFormInput): Buffer {
  const tpl = loadTemplateStructure();
  const relCounterRef = { count: 100 };
  const newRelationships: string[] = [];

  const renderedContent = renderSingleFormContentXml(input, tpl.contentTemplate, relCounterRef, newRelationships);

  const finalDocXml = `${tpl.bodyHeader}${renderedContent}${tpl.sectPrXml}</w:body></w:document>`;
  let finalRelsXml = tpl.relsXml;

  if (newRelationships.length > 0) {
    finalRelsXml = finalRelsXml.replace('</Relationships>', `${newRelationships.join('')}</Relationships>`);
  }

  tpl.zip.file('word/document.xml', finalDocXml);
  tpl.zip.file('word/_rels/document.xml.rels', finalRelsXml);

  return tpl.zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export function generateMergedAllCriteriaDocxBuffer(inputs: CriterionFormInput[]): Buffer {
  if (!inputs || inputs.length === 0) {
    throw new Error('Birleştirilecek form bulunamadı.');
  }

  const tpl = loadTemplateStructure();
  const relCounterRef = { count: 100 };
  const newRelationships: string[] = [];

  const pageBreakXml = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

  const renderedForms = inputs.map(input =>
    renderSingleFormContentXml(input, tpl.contentTemplate, relCounterRef, newRelationships)
  );

  const combinedContent = renderedForms.join(pageBreakXml);
  const finalDocXml = `${tpl.bodyHeader}${combinedContent}${tpl.sectPrXml}</w:body></w:document>`;
  let finalRelsXml = tpl.relsXml;

  if (newRelationships.length > 0) {
    finalRelsXml = finalRelsXml.replace('</Relationships>', `${newRelationships.join('')}</Relationships>`);
  }

  tpl.zip.file('word/document.xml', finalDocXml);
  tpl.zip.file('word/_rels/document.xml.rels', finalRelsXml);

  return tpl.zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
