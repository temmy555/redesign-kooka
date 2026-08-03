# Phase 1A UAT Evidence

| Informasi              | Nilai                   |
| ---------------------- | ----------------------- |
| Environment            | Local synthetic UAT     |
| Database               | `kooka_phase1_uat_test` |
| Dataset version        | 1                       |
| Prepared               | 2 Agustus 2026          |
| Automated verification | PASS                    |
| Human role UAT         | Belum dijalankan        |

## Automated evidence

| Check                                   | Status | Evidence                                                                  |
| --------------------------------------- | ------ | ------------------------------------------------------------------------- |
| Dedicated environment                   | PASS   | DB `kooka_phase1_uat_test`, port 3100, private directory terpisah         |
| Migration consistency                   | PASS   | `npm run uat:verify`; seluruh migration applied                           |
| Four role accounts                      | PASS   | Owner, Front Office, Cleaning, F&B; secret tidak dicetak                  |
| Credential login dan role landing       | PASS   | `npm run uat:auth:smoke`; 4/4 role lulus                                  |
| Room/booking/payment/stay/folio dataset | PASS   | 6 kamar, 2 tipe, 4 booking, 3 payment, dan 4 skenario stay                |
| Cleaning guest-away request             | PASS   | 3 task; 1 `GUEST_AWAY_REQUEST`                                            |
| F&B fixture                             | PASS   | 2 menu sintetis aktif; 4 folio memiliki billing bucket `MASTER` aktif     |
| Critical reconciliation                 | PASS   | 0 open critical exception                                                 |
| Cleaning browser smoke                  | PASS   | Login UI → role landing → Housekeeping; 3 task terlihat, console bersih   |
| F&B room-charge browser smoke           | PASS   | Dua menu tersimpan dalam satu order Kamar 2; form `26080301`, tanpa error |
| Front Office control smoke              | PASS   | Kalender utuh; nominal menolak huruf; dialog dan file picker custom       |

## Human execution

| Role          | Tester | Date | Scenario result | Sign-off |
| ------------- | ------ | ---- | --------------- | -------- |
| Owner         | —      | —    | NOT RUN         | —        |
| Front Office  | —      | —    | NOT RUN         | —        |
| Cleaning      | —      | —    | NOT RUN         | —        |
| F&B           | —      | —    | NOT RUN         | —        |
| Content owner | —      | —    | NOT RUN         | —        |

## Device and accessibility evidence

| Target                  | Device/browser  | Result  | Evidence/notes                                          |
| ----------------------- | --------------- | ------- | ------------------------------------------------------- |
| Automated desktop smoke | In-app Chromium | PARTIAL | Cleaning login/navigation lulus; bukan sign-off manusia |
| Desktop Owner/FO        | —               | NOT RUN | —                                                       |
| Tablet camera/signature | —               | NOT RUN | Wajib perangkat nyata                                   |
| Mobile responsive       | —               | NOT RUN | —                                                       |
| Keyboard-only           | —               | NOT RUN | —                                                       |
| Screen reader           | —               | NOT RUN | —                                                       |

## Sign-off decision

Status: `NOT READY FOR SIGN-OFF`.

Alasan: persiapan dan automated smoke lulus, tetapi role-based human UAT, mutation test yang lebih luas, device matrix, camera/signature pada tablet nyata, dan accessibility pass belum dijalankan.
