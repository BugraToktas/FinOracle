# FinOracle — Görev Takip Listesi

## ✅ TAMAMLANDI

### Kritik Bug Fixes
- [x] **EventDetail.jsx** — `getEventById` ve `deleteEvent` import'ları eklendi (crash fix)
- [x] **Admin.jsx** — `authLoading` guard eklendi; admin kullanıcı auth yüklenmeden redirect edilmiyordu (race condition fix)

### Package / Config
- [x] **package.json** — Proje adı `"denenme"` → `"finoracle"` olarak güncellendi

### i18n / Lokalizasyon
- [x] **Login.jsx** — Signup başarı mesajı hardcoded İngilizce'den `t('auth.signUpSuccess')` key'ine taşındı
- [x] **en.js + tr.js** — `auth.signUpSuccess` key'i her iki dile eklendi
- [x] **EventDetail.jsx** — `"New analysis"` hardcoded string `t('eventDetail.newAnalysis')` ile değiştirildi

### Backend Güvenlik & Doğruluk
- [x] **ask_finoracle** — Backend rate limiting eklendi; kullanıcı başına günlük 10 analiz DB'de kontrol edilip `429` döndürülüyor (önceden sadece frontend kontrol vardı)
- [x] **ask_finoracle** — `analysis_document_links` artık LLM'in gerçek `citedSources`'ını (used_indices) bağlıyor; önceden her zaman ilk 5 doc sabit bağlanıyordu
- [x] **ask_finoracle + verify_analysis + run_verification_queue** — CORS `"*"` wildcard yerine `ALLOWED_ORIGIN` env var destekli hale getirildi; production'da domain kısıtlanabilir
- [x] **verify_analysis** — Recheck'e orijinal analiz kaynak dokümanları (`analysis_document_links`) dahil edildi; LLM artık boş context yerine gerçek kaynaklarla değerlendiriyor
- [x] **llm_proxy** — Recheck prompt'u `source_priors` parametresini kabul edecek şekilde güncellendi

---

## 🔵 YAPILACAK — İyileştirmeler

### Yüksek Öncelik
- [ ] **ALLOWED_ORIGIN env var** — Supabase Dashboard > Edge Functions > Secrets'a `ALLOWED_ORIGIN=https://[domain]` ekle (manuel adım)
- [ ] **Landing.jsx** — `ctaSub` metni `"10 analyses per day"` yazıyor; gerçek limit 5 (veya 10 ise landing'deki 5 yazan yer varsa güncelle — tutarlılık)
- [ ] **analysisService.js** — Hata mesajları Supabase internal detaylarını kullanıcıya yansıtıyor; kullanıcı dostu generic mesajlara dönüştür

### Orta Öncelik
- [ ] **Events.jsx** — Status filtresi client-side 200 kayıt çekip JS'de filtriliyor; Supabase sorgusuna taşı
- [ ] **Events.jsx** — Hard-coded `limit(200)`; infinite scroll veya sayfalama ekle
- [ ] **Dashboard.jsx** — Yeni kullanıcıda chart alanları `—` gösteriyor; skeleton veya "No data yet" placeholder ekle
- [ ] **NewEvent.jsx** — Analiz süresi 15-30sn olabiliyor; kullanıcıya adım adım ilerleme göstergesi ekle (örn. "Kaynaklar alınıyor… → Analiz üretiliyor…")
- [ ] **supabase/functions/analyze_market_event/** — Boş/tamamlanmamış klasör; ya tamamla ya sil
- [ ] **Deno tsconfig** — Edge function'larda IDE `Deno.*` tanımıyor; `supabase/functions/` altına `deno.json` ekle (deploy'u etkilemez, geliştirici deneyimi için)

### Düşük Öncelik / Roadmap
- [ ] **Pro tier / Stripe subscription** — Ücretli plan altyapısı
- [ ] **Email notifications** — Analiz tamamlandığında / recheck sonucunda bildirim
- [ ] **Admin panel** — Kullanıcı yönetimi genişletme (ban, limit değiştirme, tier atama)
- [ ] **Credibility Board** — Kaynak bazlı filtreleme / sıralama seçenekleri
- [ ] **EventDetail** — Analiz silme yetkisi sadece sahibine göre RLS ile daha sıkı kısıtlanabilir

---

## 🧪 MANUEL TEST KONTROL LİSTESİ

### UI Testleri
- [ ] Yeni kullanıcı kaydı → onay maili Türkçe/İngilizce doğru gösteriyor mu?
- [ ] Google OAuth login çalışıyor mu?
- [ ] EventDetail sayfası açılıyor mu? (önceki crash fix kontrolü)
- [ ] Admin kullanıcı Admin sayfasına erişebiliyor mu? (loading guard kontrolü)
- [ ] Admin olmayan kullanıcı `/admin`'e gidince dashboard'a yönlendiriliyor mu?
- [ ] Dil değiştirince tüm sayfalar doğru çeviri gösteriyor mu?
- [ ] Yeni analiz oluştururken asset inference çalışıyor mu?

### Supabase / Backend Testleri
- [ ] `ask_finoracle` edge function direkt çağrıldığında (JWT olmadan) rate limit devreye giriyor mu?
- [ ] Günlük 10 analiz dolunca `429` dönüyor mu?
- [ ] `verify_analysis` tetiklendiğinde `revalidations` tablosuna kayıt ekleniyor mu?
- [ ] `analysis_document_links` tablosunda LLM'in gerçekten kullandığı kaynaklar mı bağlanıyor?
- [ ] `run_verification_queue` Admin panelinden tetiklenebiliyor mu?
- [ ] pgvector semantic search sorgusu (`match_source_documents` RPC) çalışıyor mu?
- [ ] RLS politikaları: Kullanıcı sadece kendi analizlerini görebiliyor mu?
