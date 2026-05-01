'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, File, ExternalLink, Download, Search } from 'lucide-react';
import { useLocale } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';

interface DokumanItem {
  name: string;
  url: string;
  size?: number;
  olcut_id: string;
  asama: string;
  olcut_adi?: string;
  olusturulma_tarihi?: string;
}

export default function DokumanlarPage() {
  const [documents, setDocuments] = useState<DokumanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const locale = useLocale();

  useEffect(() => {
    async function fetchDocs() {
      try {
        const { data } = await supabase
          .from('puko_degerlendirmeleri')
          .select('alt_olcut_id, puko_asamasi, kanit_dosyalari, olusturulma_tarihi, alt_olcutler(olcut_adi, olcut_adi_en, olcut_adi_ar, kod)');

        if (data) {
          const allDocs: DokumanItem[] = [];
          data.forEach((row: any) => {
            if (row.kanit_dosyalari && Array.isArray(row.kanit_dosyalari)) {
              row.kanit_dosyalari.forEach((doc: any) => {
                allDocs.push({
                  name: doc.name,
                  url: doc.url,
                  size: doc.size,
                  olcut_id: row.alt_olcutler?.kod || row.alt_olcut_id,
                  olcut_adi: getLocalizedField(row.alt_olcutler, 'olcut_adi', locale) || 'Bilinmiyor',
                  asama: row.puko_asamasi,
                  olusturulma_tarihi: row.olusturulma_tarihi
                });
              });
            }
          });
          setDocuments(allDocs);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDocs();
  }, []);

  const filteredDocs = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    doc.olcut_id?.toString().toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Kurumsal Doküman Yönetimi</h2>
          <p className="text-slate-500 mt-1 text-sm">Sisteme yüklenen tüm PUKÖ kanıt dosyaları ve belgeler.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Doküman veya ölçüt ara..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-20 flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Doküman Adı</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">İlgili Ölçüt</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">PUKÖ Aşaması</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Boyut</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-500">
                      <File className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                      Sistemde kayıtlı doküman bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((doc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-blue-50 text-blue-500 flex items-center justify-center">
                            <File className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700 max-w-[300px] truncate" title={doc.name}>
                              {doc.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
                          {doc.olcut_id}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1 max-w-[200px] truncate" title={doc.olcut_adi}>{doc.olcut_adi}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="capitalize text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">
                          {doc.asama.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-500">{doc.size ? `${doc.size} KB` : '-'}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <a 
                          href={doc.url} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 font-medium text-xs hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Görüntüle
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
