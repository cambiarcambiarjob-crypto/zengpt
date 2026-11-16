<?php

namespace App\Http\Controllers;

use App\Mail\InvitacionGrupo;
use App\Models\Account;
use App\Models\Slot;
use App\Support\Hoy;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class SlotController extends Controller
{
    public function store(Request $request, Account $account): RedirectResponse
    {
        $data = $this->validated($request);

        if (! $account->isActive()) {
            return back()->with('error', 'La cuenta ya venció: no se le pueden agregar clientes.');
        }

        // Transacción con bloqueo: dos personas capturando a la vez no pueden pasar de 5 espacios.
        $creado = DB::transaction(function () use ($account, $data, $request): bool {
            $cuenta = Account::query()->lockForUpdate()->findOrFail($account->id);
            $posicion = $cuenta->firstFreePosition();

            if ($posicion === null) {
                return false;
            }

            $cuenta->slots()->create($data + ['position' => $posicion, 'created_by' => $request->user()->id]);

            return true;
        });

        return $creado
            ? back()->with('success', 'Cliente agregado al espacio.')
            : back()->with('error', 'La cuenta ya tiene sus '.Account::capacity().' espacios ocupados.');
    }

    public function update(Request $request, Slot $slot): RedirectResponse
    {
        $slot->update($this->validated($request));

        return back()->with('success', 'Espacio actualizado.');
    }

    /**
     * Liga de invitación al grupo familiar (una por cliente). Guardar una liga nueva reinicia el estado;
     * `accion` marca la invitación como enviada o aceptada (o la reinicia).
     */
    public function invitacion(Request $request, Slot $slot): RedirectResponse
    {
        $data = $request->validate([
            'invite_url' => ['nullable', 'url:https,http', 'max:500'],
            'invite_expires_on' => ['nullable', 'date_format:Y-m-d'],
            'accion' => ['nullable', 'in:enviada,aceptada,reiniciar'],
        ], [], ['invite_url' => 'liga de invitación', 'invite_expires_on' => 'fecha de caducidad']);

        if (array_key_exists('invite_url', $data) && $request->has('invite_url')) {
            $nueva = filled($data['invite_url']) ? trim($data['invite_url']) : null;
            $cambio = $nueva !== $slot->invite_url;
            $slot->fill([
                'invite_url' => $nueva,
                'invite_expires_on' => $nueva !== null ? ($data['invite_expires_on'] ?? null) : null,
            ]);
            if ($cambio) {
                $slot->invite_sent_at = null;
                $slot->invite_accepted_at = null;
            }
        }

        match ($data['accion'] ?? null) {
            'enviada' => $slot->invite_sent_at = now(),
            'aceptada' => $slot->fill(['invite_accepted_at' => now(), 'invite_sent_at' => $slot->invite_sent_at ?? now()]),
            'reiniciar' => $slot->fill(['invite_sent_at' => null, 'invite_accepted_at' => null]),
            default => null,
        };

        $slot->save();

        return back()->with('success', 'Invitación actualizada.');
    }

    /** Manda al cliente el correo con su liga (botón verde) y marca la invitación como enviada. */
    public function enviarCorreo(Slot $slot): RedirectResponse
    {
        if ($slot->invite_url === null) {
            return back()->with('error', 'Primero guarda la liga de invitación de este cliente.');
        }

        if ($slot->inviteStatus() === 'caducada') {
            return back()->with('error', 'La liga ya caducó: genera una nueva en Google y guárdala.');
        }

        if (app()->isProduction() && in_array(config('mail.default'), ['log', 'array'], true)) {
            return back()->with('error', 'El correo de envío todavía no está configurado en el servidor.');
        }

        try {
            Mail::to($slot->client_email)->send(new InvitacionGrupo($slot));
        } catch (\Throwable $e) {
            report($e);

            return back()->with('error', 'No se pudo enviar el correo. Intenta de nuevo en unos minutos.');
        }

        $slot->update(['invite_sent_at' => now()]);

        return back()->with('success', "Invitación enviada a {$slot->client_email}.");
    }

    public function destroy(Slot $slot): RedirectResponse
    {
        $slot->delete();

        return back()->with('success', 'Espacio liberado.');
    }

    /**
     * El precio llega en pesos (200, 400, 500 o personalizado) y se guarda en centavos.
     *
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'client_email' => ['required', 'email:rfc', 'max:255'],
            'client_phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\-\s]{7,30}$/'],
            'price' => ['required', 'numeric', 'min:0', 'max:100000'],
            'seller_id' => ['required', 'integer', Rule::exists('sellers', 'id')->where('active', true)],
            'sold_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.Hoy::carbon()->addDay()->toDateString()],
        ], ['client_phone.regex' => 'El teléfono solo puede llevar números, espacios, + y guiones.'], [
            'client_email' => 'Gmail del cliente', 'client_phone' => 'teléfono', 'price' => 'precio', 'seller_id' => 'vendedor', 'sold_on' => 'fecha de venta',
        ]);

        return [
            'client_email' => $data['client_email'],
            'client_phone' => filled($data['client_phone'] ?? null) ? trim($data['client_phone']) : null,
            'price_cents' => (int) round(((float) $data['price']) * 100),
            'seller_id' => (int) $data['seller_id'],
            'sold_on' => $data['sold_on'],
        ];
    }
}
