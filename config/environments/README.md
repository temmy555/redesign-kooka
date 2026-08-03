# Environment Separation

- Root `.env.example` adalah template local application.
- `test.env.example` hanya untuk automated/disposable test.
- `uat.env.example` memakai service UAT terisolasi dan tidak boleh berisi production data.
- `production.env.example` hanya mendokumentasikan key; nilai rahasia diberikan melalui ignored secret file/deployment environment.
- `.env.infrastructure.example` menghasilkan `.env.infrastructure` local yang di-ignore. Jangan memakai nilai local tersebut di UAT atau production.

Tidak ada file environment berisi secret yang boleh di-commit. UAT/production tidak boleh memakai localhost, Mailpit, `.data`, atau credential local.
