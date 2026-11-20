<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AuthController;
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

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    Route::get('/', DashboardController::class)->name('dashboard');

    Route::get('/cuentas', [AccountController::class, 'index'])->name('cuentas.index');
    Route::post('/cuentas', [AccountController::class, 'store'])->name('cuentas.store');
    Route::put('/cuentas/{account}', [AccountController::class, 'update'])->name('cuentas.update');
    Route::post('/cuentas/{account}/google', [AccountController::class, 'google'])->middleware('throttle:12,1')->name('cuentas.google');
    Route::put('/cuentas/{account}/bloqueo', [AccountController::class, 'bloqueo'])->name('cuentas.bloqueo');
    Route::put('/cuentas/{account}/activar', [AccountController::class, 'activar'])->name('cuentas.activar');
    Route::post('/cuentas/{account}/ligas', [AccountController::class, 'generarLigas'])->middleware('throttle:6,1')->name('cuentas.ligas');
    Route::delete('/cuentas/{account}', [AccountController::class, 'destroy'])->name('cuentas.destroy');

    Route::post('/cuentas/{account}/espacios', [SlotController::class, 'store'])->name('espacios.store');
    Route::put('/espacios/{slot}', [SlotController::class, 'update'])->name('espacios.update');
    Route::put('/espacios/{slot}/invitacion', [SlotController::class, 'invitacion'])->name('espacios.invitacion');
    Route::post('/espacios/{slot}/invitacion/correo', [SlotController::class, 'enviarCorreo'])->middleware('throttle:20,1')->name('espacios.invitacion.correo');
    Route::put('/espacios/{slot}/pago', [SlotController::class, 'pago'])->name('espacios.pago');
    Route::post('/espacios/{slot}/google', [SlotController::class, 'googleInvitar'])->middleware('throttle:12,1')->name('espacios.google.invitar');
    Route::delete('/espacios/{slot}/google', [SlotController::class, 'googleSacar'])->middleware('throttle:12,1')->name('espacios.google.sacar');
    Route::delete('/espacios/{slot}', [SlotController::class, 'destroy'])->name('espacios.destroy');

    Route::get('/dia/{fecha?}', [DayController::class, 'show'])->name('dia.show');
    // La publicidad solo la captura el administrador; el socio la ve pero no la toca.
    Route::put('/dia/{fecha}/publicidad', [DayController::class, 'publicidad'])->middleware('admin')->name('dia.publicidad');

    Route::get('/reportes', ReportController::class)->name('reportes.index');
    // Cada vendedor: sus métricas y sus pagos (los ven administrador y socio; pagar es del administrador).
    Route::get('/reportes/vendedores/{seller}', [VendedorReporteController::class, 'show'])->name('reportes.vendedor');
    Route::post('/reportes/vendedores/{seller}/pagos', [VendedorReporteController::class, 'pagar'])->middleware('admin')->name('reportes.vendedor.pagar');
    Route::delete('/pagos-vendedores/{pago}', [VendedorReporteController::class, 'deshacer'])->middleware('admin')->name('reportes.vendedor.deshacer');

    // Visor del Chrome de cada cuenta (administrador y socio).
    Route::get('/google/visor/{account}', [VisorGoogleController::class, 'show'])->name('google.visor');
    Route::get('/google/visor/{account}/codigo', [VisorGoogleController::class, 'codigo'])->middleware('throttle:60,1')->name('google.visor.codigo');
    Route::post('/google/visor/{account}/login', [VisorGoogleController::class, 'login'])->middleware('throttle:10,1')->name('google.visor.login');
    Route::post('/google/visor/{account}/listo', [VisorGoogleController::class, 'listo'])->middleware('throttle:10,1')->name('google.visor.listo');
    Route::post('/google/visor/{account}/cerrar', [VisorGoogleController::class, 'cerrar'])->name('google.visor.cerrar');
    Route::post('/google/visor/{account}/sacar-miembros', [VisorGoogleController::class, 'sacarMiembros'])->middleware('throttle:6,1')->name('google.visor.sacar');
    Route::get('/google/visor/{account}/sacar-miembros', [VisorGoogleController::class, 'estadoSacar'])->middleware('throttle:120,1')->name('google.visor.sacar.estado');

    Route::middleware('admin')->group(function () {
        Route::get('/vendedores', [SellerController::class, 'index'])->name('vendedores.index');
        Route::post('/vendedores', [SellerController::class, 'store'])->name('vendedores.store');
        Route::put('/vendedores/{seller}', [SellerController::class, 'update'])->name('vendedores.update');
    });

    Route::get('/perfil', [ProfileController::class, 'show'])->name('perfil.show');
    Route::put('/perfil/password', [ProfileController::class, 'password'])->name('perfil.password');
});
