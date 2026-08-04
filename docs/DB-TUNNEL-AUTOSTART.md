# PostgreSQL SSH Tunnel Auto-Start (MacBook)

Tujuan file ini: membuat koneksi DataGrip ke PostgreSQL AWS tanpa membuka port publik dan tanpa mengetik command tunnel tiap kali mulai kerja.

> Jika `ps` tidak menampilkan autossh/tunnel, berarti proses tunnel **sudah tidak berjalan**.

## 1) Login test (sudah pasti) dan konfigurasi kunci SSH

```bash
ssh -i /Users/temmykurniawan/Documents/Codex/2026-08-01/redesign-kooka/LightsailDefaultKey-ap-southeast-3.pem \
  ubuntu@43.218.192.20 "echo ok"
```

Pastikan file key:

- hanya dibaca owner (`chmod 400`),
- benar path dan public IP/VPS.

```bash
chmod 400 /Users/temmykurniawan/Documents/Codex/2026-08-01/redesign-kooka/LightsailDefaultKey-ap-southeast-3.pem
```

## 2) Buat host shortcut di `~/.ssh/config`

Isi file dengan block berikut (contoh nama host `kooka-db-tunnel`):

```text
Host kooka-db-tunnel
  HostName 43.218.192.20
  User ubuntu
  IdentityFile /Users/temmykurniawan/Documents/Codex/2026-08-01/redesign-kooka/LightsailDefaultKey-ap-southeast-3.pem
  LocalForward 55432 127.0.0.1:5432
  ServerAliveInterval 30
  ServerAliveCountMax 3
  ExitOnForwardFailure yes
  StrictHostKeyChecking yes
```

```bash
chmod 600 ~/.ssh/config
```

Uji:

```bash
ssh kooka-db-tunnel "echo ok"
```

## 3) Jalankan tunnel (satu kali / manual)

```bash
ssh -N kooka-db-tunnel
```

Jika tidak ada output, itu normal (tunnel aktif di background di terminal itu).

Cek dengan:

```bash
ps -ef | grep -i "ssh -N -L 127.0.0.1:55432" | grep -v grep
lsof -nP -iTCP:55432 -sTCP:LISTEN
nc -vz 127.0.0.1 55432
```

### Jika muncul `channel 1: open failed: connect failed: Connection refused`

Ini biasanya **bukan berarti tunnel local mati**, tapi berarti tujuan port PostgreSQL di VPS tidak menerima koneksi.

Penyebab paling umum:

- PostgreSQL di AWS tidak exposed ke `127.0.0.1:5432` (service container belum punya port binding ke host).
- PostgreSQL belum jalan.
- Forward masih mengarah ke endpoint yang salah.

Cek cepat di VPS:

```bash
cd ~/apps/redesign-kooka
docker compose --env-file .env.production -f infra/compose.production.yaml ps
docker compose --env-file .env.production -f infra/compose.production.yaml exec postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Jika `pg_isready` berhasil, tapi `ssh -N` tetap connection refused, pastikan PostgreSQL di-host tersedia lewat localhost. Untuk VPS biasanya ini perlu menambahkan port binding di `infra/compose.production.yaml`:

```yaml
  postgres:
    ...
    ports:
      - "127.0.0.1:5432:5432"
```

> Catatan penting: `channel ... connection refused` berarti remote forward-nya gagal karena SSH berhasil jalan, tapi target `127.0.0.1:5432` di VPS menolak koneksi. Ini normal kalau PostgreSQL container belum di-bind ke localhost.

Setelah itu restart:

```bash
docker compose --env-file .env.production -f infra/compose.production.yaml up -d postgres
docker compose --env-file .env.production -f infra/compose.production.yaml restart app
```

Lalu start ulang tunnel.

## 4) Buat start otomatis (recommended)

Simpan file `~/Library/LaunchAgents/com.kooka.db-tunnel.plist`:

```xml
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.kooka.db-tunnel</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/bin/ssh</string>
      <string>-o</string>
      <string>ServerAliveInterval=30</string>
      <string>-o</string>
      <string>ServerAliveCountMax=3</string>
      <string>-o</string>
      <string>ExitOnForwardFailure=yes</string>
      <string>-N</string>
      <string>kooka-db-tunnel</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
      <key>NetworkState</key>
      <true/>
      <key>SuccessfulExit</key>
      <false/>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/kooka-db-tunnel.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/kooka-db-tunnel.stderr.log</string>
  </dict>
</plist>
```

Aktifkan:

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.kooka.db-tunnel.plist
launchctl kickstart -k gui/$(id -u)/com.kooka.db-tunnel
```

Cek status:

```bash
launchctl list | grep kooka.db-tunnel
```

