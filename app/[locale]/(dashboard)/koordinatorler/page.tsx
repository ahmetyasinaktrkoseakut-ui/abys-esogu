'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Save, Users, AlertCircle, CheckCircle2, Search, Trash2 } from 'lucide-react';

const TOPICS = [
  'Kalite Güvencesi',
  'Eğitim-Öğretim',
  'Araştırma ve Geliştirme',
  'Toplumsal Katkı',
  'Yönetim Sistemi'
];

export default function KoordinatorlerPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [coordinators, setCoordinators] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setMessage(null);
      
      const { data: profiles, error: pError } = await supabase
        .from('profiller')
        .select('*');
        
      if (pError) throw pError;
      setUsers(profiles || []);

      const { data: coords, error: cError } = await supabase
        .from('baslik_koordinatorleri')
        .select('*');
        
      if (cError) throw cError;
      setCoordinators(coords || []);

    } catch (error: any) {
      console.error('Error fetching data:', error);
      setMessage({ 
        type: 'error', 
        text: `Veriler yüklenirken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}` 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUser || !selectedTopic) {
      setMessage({ type: 'error', text: 'Lütfen kullanıcı ve başlık seçiniz.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      // Önce bu kullanıcının mevcut atamasını silelim veya üstüne yazalım
      // Supabase upsert için primary key gerekir. Tabloda id varsa upsert yaparız. 
      // Biz doğrudan eskiyi silip yenisini ekleyelim veya upsert kullanalım.
      // Sütunların kullanici_id ve baslik olduğunu biliyoruz.
      
      // Kullanıcı zaten bir başlığa atanmışsa onu silelim
      await supabase
        .from('baslik_koordinatorleri')
        .delete()
        .eq('kullanici_id', selectedUser);

      const { error } = await supabase
        .from('baslik_koordinatorleri')
        .insert({
          kullanici_id: selectedUser,
          baslik: selectedTopic
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Koordinatör başarıyla atandı.' });
      setSelectedUser('');
      setSelectedTopic('');
      fetchData(); // Listeyi yenile
    } catch (error: any) {
      console.error('Save error:', error);
      setMessage({ type: 'error', text: 'Atama kaydedilirken hata oluştu: ' + error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (kullanici_id: string) => {
    if (!window.confirm('Bu atamayı silmek istediğinize emin misiniz?')) return;
    
    try {
      const { error } = await supabase
        .from('baslik_koordinatorleri')
        .delete()
        .eq('kullanici_id', kullanici_id);
        
      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Atama silindi.' });
      fetchData();
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Silinirken hata oluştu.' });
    }
  };

  const filteredUsers = users.filter(u => 
    (u.ad_soyad || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 mx-auto max-w-5xl animate-in fade-in duration-500">
      <div className="mb-8 border-b border-slate-200 pb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-600" />
            Başlık Koordinatörleri
          </h2>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl">
            Bu ekrandan 5 ana başlık için koordinatör ataması yapabilirsiniz. Koordinatörler, kendi başlıkları altındaki ölçütleri birimlere dağıtabilir ve gelen veri girişlerini onaylayıp reddedebilir.
          </p>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <AlertCircle className="w-5 h-5 mt-0.5" />}
          <div>
            <h3 className="text-sm font-semibold">{message.type === 'success' ? 'Başarılı' : 'Hata'}</h3>
            <p className="text-sm opacity-90">{message.text}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Atama Formu */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4 border-b pb-2">Yeni Atama Yap</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kullanıcı Arama</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="İsim veya E-posta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kullanıcı Seçin</label>
              <select 
                value={selectedUser} 
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm bg-slate-50"
              >
                <option value="">-- Kullanıcı Seç --</option>
                {filteredUsers.slice(0, 50).map(u => (
                  <option key={u.id} value={u.id}>{u.unvan || ''} {u.ad_soyad || 'İsimsiz'} ({u.email})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sorumlu Olacağı Başlık</label>
              <select 
                value={selectedTopic} 
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm bg-slate-50"
              >
                <option value="">-- Başlık Seç --</option>
                {TOPICS.map(topic => (
                  <option key={topic} value={topic}>{topic}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleAssign}
              disabled={isSaving || !selectedUser || !selectedTopic}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Atamayı Kaydet
            </button>
          </div>
        </div>

        {/* Mevcut Atamalar Listesi */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full">
          <h3 className="font-semibold text-slate-800 mb-4 border-b pb-2">Mevcut Koordinatörler</h3>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
            ) : coordinators.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">Henüz atanmış bir koordinatör yok.</div>
            ) : (
              coordinators.map(coord => {
                const user = users.find(u => u.id === coord.kullanici_id);
                return (
                  <div key={coord.kullanici_id + coord.baslik} className="flex items-center justify-between p-3 border rounded-xl bg-slate-50">
                    <div>
                      <div className="font-semibold text-sm text-slate-800">
                        {user ? `${user.unvan || ''} ${user.ad_soyad || ''}` : 'Bilinmeyen Kullanıcı'}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{user?.email}</div>
                      <div className="inline-flex mt-2 px-2 py-1 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-md">
                        {coord.baslik}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemove(coord.kullanici_id)}
                      className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                      title="Atamayı Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
