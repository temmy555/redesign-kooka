# AWS Lightsail Docker Deployment

Panduan ini untuk deployment testing/soft launch KOOKA di satu instance AWS Lightsail 2GB RAM dengan:

- Next.js app
- PostgreSQL di server yang sama
- Worker email/PDF
- Storage lokal Docker volume
- Tanpa Redis
- Tanpa Mailpit
- Email production melalui SMTP Hostinger

## 1. Target arsitektur

```text
Internet
  ↓
Hostinger DNS
  ↓
AWS Lightsail Static IP
  ↓
Nginx + SSL
  ↓
Docker app :3000
  ↓
Docker PostgreSQL + private storage volume
```

Port yang perlu dibuka di firewall Lightsail:

- `22` untuk SSH
- `80` untuk HTTP
- `443` untuk HTTPS

Jangan expose PostgreSQL ke publik.

## 2. Siapkan swap 4GB

Jalankan di server AWS:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

Swap membantu server 2GB tetap aman saat build Docker, restart, atau beban naik.

## 3. Install Docker

Untuk Ubuntu server:

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Logout SSH lalu login lagi, kemudian cek:

```bash
docker --version
docker compose version
```

## 4. Upload atau clone project

Contoh lokasi:

```bash
mkdir -p ~/apps
cd ~/apps
git clone <URL_REPOSITORY_ANDA> redesign-kooka
cd redesign-kooka
```

Jika repository private, setup SSH key GitHub/GitLab lebih dulu.

## 5. Isi environment production

```bash
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Minimal yang harus diganti:

- `APP_URL`
- `BETTER_AUTH_SECRET`
- `DATA_ENCRYPTION_KEY`
- `POSTGRES_PASSWORD`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

Untuk membuat secret:

```bash
openssl rand -base64 32
```

Gunakan hasil berbeda untuk `BETTER_AUTH_SECRET` dan `DATA_ENCRYPTION_KEY`.

## 6. Build dan jalankan database

```bash
docker compose --env-file .env.production -f infra/compose.production.yaml build
docker compose --env-file .env.production -f infra/compose.production.yaml up -d postgres
```

## 7. Jalankan migration

Migration production perlu konfirmasi eksplisit:

```bash
docker compose --env-file .env.production -f infra/compose.production.yaml run --rm -e ALLOW_PRODUCTION_MIGRATION=YES app node scripts/db.mjs migrate
```

Cek status:

```bash
docker compose --env-file .env.production -f infra/compose.production.yaml run --rm -e ALLOW_PRODUCTION_MIGRATION=YES app node scripts/db.mjs status
```

## 8. Jalankan aplikasi dan worker

```bash
docker compose --env-file .env.production -f infra/compose.production.yaml up -d app worker
docker compose --env-file .env.production -f infra/compose.production.yaml ps
```

Cek log:

```bash
docker compose --env-file .env.production -f infra/compose.production.yaml logs -f app
docker compose --env-file .env.production -f infra/compose.production.yaml logs -f worker
```

### 8.1 Buat akun Owner pertama

Migration menyiapkan tabel login, role, dan permission, tetapi tidak otomatis membuat akun production. Akun pertama dibuat sekali saja lewat bootstrap Owner.

Tambahkan token sementara di `.env.production`:

```bash
openssl rand -hex 32
nano .env.production
```

Isi:

```bash
OWNER_BOOTSTRAP_TOKEN=hasil-token-dari-openssl
```

Restart aplikasi agar token terbaca:

```bash
docker compose --env-file .env.production -f infra/compose.production.yaml up -d app worker
```

Buat akun Owner:

```bash
curl -X POST http://127.0.0.1:3000/api/setup/bootstrap-owner \
  -H "Authorization: Bearer hasil-token-dari-openssl" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Temmy Kurniawan",
    "email": "email-owner@domain.com",
    "password": "password-minimal-12-karakter",
    "employeeCode": "OWNER-001",
    "propertyCode": "KOOKA-SBY",
    "propertyName": "KOOKA Residence Surabaya"
  }'
