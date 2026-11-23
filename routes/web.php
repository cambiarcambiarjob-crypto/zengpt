<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CorteController;
use App\Http\Controllers\CrearCuentaGoogleController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DayController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SellerController;
use App\Http\Controllers\SlotController;
use App\Http\Controllers\VendedorReporteController;
use App\Http\Controllers\VisorGoogleController;
use Illuminate\Support\Facades\Route;

// nginx (auth_request) pregunta aquí si deja pasar al visor: sin redirecciones, solo 204 o 403.
Route::get('/zenbot/autorizar', [VisorGoogleController::class, 'autorizar'])->name('zenbot.autorizar');

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'show'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])->name('login.store');
});

// Cada «throttle:N,M,prefijo:» lleva su propio prefijo: sin él, Laravel cuenta TODAS las rutas con throttle en un solo
// contador por usuario (p. ej. el código 2FA que pide cada visor abierto agotaba «Generar ligas» con un 429).
Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    Route::get('/', DashboardController::class)->name('dashboard');

    Route::get('/cuentas', [AccountController::class, 'index'])->name('cuentas.index');
    Route::post('/cuentas', [AccountController::class, 'store'])->name('cuentas.store');
    Route::put('/cuentas/{account}', [AccountController::class, 'update'])->name('cuentas.update');
    Route::post('/cuentas/{account}/google', [AccountController::class, 'google'])->middleware('throttle:12,1,cuenta-revisar:')->name('cuentas.google');
    Route::put('/cuentas/{account}/bloqueo', [AccountController::class, 'bloqueo'])->name('cuentas.bloqueo');
    Route::put('/cuentas/{account}/activar', [AccountController::class, 'activar'])->name('cuentas.activar');
    Route::put('/cuentas/{account}/gemini', [AccountController::class, 'gemini'])->name('cuentas.gemini');
    Route::post('/cuentas/{account}/ligas', [AccountController::class, 'generarLigas'])->middleware('throttle:6,1,cuenta-ligas:')->name('cuentas.ligas');
    Route::delete('/cuentas/{account}', [AccountController::class, 'destroy'])->name('cuentas.destroy');

    Route::post('/cuentas/{account}/espacios', [SlotController::class, 'store'])->name('espacios.store');
    Route::put('/espacios/{slot}', [SlotController::class, 'update'])->name('espacios.update');
    Route::put('/espacios/{slot}/invitacion', [SlotController::class, 'invitacion'])->name('espacios.invitacion');
    Route::post('/espacios/{slot}/invitacion/correo', [SlotController::class, 'enviarCorreo'])->middleware('throttle:20,1,espacio-correo:')->name('espacios.invitacion.correo');
    Route::put('/espacios/{slot}/pago', [SlotController::class, 'pago'])->name('espacios.pago');
    Route::post('/espacios/{slot}/google', [SlotController::class, 'googleInvitar'])->middleware('throttle:12,1,espacio-invitar:')->name('espacios.google.invitar');
    Route::delete('/espacios/{slot}/google', [SlotController::class, 'googleSacar'])->middleware('throttle:12,1,espacio-sacar:')->name('espacios.google.sacar');
    Route::delete('/espacios/{slot}', [SlotController::class, 'destroy'])->name('espacios.destroy');

    Route::get('/dia/{fecha?}', [DayController::class, 'show'])->name('dia.show');
    // La publicidad solo la captura el administrador; el socio la ve pero no la toca.
    Route::put('/dia/{fecha}/publicidad', [DayController::class, 'publicidad'])->middleware('admin')->name('dia.publicidad');

    Route::get('/reportes', ReportController::class)->name('reportes.index');
    // Cada vendedor: sus métricas y sus pagos (los ven administrador y socio; pagar es del administrador).
    Route::get('/reportes/vendedores/{seller}', [VendedorReporteController::class, 'show'])->name('reportes.vendedor');
    Route::post('/reportes/vendedores/{seller}/pagos', [VendedorReporteController::class, 'pagar'])->middleware('admin')->name('reportes.vendedor.pagar');
    Route::delete('/pagos-vendedores/{pago}', [VendedorReporteController::class, 'deshacer'])->middleware('admin')->name('reportes.vendedor.deshacer');

    // Corte: lo que se le debe a cada quien (socio y vendedores) y lo pagado. Pagar es del administrador.
    Route::get('/corte', [CorteController::class, 'index'])->name('corte.index');
    Route::post('/corte/socio/pagos', [CorteController::class, 'pagarSocio'])->middleware('admin')->name('corte.socio.pagar');
    Route::delete('/corte/socio/pagos/{pago}', [CorteController::class, 'deshacerSocio'])->middleware('admin')->name('corte.socio.deshacer');

    // Visor del Chrome de cada cuenta (administrador y socio).
    Route::get('/google/visor/{account}', [VisorGoogleController::class, 'show'])->name('google.visor');
    Route::get('/google/visor/{account}/codigo', [VisorGoogleController::class, 'codigo'])->middleware('throttle:60,1,visor-codigo:')->name('google.visor.codigo');
    Route::post('/google/visor/{account}/login', [VisorGoogleController::class, 'login'])->middleware('throttle:10,1,visor-abrir:')->name('google.visor.login');
    Route::post('/google/visor/{account}/listo', [VisorGoogleController::class, 'listo'])->middleware('throttle:10,1,visor-listo:')->name('google.visor.listo');
    Route::post('/google/visor/{account}/cerrar', [VisorGoogleController::class, 'cerrar'])->name('google.visor.cerrar');
    Route::post('/google/visor/{account}/sacar-miembros', [VisorGoogleController::class, 'sacarMiembros'])->middleware('throttle:6,1,visor-sacar:')->name('google.visor.sacar');
    Route::get('/google/visor/{account}/sacar-miembros', [VisorGoogleController::class, 'estadoSacar'])->middleware('throttle:120,1,visor-sacar-estado:')->name('google.visor.sacar.estado');

    // Visor de «Crear cuenta» (apartado «Sin Gemini»): Chrome nuevo en el alta de Google; al guardar, se asigna a la cuenta.
    Route::get('/google/crear', [CrearCuentaGoogleController::class, 'nueva'])->name('google.crear');
    Route::get('/google/crear/{clave}', [CrearCuentaGoogleController::class, 'show'])->name('google.crear.visor');
    Route::post('/google/crear/{clave}/login', [CrearCuentaGoogleController::class, 'login'])->middleware('throttle:10,1,alta-abrir:')->name('google.crear.login');
    Route::post('/google/crear/{clave}/cerrar', [CrearCuentaGoogleController::class, 'cerrar'])->name('google.crear.cerrar');
    Route::post('/google/crear/{clave}/guardar', [CrearCuentaGoogleController::class, 'guardar'])->middleware('throttle:10,1,alta-guardar:')->name('google.crear.guardar');

    Route::middleware('admin')->group(function () {
        Route::get('/vendedores', [SellerController::class, 'index'])->name('vendedores.index');
        Route::post('/vendedores', [SellerController::class, 'store'])->name('vendedores.store');
        Route::put('/vendedores/{seller}', [SellerController::class, 'update'])->name('vendedores.update');
    });

    Route::get('/perfil', [ProfileController::class, 'show'])->name('perfil.show');
    Route::put('/perfil/password', [ProfileController::class, 'password'])->name('perfil.password');
});
