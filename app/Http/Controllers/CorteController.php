<?php

namespace App\Http\Controllers;

use App\Models\PartnerPayout;
use App\Models\Seller;
use App\Models\User;
use App\Services\PagosSocio;
use App\Services\PagosVendedor;
use App\Support\Hoy;
use App\Support\Reparto;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Corte: cuánto se le debe hoy a cada quien (el socio y cada vendedor; al dueño no) y lo que ya se pagó. Lo ven el
 * administrador y el socio; registrar o deshacer un pago es solo del administrador. Los pagos a vendedores usan las
 * mismas rutas que su pantalla en Reportes.
 */
class CorteController extends Controller
{
    public function index(Request $request): Response
    {
        $socio = User::query()->where('role', User::ROLE_SOCIO)->orderBy('id')->first()?->name ?? 'Socio';
        $porcentaje = fn (float $p): string => rtrim(rtrim(number_format($p, 1), '0'), '.').' %';
        $ultimoSocio = PagosSocio::ultimo();

        $beneficiarios = [[
            'clave' => 'socio',
            'nombre' => $socio,
            'rol' => 'Socio · '.$porcentaje(Reparto::porcentajeSocio()).' del neto de todas las ventas',
            'pago' => PagosSocio::estado(),
            'pagar_url' => '/corte/socio/pagos',
            'deshacer_url' => $ultimoSocio ? "/corte/socio/pagos/{$ultimoSocio->id}" : null,
            'detalle_url' => null,
        ]];
        $movimientos = collect(PagosSocio::historial())->map(fn (array $p): array => $p + ['para' => $socio, 'clave' => 'socio']);

        foreach (Seller::query()->ordered()->where('is_owner', false)->get() as $seller) {
            $estado = PagosVendedor::estado($seller);
            if (! $seller->active && $estado['pendiente'] === 0) {
                continue;
            }

            $ultimo = PagosVendedor::ultimo($seller);
            $beneficiarios[] = [
                'clave' => "vendedor-{$seller->id}",
                'nombre' => $seller->name,
                'rol' => ($seller->active ? 'Vendedor' : 'Vendedor de baja').' · '.$porcentaje(Reparto::porcentajeVendedor()).' de lo que queda de sus ventas',
                'pago' => $estado,
                'pagar_url' => "/reportes/vendedores/{$seller->id}/pagos",
                'deshacer_url' => $ultimo ? "/pagos-vendedores/{$ultimo->id}" : null,
                'detalle_url' => "/reportes/vendedores/{$seller->id}",
            ];
            $movimientos = $movimientos->merge(collect(PagosVendedor::historial($seller))->map(fn (array $p): array => $p + ['para' => $seller->name, 'clave' => "vendedor-{$seller->id}"]));
        }

        return Inertia::render('Corte/Index', [
            'beneficiarios' => $beneficiarios,
            'movimientos' => $movimientos->sortByDesc(fn (array $p): string => $p['paid_on'].' '.$p['hasta'])->take(60)->values()->all(),
            'puedePagar' => $request->user()->isAdmin(),
        ]);
    }

    /** Registra un pago al socio: lo acumulado hasta un día (sin monto, exactamente lo que se le debe). */
    public function pagarSocio(Request $request): RedirectResponse
    {
        $ultimo = PagosSocio::ultimo()?->hasta->toDateString();
        $data = $request->validate([
            'hasta' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.Hoy::fecha(), ...($ultimo ? ['after:'.$ultimo] : [])],
            'paid_on' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:'.Hoy::fecha()],
            'monto' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
            'notes' => ['nullable', 'string', 'max:255'],
        ], [
            'hasta.after' => 'Ya hay un pago que cubre hasta el '.($ultimo ? Carbon::parse($ultimo)->locale('es')->isoFormat('D [de] MMMM') : '').': elige un día posterior.',
            'hasta.before_or_equal' => 'No se puede pagar por días que todavía no pasan.',
        ], ['hasta' => 'día hasta el que se paga', 'paid_on' => 'fecha del pago', 'monto' => 'monto', 'notes' => 'notas']);

        // Un pago a la vez (doble clic o dos pestañas): dentro del candado se vuelve a revisar el último pago.
        $pago = Cache::lock('corte-socio', 15)->block(10, function () use ($data, $request): ?PartnerPayout {
            $ultimo = PagosSocio::ultimo()?->hasta->toDateString();
            if ($ultimo !== null && $data['hasta'] <= $ultimo) {
                return null;
            }

            return PartnerPayout::query()->create([
                'hasta' => $data['hasta'],
                'paid_on' => $data['paid_on'] ?? Hoy::fecha(),
                'amount_cents' => isset($data['monto']) ? (int) round(((float) $data['monto']) * 100) : max(0, PagosSocio::porPagarHasta($data['hasta'])),
                'notes' => filled($data['notes'] ?? null) ? trim($data['notes']) : null,
                'created_by' => $request->user()->id,
            ]);
        });

        if ($pago === null) {
            return back()->with('error', 'Ese pago ya estaba registrado.');
        }

        $resto = PagosSocio::porPagarHasta($data['hasta']);

        return back()->with('success', 'Pago al socio registrado: $'.number_format($pago->amount_cents / 100, 2).' hasta el '.$pago->hasta->locale('es')->isoFormat('D [de] MMMM').'.'
            .($resto !== 0 ? ' Quedan $'.number_format($resto / 100, 2).' para el siguiente pago.' : ''));
    }

    /** Deshace el último pago al socio (si se registró por error). */
    public function deshacerSocio(PartnerPayout $pago): RedirectResponse
    {
        if (PagosSocio::ultimo()?->id !== $pago->id) {
            return back()->with('error', 'Solo se puede deshacer el último pago al socio.');
        }

        $pago->delete();

        return back()->with('success', 'Pago al socio deshecho: esos días vuelven a quedar por pagar.');
    }
}
