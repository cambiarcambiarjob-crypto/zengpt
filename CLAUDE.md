# ZenGPT · sistema de gestión

Sistema interno del negocio ZenGPT (zengpt.codezen.online). Todo en español de México: textos, comentarios y commits.

## Qué hace

- **Cuenta** = un Gmail con vigencia de 3 meses y **5 espacios**. **Espacio** = un cliente dentro de la cuenta (Gmail del cliente, teléfono opcional, precio, vendedor, fecha de venta). El espacio dura lo que dure la cuenta; los espacios libres de hoy siguen disponibles mañana.
- Precios sugeridos $200, $400, $500 o personalizado. Todos pagan por transferencia.
- Vendedores (catálogo): Leo (dueño), Jorge, Iván, Gera.
- **Publicidad**: por día y por vendedor; solo la captura el administrador (el socio la ve, no la edita).
- **Reparto** (`App\Support\Reparto`, por vendedor): neto = ventas − publicidad · socio (Christian) = 10 % del neto · resto: mitad vendedor y mitad dueño (si vende el dueño, todo el resto es suyo).
- Roles: `admin` (Leo, todo) y `socio` (Christian: ve todo y captura cuentas y clientes; no edita publicidad ni vendedores).
- La sesión no caduca (remember siempre + SESSION_LIFETIME largo).

## Stack y convenciones

- Laravel 13 + Inertia 3 + React 19 + TypeScript + Tailwind 4 (Vite). PHP 8.3, SQLite en pruebas y MySQL 8 en producción (no usar SQL propio de un motor; fechas con `whereDate`).
- Dinero SIEMPRE en centavos (enteros) en base, servidor y props; se formatea en pantalla. Los formularios mandan pesos (`price`, `gastos`) y el servidor convierte.
- «Hoy» = `App\Support\Hoy` (America/Chihuahua).
- Contrato de datos servidor ↔ pantallas: `resources/js/types.ts` (no cambiarlo sin cambiar el controlador y sus pruebas).
- Pantallas en `resources/js/pages/**` (minúsculas), componentes en `resources/js/components/**`, utilidades en `resources/js/lib/**`.
- Interfaz: oscura, profesional, con componentes de **React Bits** (reactbits.dev, variante TS + Tailwind) copiados a `resources/js/components/reactbits/`. Rendimiento primero: animaciones pesadas con import dinámico, respetar `prefers-reduced-motion`, nada de CDN.
- Pruebas: `php artisan test --compact` · estilo PHP: `vendor/bin/pint` · tipos: `npx tsc --noEmit` · build: `npm run build`.
- Nunca subir secretos (.env, contraseñas) al repositorio.
