'use client';

import { useState } from 'react';
import {
  FileCheck,
  Download,
  FolderArchive,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Star,
  FileText,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface UniPukoCriterionItem {
  altOlcutId: number;
  iaaKodu: string;
  iaaAdi: string;
  yokakKodu: string;
  yokakAdi: string;
  sorumluAdSoyad: string;
  olgunlukPuani: number;
  kanitSayisi: number;
  guncellemeTarihi: string;
}

interface UniPukoClientProps {
  donemAdi: string;
  totalCriteriaCount: number;
  approvedItems: UniPukoCriterionItem[];
  driveFolderId: string;
}

export default function UniPukoClient({
  donemAdi,
  totalCriteriaCount,
  approvedItems,
  driveFolderId,
}: UniPukoClientProps) {
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleDownloadSingle = async (item: UniPukoCriterionItem) => {
    try {
      setDownloadingId(item.altOlcutId);
      const toastId = toast.loading(`${item.iaaKodu} PUKÖ Kontrol Formu ve Drive bağlantıları hazırlanıyor...`);

      const res = await fetch(`/api/uni-puko/export?alt_olcut_id=${item.altOlcutId}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Form oluşturulurken bir hata oluştu.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.iaaKodu}_PUKO_Kontrol_Formu.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`${item.iaaKodu} formu başarıyla indirildi!`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'İndirme sırasında hata oluştu.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadAllZip = async () => {
    if (approvedItems.length === 0) {
      toast.error('İndirilecek onaylı ölçüt bulunamadı.');
      return;
    }

    try {
      setIsDownloadingAll(true);
      const toastId = toast.loading(
        `Tüm onaylı ölçütler (${approvedItems.length} adet) Drive bağlantılarıyla hazırlanıyor. Lütfen bekleyin...`
      );

      const res = await fetch(`/api/uni-puko/export?all=true`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Toplu ZIP oluşturulurken bir hata oluştu.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ESOGU_Uni_PUKO_Kontrol_Formlari_${donemAdi}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Tüm onaylı formlar (${approvedItems.length} adet) ZIP olarak indirildi!`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Toplu indirme sırasında hata oluştu.');
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Üst Başlık ve Aksiyon Barı */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3">
            <FileCheck className="w-3.5 h-3.5" />
            Aktif Dönem: {donemAdi}
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Üniversite PUKÖ Kontrol ve ÖDR Kanıt Formları
          </h1>
          <p className="text-slate-600 font-medium mt-1">
            Yalnızca onaylanmış ölçütlerin verilerini, İAA – YÖKAK sabit eşleştirmelerini ve Google Drive kanıt köprülerini içeren resmi Word formlarını üretin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`https://drive.google.com/drive/folders/${driveFolderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-sm shadow-sm transition-all"
          >
            <ExternalLink className="w-4 h-4 text-blue-600" />
            Drive Kanıt Klasörü
          </a>

          <button
            onClick={handleDownloadAllZip}
            disabled={isDownloadingAll || approvedItems.length === 0}
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
          >
            {isDownloadingAll ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                ZIP Hazırlanıyor...
              </>
            ) : (
              <>
                <FolderArchive className="w-5 h-5" />
                Tüm Onaylı Formları İndir (.ZIP) ({approvedItems.length})
              </>
            )}
          </button>
        </div>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Toplam İAA Alt Ölçütü</p>
            <p className="text-2xl font-black text-slate-900">{totalCriteriaCount}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-emerald-700 text-xs font-bold uppercase tracking-wider">
              Üretime Hazır (Onaylanan)
            </p>
            <p className="text-2xl font-black text-emerald-800">{approvedItems.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-700">
            <FolderArchive className="w-6 h-6" />
          </div>
          <div>
            <p className="text-blue-700 text-xs font-bold uppercase tracking-wider">Toplam Drive Kanıt Bağlantısı</p>
            <p className="text-2xl font-black text-blue-900">
              {approvedItems.reduce((acc, item) => acc + item.kanitSayisi, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Onaylı Ölçütler Tablosu */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">İAA Ölçütü</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Eşleşen YÖKAK Ölçütü
                </th>
                <th className="px-5 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Süreç Sorumlusu</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-center">
                  Olgunluk
                </th>
                <th className="px-5 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-center">
                  Kanıt Sayısı
                </th>
                <th className="px-5 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {approvedItems.map(item => {
                const isSingleLoading = downloadingId === item.altOlcutId;
                return (
                  <tr key={item.altOlcutId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-mono text-xs font-black text-blue-900">{item.iaaKodu}</div>
                      <div className="text-sm font-bold text-slate-800 mt-0.5">{item.iaaAdi}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-mono text-xs font-bold text-emerald-700">{item.yokakKodu}</div>
                      <div className="text-xs font-medium text-slate-600 mt-0.5">{item.yokakAdi}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-slate-700">
                        <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-sm font-medium">{item.sorumluAdSoyad}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        {item.olgunlukPuani || '-'} / 5
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                        {item.kanitSayisi} Kanıt
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleDownloadSingle(item)}
                        disabled={isSingleLoading || isDownloadingAll}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer"
                      >
                        {isSingleLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Üretiliyor...
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            Formu İndir (.DOCX)
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {approvedItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">
                    Aktif dönemde henüz onaylanmış (onay_durumu = &apos;onaylandi&apos;) ölçüt raporu bulunmamaktadır.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
