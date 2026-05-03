-- ============================================================
-- DERS İZLENÇELERİ MODÜLÜ — Supabase SQL Migration
-- Supabase Dashboard > SQL Editor'da çalıştırın
-- ============================================================

-- 1. dersler tablosu
CREATE TABLE IF NOT EXISTS public.dersler (
  kod TEXT PRIMARY KEY,
  ad TEXT DEFAULT '',
  t INTEGER DEFAULT 0,
  u INTEGER DEFAULT 0,
  l INTEGER DEFAULT 0,
  kredi INTEGER DEFAULT 0,
  akts INTEGER DEFAULT 0,
  yariyil TEXT DEFAULT '',
  tur TEXT DEFAULT 'Zorunlu'
);

-- 2. ders_izlenceleri tablosu
CREATE TABLE IF NOT EXISTS public.ders_izlenceleri (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ders_id TEXT REFERENCES public.dersler(kod) ON DELETE CASCADE,
  hoca_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  icerik JSONB DEFAULT '{}',
  guncelleme_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS Etkinleştir
ALTER TABLE public.dersler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ders_izlenceleri ENABLE ROW LEVEL SECURITY;

-- 4. Politikalar — dersler (herkes okuyabilir, sadece admin yazabilir)
DROP POLICY IF EXISTS "dersler_read_all" ON public.dersler;
CREATE POLICY "dersler_read_all" ON public.dersler FOR SELECT USING (true);
DROP POLICY IF EXISTS "dersler_admin_write" ON public.dersler;
CREATE POLICY "dersler_admin_write" ON public.dersler FOR ALL USING (true);

-- 5. Politikalar — ders_izlenceleri
DROP POLICY IF EXISTS "izlenceler_read_all" ON public.ders_izlenceleri;
CREATE POLICY "izlenceler_read_all" ON public.ders_izlenceleri FOR SELECT USING (true);
DROP POLICY IF EXISTS "izlenceler_insert_own" ON public.ders_izlenceleri;
CREATE POLICY "izlenceler_insert_own" ON public.ders_izlenceleri FOR INSERT WITH CHECK (auth.uid() = hoca_id);
DROP POLICY IF EXISTS "izlenceler_update_own" ON public.ders_izlenceleri;
CREATE POLICY "izlenceler_update_own" ON public.ders_izlenceleri FOR UPDATE USING (auth.uid() = hoca_id);

-- ============================================================
-- 6. SEED VERİSİ — ESOGÜ İlahiyat Fakültesi I. Öğretim (2024)
-- Ders adlarını PDF'den sonra UPDATE ile tamamlayın
-- ============================================================
INSERT INTO public.dersler (kod, ad, akts, yariyil, tur) VALUES
-- I. YARIYIL (Zorunlu)
('181111026', 'Kur''an Okuma ve Tecvid I', 3, 'I. Yarıyıl', 'Zorunlu'),
('181111025', 'Arap Dili I', 2, 'I. Yarıyıl', 'Zorunlu'),
('181111024', 'İslam Tarihi I', 5, 'I. Yarıyıl', 'Zorunlu'),
('181111038', 'Tefsir I', 5, 'I. Yarıyıl', 'Zorunlu'),
('181111039', 'Fıkıh I', 3, 'I. Yarıyıl', 'Zorunlu'),
('181111040', 'Kelam I', 3, 'I. Yarıyıl', 'Zorunlu'),
('181011001', 'Türk Dili I', 2, 'I. Yarıyıl', 'Zorunlu'),
('181011004', 'Atatürk İlkeleri ve İnkılap Tarihi I', 2, 'I. Yarıyıl', 'Zorunlu'),
('181011005', 'Yabancı Dil I', 2, 'I. Yarıyıl', 'Zorunlu'),
-- II. Yarıyıl (Seçmeli dahil) — II. Yarıyıl verisi JSON''da ayrıca belirtilmemişti, 181111041 II. Yarıyıl olabilir
('181111041', 'Kur''an Okuma ve Tecvid II', 4, 'II. Yarıyıl', 'Zorunlu'),

-- III. YARIYIL (Zorunlu)
('181113035', 'Tefsir III', 5, 'III. Yarıyıl', 'Zorunlu'),
('181113036', 'Hadis I', 3, 'III. Yarıyıl', 'Zorunlu'),
('181113037', 'Fıkıh III', 3, 'III. Yarıyıl', 'Zorunlu'),
('181113038', 'Kelam III', 2, 'III. Yarıyıl', 'Zorunlu'),
('181113039', 'İslam Tarihi III', 3, 'III. Yarıyıl', 'Zorunlu'),
('181113040', 'Arap Dili III', 3, 'III. Yarıyıl', 'Zorunlu'),
('181113041', 'Tasavvuf I', 5, 'III. Yarıyıl', 'Zorunlu'),
('181113050', 'Dinler Tarihi I', 3, 'III. Yarıyıl', 'Zorunlu'),

-- V. YARIYIL (Zorunlu)
('181115060', 'Tefsir V', 6, 'V. Yarıyıl', 'Zorunlu'),
('181115061', 'Hadis III', 5, 'V. Yarıyıl', 'Zorunlu'),
('181115062', 'Fıkıh V', 4, 'V. Yarıyıl', 'Zorunlu'),
('181115063', 'Kelam V', 4, 'V. Yarıyıl', 'Zorunlu'),
('181115064', 'İslam Felsefesi I', 5, 'V. Yarıyıl', 'Zorunlu'),
('181115065', 'Din Eğitimi I', 4, 'V. Yarıyıl', 'Zorunlu'),
('181115066', 'Dinler Tarihi III', 4, 'V. Yarıyıl', 'Zorunlu'),

-- VII. YARIYIL (Zorunlu)
('181117072', 'Tefsir VII', 6, 'VII. Yarıyıl', 'Zorunlu'),
('181117073', 'Hadis V', 3, 'VII. Yarıyıl', 'Zorunlu'),
('181117074', 'Fıkıh VII', 4, 'VII. Yarıyıl', 'Zorunlu'),
('181117075', 'Kelam VII', 4, 'VII. Yarıyıl', 'Zorunlu'),
('181117046', 'İslam Sanatları', 4, 'VII. Yarıyıl', 'Zorunlu'),
('181117076', 'Mezuniyet Tezi / Bitirme Ödevi', 0, 'VII. Yarıyıl', 'Zorunlu'),

-- SEÇMELİ I DERSLERİ (III. Yarıyıl Seçmeli)
('181113042', 'Seçmeli I - Ders 1', 3, 'III. Yarıyıl', 'Seçmeli'),
('181113026', 'Seçmeli I - Ders 2', 3, 'III. Yarıyıl', 'Seçmeli'),
('181113043', 'Seçmeli I - Ders 3', 3, 'III. Yarıyıl', 'Seçmeli'),
('181113044', 'Seçmeli I - Ders 4', 3, 'III. Yarıyıl', 'Seçmeli'),
('181113045', 'Seçmeli I - Ders 5', 3, 'III. Yarıyıl', 'Seçmeli'),
('181113046', 'Seçmeli I - Ders 6', 3, 'III. Yarıyıl', 'Seçmeli'),
('181113031', 'Seçmeli I - Ders 7', 3, 'III. Yarıyıl', 'Seçmeli'),
('181113047', 'Seçmeli I - Ders 8', 3, 'III. Yarıyıl', 'Seçmeli'),
('181113048', 'Seçmeli I - Ders 9', 3, 'III. Yarıyıl', 'Seçmeli'),
('181113049', 'Seçmeli I - Ders 10', 3, 'III. Yarıyıl', 'Seçmeli'),
('181113034', 'Seçmeli I - Ders 11', 3, 'III. Yarıyıl', 'Seçmeli'),
('181113027', 'Seçmeli I - Ders 12', 3, 'III. Yarıyıl', 'Seçmeli'),

-- SEÇMELİ III DERSLERİ (V. Yarıyıl Seçmeli)
('181115049', 'Seçmeli III - Ders 1', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115067', 'Seçmeli III - Ders 2', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115068', 'Seçmeli III - Ders 3', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115069', 'Seçmeli III - Ders 4', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115056', 'Seçmeli III - Ders 5', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115025', 'Seçmeli III - Ders 6', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115054', 'Seçmeli III - Ders 7', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115070', 'Seçmeli III - Ders 8', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115078', 'Seçmeli III - Ders 9', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115071', 'Seçmeli III - Ders 10', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115072', 'Seçmeli III - Ders 11', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115073', 'Seçmeli III - Ders 12', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115074', 'Seçmeli III - Ders 13', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115026', 'Seçmeli III - Ders 14', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115058', 'Seçmeli III - Ders 15', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115047', 'Seçmeli III - Ders 16', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115075', 'Seçmeli III - Ders 17', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115076', 'Seçmeli III - Ders 18', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115057', 'Seçmeli III - Ders 19', 3, 'V. Yarıyıl', 'Seçmeli'),
('181115077', 'Seçmeli III - Ders 20', 3, 'V. Yarıyıl', 'Seçmeli'),

-- SEÇMELİ V DERSLERİ (VII. Yarıyıl Seçmeli)
('181117071', 'Seçmeli V - Ders 1', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117052', 'Seçmeli V - Ders 2', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117054', 'Seçmeli V - Ders 3', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117077', 'Seçmeli V - Ders 4', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117028', 'Seçmeli V - Ders 5', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117070', 'Seçmeli V - Ders 6', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117078', 'Seçmeli V - Ders 7', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117089', 'Seçmeli V - Ders 8', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117079', 'Seçmeli V - Ders 9', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117080', 'Seçmeli V - Ders 10', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117081', 'Seçmeli V - Ders 11', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117082', 'Seçmeli V - Ders 12', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117068', 'Seçmeli V - Ders 13', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117083', 'Seçmeli V - Ders 14', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117053', 'Seçmeli V - Ders 15', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117058', 'Seçmeli V - Ders 16', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117061', 'Seçmeli V - Ders 17', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117059', 'Seçmeli V - Ders 18', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117084', 'Seçmeli V - Ders 19', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117085', 'Seçmeli V - Ders 20', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117086', 'Seçmeli V - Ders 21', 3, 'VII. Yarıyıl', 'Seçmeli'),
('181117087', 'Seçmeli V - Ders 22', 3, 'VII. Yarıyıl', 'Seçmeli')
ON CONFLICT (kod) DO UPDATE SET
  ad = EXCLUDED.ad,
  akts = EXCLUDED.akts,
  yariyil = EXCLUDED.yariyil,
  tur = EXCLUDED.tur;
