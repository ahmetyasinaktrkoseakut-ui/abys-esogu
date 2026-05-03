'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import { Search, Send, User } from 'lucide-react';

interface Profile {
  id: string;
  tam_adi: string;
  unvan: string;
}

interface Message {
  id: number;
  gonderen_id: string;
  alici_id: string;
  mesaj: string;
  okundu: boolean;
  olusturulma_tarihi: string;
}

export default function IletisimClient({ currentUserId }: { currentUserId: string }) {
  const t = useTranslations('Messaging');
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchUsers() {
      const { data, error } = await supabase.rpc('get_kullanicilar');
      if (data) {
        const uniqueUsersMap = new Map();
        data
          .filter((u: any) => String(u.id) !== String(currentUserId))
          .filter((u: any) => {
            const name = (u.meta_data?.name || u.meta_data?.full_name || u.meta_data?.ad_soyad || u.meta_data?.ad || u.email || '').toLowerCase();
            // Kullanıcı 'tarsalih' ismini kesinlikle istemiyor
            return !name.includes('tarsalih');
          })
          .forEach((u: any) => {
            let name = u.meta_data?.name || u.meta_data?.full_name || u.meta_data?.ad_soyad || u.meta_data?.ad;
            if (!name) {
              const email = u.email || '';
              const prefix = email.split('@')[0];
              name = prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : 'Kullanıcı';
            }
            
            const dedupeKey = name.toLowerCase().trim();
            
            if (!uniqueUsersMap.has(dedupeKey)) {
              uniqueUsersMap.set(dedupeKey, {
                id: u.id,
                tam_adi: name,
                unvan: u.meta_data?.unvan || 'Personel'
              });
            }
          });
        setUsers(Array.from(uniqueUsersMap.values()));
      }
    }
    fetchUsers();
  }, [currentUserId]);

  useEffect(() => {
    if (!selectedUser) return;

    async function fetchMessages() {
      const { data, error } = await supabase
        .from('mesajlar')
        .select('*')
        .or(`and(gonderen_id.eq.${currentUserId},alici_id.eq.${selectedUser?.id}),and(gonderen_id.eq.${selectedUser?.id},alici_id.eq.${currentUserId})`)
        .order('olusturulma_tarihi', { ascending: true });
      if (data) setMessages(data);
    }

    async function markAsRead() {
      await supabase
        .from('mesajlar')
        .update({ okundu: true })
        .eq('alici_id', currentUserId)
        .eq('gonderen_id', selectedUser?.id)
        .eq('okundu', false);
    }

    fetchMessages();
    markAsRead();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mesajlar',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (
            (newMsg.gonderen_id === currentUserId && newMsg.alici_id === selectedUser?.id) ||
            (newMsg.gonderen_id === selectedUser?.id && newMsg.alici_id === currentUserId)
          ) {
            setMessages((prev) => [...prev, newMsg]);
            
            // If the message is for me and I'm currently in the chat, mark it as read
            if (newMsg.alici_id === currentUserId && newMsg.gonderen_id === selectedUser?.id) {
              markAsRead();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUser, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    const { error } = await supabase.from('mesajlar').insert({
      gonderen_id: currentUserId,
      alici_id: selectedUser.id,
      mesaj: newMessage.trim(),
      okundu: false,
      olusturulma_tarihi: new Date().toISOString()
    });

    if (!error) {
      setNewMessage('');
    }
  };

  const filteredUsers = users.filter((u) =>
    u.tam_adi?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-100px)] bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
      {/* User List */}
      <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="text-xl font-bold text-slate-800 mb-4">{t('title')}</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('search_user')}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className={`w-full p-4 flex items-center gap-3 transition-colors hover:bg-white ${
                selectedUser?.id === user.id ? 'bg-white border-r-4 border-blue-600' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                {user.tam_adi?.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-800 text-sm">{user.tam_adi}</div>
                <div className="text-xs text-slate-500">{user.unvan}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedUser ? (
          <>
            <div className="p-4 border-b border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                {selectedUser.tam_adi?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-slate-800">{selectedUser.tam_adi}</div>
                <div className="text-xs text-slate-500">{selectedUser.unvan}</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.gonderen_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] p-3 rounded-2xl text-sm ${
                      msg.gonderen_id === currentUserId
                        ? 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-100'
                        : 'bg-white text-slate-800 rounded-tl-none border border-slate-200 shadow-sm'
                    }`}
                  >
                    {msg.mesaj}
                    <div className={`text-[10px] mt-1 opacity-70 ${msg.gonderen_id === currentUserId ? 'text-right' : 'text-left'}`}>
                      {msg.olusturulma_tarihi ? new Date(msg.olusturulma_tarihi).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t('type_message')}
                  className="flex-1 px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <User className="w-10 h-10" />
            </div>
            <p>{t('no_user_selected')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
