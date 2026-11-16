<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pago del cliente: null = pendiente de pago (ocupa su espacio pero no cuenta como venta). La venta se cuenta
 * en la fecha en que pagó. Los clientes que ya existían se toman como pagados el día de su venta.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('slots', function (Blueprint $table) {
            $table->date('paid_on')->nullable()->index()->after('sold_on');
        });

        DB::table('slots')->update(['paid_on' => DB::raw('sold_on')]);
    }

    public function down(): void
    {
        Schema::table('slots', function (Blueprint $table) {
            $table->dropIndex(['paid_on']);
            $table->dropColumn('paid_on');
        });
    }
};
