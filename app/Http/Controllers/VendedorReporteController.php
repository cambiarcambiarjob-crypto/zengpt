<?php

namespace App\Http\Controllers;

use App\Models\Seller;
use App\Models\SellerPayout;
use App\Services\PagosVendedor;
use App\Support\Hoy;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Pantalla de cada vendedor dentro de Reportes: sus métricas de hoy, del periodo y día por día, lo que se le debe y sus
 * pagos. La ven el administrador y el socio; registrar o deshacer un pago es solo del administrador.
 */
class VendedorReporteController extends Controller
{
    public function show(Request $request, Seller $seller): Response
    {
        $hoy = Hoy::fecha();
        $estado = PagosVendedor::estado($seller);
        $valida = fn ($v): bool => is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) === 1 && strtotime($v) !== false;

        // Sin fechas: desde el primer día sin pagar (máximo 90 días atrás) o, si ya está al corriente, la última semana.
        $limite = Hoy::carbon()->subDays(89)->toDateString();
        $porOmision = $estado['desde'] ?? null;
        $porOmision = $porOmision !== null && $porOmision <= $hoy ? max($porOmision, $limite) : Hoy::carbon()->subDays(6)->toDateString();
        $desde = $valida($request->query('desde')) ? $request->query('desde') : $porOmision;
        $hasta = $valida($request->query('hasta')) ? $request->query('hasta') : $hoy;
        if ($desde > $hasta) {
            [$desde, $hasta] = [$hasta, $desde];
        }
        // Día por día, como mucho un año.
        $desde = max($desde, Carbon::parse($hasta)->subDays(365)->toDateString());

        return Inertia::render('Reportes/Vendedor', [
            'vendedor' => ['id' => $seller->id, 'name' => $seller->name, 'is_owner' => $seller->is_owner, 'active' => $seller->active],
            'vendedores' => Seller::query()->ordered()->where(fn ($q) => $q->where('active', true)->orWhere('id', $seller->id))->get(['id', 'name', 'is_owner']),
            'desde' => $desde,
            'hasta' => $hasta,
            'hoyVendedor' => PagosVendedor::reparto($seller, PagosVendedor::sumas($seller, $hoy, $hoy)),
            'periodo' => PagosVendedor::reparto($seller, PagosVendedor::sumas($seller, $desde, $hasta)),
            'dias' => PagosVendedor::dias($seller, $desde, $hasta),
            'pago' => $estado,
            'pagos' => $seller->is_owner ? [] : PagosVendedor::historial($seller),
            'puedePagar' => $request->user()->isAdmin() && ! $seller->is_owner,
        ]);
    }

    /**
     * Registra que se le pagó lo acumulado hasta un día. Sin monto, se paga exactamente lo que se le debe hasta ese día;
     * con monto distinto (un pago parcial, un redondeo), la diferencia queda para el siguiente pago.
     */
    public function pagar(Request $request, Seller $seller): RedirectResponse
    {
        if ($seller->is_owner) {
            return back()->with('error', 'Al dueño no se le registran pagos: su parte ya es suya.');
        }

        $ultimo = PagosVendedor::ultimo($seller)?->hasta->toDateString();
        $data = $request->validate([
            'hasta' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.Hoy::fecha(), ...($ultimo ? ['after:'.$ultimo] : [])],
            'paid_on' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:'.Hoy::fecha()],
            'monto' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
            'notes' => ['nullable', 'string', 'max:255'],
        ], [
            'hasta.after' => 'Ya hay un pago que cubre hasta el '.($ultimo ? Carbon::parse($ultimo)->locale('es')->isoFormat('D [de] MMMM') : '').': elige un día posterior.',
            'hasta.before_or_equal' => 'No se puede pagar por días que todavía no pasan.',
        ], ['hasta' => 'día hasta el que se paga', 'paid_on' => 'fecha del pago', 'monto' => 'monto', 'notes' => 'notas']);

        $pago = DB::transaction(function () use ($seller, $data, $request): SellerPayout {
            Seller::query()->lockForUpdate()->findOrFail($seller->id);
            $debe = PagosVendedor::porPagarHasta($seller, $data['hasta']);

            return SellerPayout::query()->create([
                'seller_id' => $seller->id,
                'hasta' => $data['hasta'],
                'paid_on' => $data['paid_on'] ?? Hoy::fecha(),
                // Lo que se le debe (si sale negativo por pérdidas, no se le paga nada y se arrastra).
                'amount_cents' => isset($data['monto']) ? (int) round(((float) $data['monto']) * 100) : max(0, $debe),
                'notes' => filled($data['notes'] ?? null) ? trim($data['notes']) : null,
                'created_by' => $request->user()->id,
            ]);
        });

        $resto = PagosVendedor::porPagarHasta($seller, $data['hasta']);

        return back()->with('success', "Pago a {$seller->name} registrado: $".number_format($pago->amount_cents / 100, 2).' hasta el '.$pago->hasta->locale('es')->isoFormat('D [de] MMMM').'.'
            .($resto !== 0 ? ' Quedan $'.number_format($resto / 100, 2).' para el siguiente pago.' : ''));
    }

    /** Deshace el último pago de un vendedor (si se registró por error). */
    public function deshacer(SellerPayout $pago): RedirectResponse
    {
        $ultimo = PagosVendedor::ultimo($pago->seller);
        if ($ultimo?->id !== $pago->id) {
            return back()->with('error', 'Solo se puede deshacer el último pago de cada vendedor.');
        }

        $pago->delete();

        return back()->with('success', "Pago a {$pago->seller->name} deshecho: esos días vuelven a quedar por pagar.");
    }
}
