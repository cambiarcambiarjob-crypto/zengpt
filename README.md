# ZenGPT

Sistema de gestión de cuentas, espacios, ventas por vendedor, publicidad diaria y reparto de ganancias. Ver `CLAUDE.md` para las reglas del negocio y las convenciones.

```sh
composer install && npm install
cp .env.example .env && php artisan key:generate
php artisan migrate --seed
php artisan zengpt:usuario leo --rol=admin
npm run build && php artisan serve
```