Muat ulang:

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.kooka.db-tunnel.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.kooka.db-tunnel.plist
```

## 5) Kalau muncul “bind ... Address already in use”

Port `55432` mungkin dipakai proses lama. Cek:

```bash
lsof -nP -iTCP:55432 -sTCP:LISTEN
```

Hentikan proses itu (ganti PID):

```bash
kill -9 <PID>
```

Lalu start ulang tunnel/launch agent.

## 6) Cek lewat DataGrip

Gunakan koneksi lokal:

- Host: `127.0.0.1`
- Port: `55432`
- Database: `kooka`
- User: dari `.env.production` (`POSTGRES_USER`)
- Password: dari `POSTGRES_PASSWORD`

> Tidak perlu public IP database dan tidak membuka PostgreSQL ke internet.

### Jika error: `FATAL: role "xxx" does not exist`

Biasanya karena user di client tidak cocok dengan `POSTGRES_USER` yang aktif di server.

Cara cek cepat:

```bash
cd ~/apps/redesign-kooka
docker compose --env-file .env.production -f infra/compose.production.yaml exec postgres \
  sh -lc "psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -c \"\\du\""
```

Kalau list role tidak memuat user yang kamu pakai di DataGrip, langsung perbaiki di DataGrip sesuai user yang ada di server, atau buat ulang user:

```bash
docker compose --env-file .env.production -f infra/compose.production.yaml exec postgres \
  sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE ROLE kooka LOGIN PASSWORD ''GantiPasswordAnda'';"'
```

Catatan: jika perintah pertama gagal karena user lain (`role ... does not exist`), connect ke superuser container:

```bash
docker compose --env-file .env.production -f infra/compose.production.yaml exec postgres \
  sh -lc 'psql -U postgres -d kooka'
```

Lalu jalankan:

```sql
CREATE ROLE kooka LOGIN PASSWORD 'GantiPasswordAnda';
GRANT ALL PRIVILEGES ON DATABASE kooka TO kooka;
```

> Masalah yang kamu dapat (`FATAL: role "root" does not exist`) biasanya karena shell lokal merubah `$POSTGRES_USER` jadi kosong sebelum dikirim ke container.  
> Gunakan command dengan single quote seperti di atas (`'psql ... "$POSTGRES_USER" ...'`) agar variabel diproses di sisi container.

## 7) Opsi: akses DB PostgreSQL dari luar langsung (kalau memang harus)

Cara ini **tetap bisa dipakai**, tapi kurang aman dibanding SSH tunnel.

### 7.1 Prinsip aman sebelum membuka DB ke publik

- Buka port PostgreSQL hanya untuk IP rumah/kantor yang pasti (`<YOUR_PUBLIC_IP>/32`).
- Gunakan port non-standar (mis. `55432`) agar tidak terlihat.
- Pakai password strong + `scram-sha-256`.
- Catat dan tutup kembali port setelah selesai debugging.

### 7.2 Buka port PostgreSQL di container

Edit `infra/compose.production.yaml` bagian `postgres`:

```yaml
  postgres:
    ...
    ports:
      - "55432:5432"
```

Tambahkan listen address (jaga supaya PostgreSQL mendengar dari luar):

```yaml
  postgres:
    ...
    command:
      - postgres
      - -c
      - listen_addresses='*'
```

Restart service:

```bash
cd ~/apps/redesign-kooka
docker compose --env-file .env.production -f infra/compose.production.yaml up -d postgres
```

### 7.3 Aktifkan akses remote di PostgreSQL (satu kali)

Tambahkan rule host ke `pg_hba.conf` container:

```bash
docker compose --env-file .env.production -f infra/compose.production.yaml exec postgres \
  sh -lc "printf \"\nhost all all 0.0.0.0/0 scram-sha-256\\n\" >> /var/lib/postgresql/data/pg_hba.conf && pg_ctl -D /var/lib/postgresql/data reload"
```

> Untuk lebih aman, ganti `0.0.0.0/0` dengan IP/lintas IP Anda saja, mis. `182.16.30.50/32`.

### 7.4 Buka port di firewall AWS/Ubuntu hanya dari IP Anda

Pada Lightsail Networking: tambahkan custom rule `TCP 55432` dari IP Anda.

Di Ubuntu (opsional kalau ufw aktif):

```bash
sudo ufw allow from <YOUR_PUBLIC_IP>/32 to any port 55432 proto tcp
```

### 7.5 Koneksi DataGrip langsung

- Host: `43.218.192.20` (IP VPS)
- Port: `55432`
- DB: `kooka`
- User: sesuai `POSTGRES_USER`
- Password: sesuai `POSTGRES_PASSWORD`

### 7.6 Tutup lagi setelah debugging

Setelah selesai:

- Hentikan rule firewall publik.
- Kembalikan `ports` back ke `127.0.0.1:5432:5432` (atau hapus).
- Bersihkan rule `0.0.0.0/0` di `pg_hba`.
