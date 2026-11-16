<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DayController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SellerController;
use App\Http\Controllers\SlotController;
use Illuminate\Support\Facades\Route;

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
    Route::delete('/cuentas/{account}', [AccountController::class, 'destroy'])->name('cuentas.destroy');

    Route::post('/cuentas/{account}/espacios', [SlotController::class, 'store'])->name('espacios.store');
    Route::put('/espacios/{slot}', [SlotController::class, 'update'])->name('espacios.update');
    Route::put('/espacios/{slot}/invitacion', [SlotController::class, 'invitacion'])->name('espacios.invitacion');
    Route::delete('/espacios/{slot}', [SlotController::class, 'destroy'])->name('espacios.destroy');

    Route::get('/dia/{fecha?}', [DayController::class, 'show'])->name('dia.show');
    // La publicidad solo la captura el administrador; el socio la ve pero no la toca.
    Route::put('/dia/{fecha}/publicidad', [DayController::class, 'publicidad'])->middleware('admin')->name('dia.publicidad');

    Route::get('/reportes', ReportController::class)->name('reportes.index');

    Route::middleware('admin')->group(function () {
        Route::get('/vendedores', [SellerController::class, 'index'])->name('vendedores.index');
        Route::post('/vendedores', [SellerController::class, 'store'])->name('vendedores.store');
        Route::put('/vendedores/{seller}', [SellerController::class, 'update'])->name('vendedores.update');
    });

    Route::get('/perfil', [ProfileController::class, 'show'])->name('perfil.show');
    Route::put('/perfil/password', [ProfileController::class, 'password'])->name('perfil.password');
});
