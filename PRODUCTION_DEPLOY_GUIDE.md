# AI Context Brain - Production Canlıya Geçiş & Yayınlama Kılavuzu

Bu kılavuz, AI Context Brain platformunun backend, web dashboard ve VS Code / Cursor / Windsurf eklentilerinin canlı ortama (production) nasıl kurulacağını, paketleneceğini ve yayınlanacağını adım adım açıklar.

---

## 🎯 Platform Bileşenleri ve Durum Raporu

AI Context Brain platformunun tüm temel bileşenleri ve gelişmiş özellikleri başarıyla uygulanmış ve doğrulanmıştır:

### 1. Backend Servisi (.NET 9)
*   **PostgreSQL Veritabanı**: Supabase üzerinden canlı veritabanı şeması ve migration'ları güncel.
*   **Güvenli Yetkilendirme**: Token tabanlı JWT oturum yönetimi, şifrelenmiş refresh token'lar ve harici tarayıcı tabanlı OAuth (`/authorize`) kanalı hazır.
*   **Gelişmiş Kural Motoru (Architecture Guard)**: C# tarafında yapılandırılmış 6 kural tipi (Regex, FolderRestriction, ContentForbidden, ImportRestriction, NamingConvention, FileSizeLimit) ve 3 önem derecesi (Error, Warning, Info) aktif.
*   **Hızlı AI Çözümleri**: Kod ihlallerine yönelik deterministik ve AI destekli düzeltme önerileri üreten `/suggest-fix` endpoint'i aktif.
*   **Hibrit AI Katmanı**: Gemini API anahtarlarıyla çalışan ve OpenAI yedekli çalışan akıllı bağlam sıkıştırma servisi aktif.

### 2. Web Kontrol Paneli (React + Vite + Tailwind)
*   **Premium Landing Sayfası**: Linear / Raycast standartlarında modern koyu tema, hareketli editör önizlemeleri, etkileşimli "Fix with AI" simülatörü ve SEO dostu yapı.
*   **Kullanıcı Portalı**: Proje tarama geçmişleri, kural yönetim arayüzü ve abonelik paketleri.

### 3. VS Code / IDE Eklentisi
*   **🔒 `.brainignore` Desteği**: Gereksiz dosyaların LLM bağlamını şişirmesini (.gitignore ile birleşik glob filtreleri kullanarak) engelleyen yerel tarama modülü aktif.
*   **⚡ SHA-256 Artırımlı (Incremental) Tarama**: `.brain-cache/hashes.json` üzerinde dosya imzalarını saklayıp sadece yeni/değişen dosyaları tarayan ve API yükünü %90 azaltan servis aktif.
*   **📡 Debounced Dosya İzleyici**: Arka planda kod değişikliklerini debounced (gecikmeli) olarak izleyip otomatik senkronizasyon tetikleyen izleyici aktif.
*   **🔧 "Fix with AI" CodeAction**: İhlal satırlarında VS Code üzerinde ampul ikonunu çıkartıp backend'den gelen düzeltmeleri tek tıkla uygulayan QuickFix entegrasyonu aktif.

---

## 🚀 SUNUCU KURULUM ADIMLARI (Ubuntu + Nginx)

### 1. Sunucu Hazırlık ve Çalışma Zamanı Kurulumu
Sunucuda `.NET 9` çalışma zamanını ve Nginx'i kurun:

```bash
# .NET 9 Paketlerini Ekle ve Kur
wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
sudo apt-get update
sudo apt-get install -y aspnetcore-runtime-9.0

# Nginx & Certbot (SSL) Kurulumu
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### 2. Backend Deploy (Yayınlama)
Yerel bilgisayarınızda backend projesini derleyip sunucuya aktarın:

```bash
cd backend
dotnet publish -c Release -o ./publish
# ./publish klasörünü sunucuda /var/www/ai-context-brain konumuna kopyalayın
```

Sunucu tarafında `.env` dosyasını yapılandırın:
```env
DATABASE_URL=Host=aws-0-eu-west-1.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres...
GEMINI_API_KEYS=Sizin-Gemini-Anahtariniz
OPENAI_API_KEYS=Sizin-OpenAI-Anahtariniz
JWT_SECRET=En-Az-64-Karakterli-Guclu-JWT-Anahtari
CORS_ORIGINS=https://aicontextbrain.me,https://www.aicontextbrain.me
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://localhost:5001
```

`.NET` uygulamasını arka planda sürekli çalıştırmak için systemd servisi oluşturun:
`sudo nano /etc/systemd/system/ai-context-brain.service`

```ini
[Unit]
Description=AI Context Brain API Service
After=network.target

[Service]
WorkingDirectory=/var/www/ai-context-brain
ExecStart=/usr/bin/dotnet /var/www/ai-context-brain/AiContextBrain.dll
Restart=always
RestartSec=10
SyslogIdentifier=ai-context-brain
User=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production

[Install]
WantedBy=multi-user.target
```

Servisi etkinleştirip başlatın:
```bash
sudo systemctl enable ai-context-brain
sudo systemctl start ai-context-brain
sudo systemctl status ai-context-brain
```

### 3. Web Dashboard Static Deploy
Web projesini build edin ve Nginx statik klasörüne taşıyın:

```bash
cd web-dashboard
# .env dosyasında VITE_API_BASE_URL=https://aicontextbrain.me/api olarak ayarlayın
npm run build
# dist/ klasörünü sunucuda /var/www/web-dashboard konumuna kopyalayın
```

### 4. Nginx Reverse Proxy & SSL Sertifikasyon
`sudo nano /etc/nginx/sites-available/aicontextbrain` dosyasını oluşturun ve yapılandırın:

```nginx
server {
    listen 80;
    server_name aicontextbrain.me www.aicontextbrain.me;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name aicontextbrain.me www.aicontextbrain.me;

    ssl_certificate /etc/letsencrypt/live/aicontextbrain.me/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aicontextbrain.me/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Frontend Statik Dağıtımı
    location / {
        root /var/www/web-dashboard;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }

    # API Yönlendirme (Reverse Proxy)
    location /api/ {
        proxy_pass http://localhost:5001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection keep-alive;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Nginx'i test edin ve yeniden başlatın:
```bash
sudo ln -s /etc/nginx/sites-available/aicontextbrain /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Let's Encrypt SSL sertifikasını alın
sudo certbot --nginx -d aicontextbrain.me -d www.aicontextbrain.me
```

---

## 🔌 VS CODE EKLENTISI YAYINLAMA

### 1. Paketleme (VSIX Oluşturma)
Eklentiyi derleyip yerel olarak test etmek veya manuel yüklemek için `.vsix` paketi haline getirin:

```bash
cd vscode-extension
npm install
npm run compile
npx vsce package
# Çıktı: ai-context-brain-1.3.0.vsix
```

### 2. VS Code Marketplace Yayınlama Adımları
1.  **Azure DevOps** hesabı oluşturun ve giriş yapın.
2.  **Personal Access Token (PAT)** alın:
    *   Organization Settings -> Users -> Personal Access Tokens adımlarını takip edin.
    *   Scope kısmında **Marketplace (Acquire + Publish)** yetkisini seçin.
3.  Eklentiyi yayınlayın:
    ```bash
    # Publisher oluşturun (tarayıcıdan veya CLI'dan)
    npx vsce create-publisher ai-context-brain
    # Login olun ve token'ı yapıştırın
    npx vsce login ai-context-brain
    # Eklentiyi yayınlayın
    npx vsce publish
    ```
 Eklentiniz 5-10 dakika içerisinde VS Code Marketplace, Cursor ve Windsurf mağazalarında indirilebilir hale gelecektir.
