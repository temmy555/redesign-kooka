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

## 11. Smoke test setelah deploy

Cek minimal:

- Landing page terbuka
- Cari kamar bisa menampilkan tipe kamar
- Booking online berhasil sampai instruksi transfer
- Login staff berhasil
- Verifikasi pembayaran berhasil
- Email verifikasi/konfirmasi terkirim via SMTP Hostinger
- Invoice bisa diterbitkan
- Attendance bisa buka kamera/geolocation di HTTPS

## 12. Perintah operasional harian

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

## 13. Rollback sederhana

Jika deploy baru bermasalah:

```bash
git log --oneline -5
git checkout <commit-sebelumnya>
docker compose --env-file .env.production -f infra/compose.production.yaml build
docker compose --env-file .env.production -f infra/compose.production.yaml up -d app worker
```

Catatan: rollback database harus hati-hati. Jangan rollback schema tanpa backup.