```

Jika berhasil, response berisi:

```json
{"status":"owner_bootstrapped"}
```

Setelah akun berhasil dibuat, hapus lagi `OWNER_BOOTSTRAP_TOKEN` dari `.env.production`, lalu restart:

```bash
docker compose --env-file .env.production -f infra/compose.production.yaml up -d app worker
```

Setelah itu login melalui:

```text
https://kookaresidencesby.com/staff/login
```

## 9. Setup Nginx

Install Nginx dan Certbot:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Buat config:

```bash
sudo nano /etc/nginx/sites-available/kookaresidencesby.com
```

Isi:

```nginx
server {
    listen 80;
    server_name kookaresidencesby.com www.kookaresidencesby.com;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Aktifkan:

```bash
sudo ln -s /etc/nginx/sites-available/kookaresidencesby.com /etc/nginx/sites-enabled/kookaresidencesby.com
sudo nginx -t
sudo systemctl reload nginx
```

## 10. Arahkan DNS dari Hostinger

Di DNS Zone Hostinger:

- `A` record `@` arahkan ke Static IP Lightsail
- `A` record `www` arahkan ke Static IP Lightsail

Jangan ubah MX record kalau email masih memakai Hostinger.

Setelah DNS mengarah, jalankan SSL:

```bash
sudo certbot --nginx -d kookaresidencesby.com -d www.kookaresidencesby.com
```

## 11. Jika website timeout setelah DNS benar

Jika browser menampilkan `ERR_CONNECTION_TIMED_OUT`, biasanya request belum masuk ke Nginx/server. Cek berurutan dari server AWS:

### 11.1 Pastikan app Docker hidup

```bash
cd ~/apps/redesign-kooka
docker compose --env-file .env.production -f infra/compose.production.yaml ps
docker compose --env-file .env.production -f infra/compose.production.yaml logs --tail=80 app
docker compose --env-file .env.production -f infra/compose.production.yaml logs --tail=80 worker
```

Status `app`, `worker`, dan `postgres` seharusnya `running` atau `healthy`.

### 11.2 Test app dari dalam server

```bash
curl -I http://127.0.0.1:3000
```

Jika ini gagal, masalahnya ada di Docker/app. Jalankan:

```bash
docker compose --env-file .env.production -f infra/compose.production.yaml up -d app worker
```

### 11.3 Test Nginx dari dalam server

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager
curl -I http://127.0.0.1
```

Jika `127.0.0.1:3000` berhasil tapi `127.0.0.1` gagal, masalahnya ada di Nginx config.

### 11.4 Pastikan Nginx mendengar port 80/443

```bash
sudo ss -ltnp | grep -E ':80|:443|:3000'
```

Seharusnya terlihat:

- Nginx di `:80`
- Nginx di `:443` setelah SSL aktif
- Docker/app di `127.0.0.1:3000`

### 11.5 Cek firewall AWS Lightsail

Di panel AWS Lightsail, buka instance → Networking. Pastikan IPv4 firewall mengizinkan:

- `22 TCP`
- `80 TCP`
- `443 TCP`

Jika `80` atau `443` belum dibuka, domain akan timeout walaupun DNS sudah benar.

### 11.6 Cek firewall Ubuntu

```bash
sudo ufw status
```

Jika UFW aktif, pastikan:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

## 12. Smoke test setelah deploy

Cek minimal:

- Landing page terbuka
- Cari kamar bisa menampilkan tipe kamar
- Booking online berhasil sampai instruksi transfer
- Login staff berhasil
- Verifikasi pembayaran berhasil
- Email verifikasi/konfirmasi terkirim via SMTP Hostinger
- Invoice bisa diterbitkan
- Attendance bisa buka kamera/geolocation di HTTPS

## 13. Perintah operasional harian

Restart app:

```bash
docker compose --env-file .env.production -f infra/compose.production.yaml restart app worker
```

Update dari Git:

```bash
git pull
docker compose --env-file .env.production -f infra/compose.production.yaml build
docker compose --env-file .env.production -f infra/compose.production.yaml run --rm -e ALLOW_PRODUCTION_MIGRATION=YES app node scripts/db.mjs migrate
docker compose --env-file .env.production -f infra/compose.production.yaml up -d app worker
```

Backup database manual:

```bash
docker compose --env-file .env.production -f infra/compose.production.yaml exec postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > kooka-backup.sql
```

## 14. Rollback sederhana

Jika deploy baru bermasalah:

```bash
git log --oneline -5
git checkout <commit-sebelumnya>
docker compose --env-file .env.production -f infra/compose.production.yaml build
docker compose --env-file .env.production -f infra/compose.production.yaml up -d app worker
```

Catatan: rollback database harus hati-hati. Jangan rollback schema tanpa backup.
