<?php

namespace App\Http\Controllers;

use App\Mail\InvitacionGrupo;
use App\Models\Account;
use App\Models\Slot;
use App\Services\GrupoGoogle;
use App\Support\Hoy;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use RuntimeException;

class SlotController extends Controller
{
    public function store(Request $request, Account $account): RedirectResponse
    {
        $data = $this->validated($request);

        if ($account->sin_gemini) {
            return back()->with('error', 'La cuenta todavía no tiene Gemini: cuando lo tenga, pásala a «Por activar» y actívala.');
        }

        if ($account->por_activar) {
            return back()->with('error', 'La cuenta está pendiente de activar: actívala para agregarle clientes.');
        }

        if (! $account->isActive()) {
            return back()->with('error', 'La cuenta ya venció: no se le pueden agregar clientes.');
        }

        // Transacción con bloqueo: dos personas capturando a la vez no pueden pasar de 5 espacios.
        $creado = DB::transaction(function () use ($account, $data, $request): ?Slot {
            $cuenta = Account::query()->lockForUpdate()->findOrFail($account->id);
            $posicion = $cuenta->firstFreePosition();

            if ($posicion === null) {
                return null;
            }

            $invitacion = $this->invitacionInicial($request);
            if ($invitacion === [] && ($liga = $cuenta->inviteLinkFor($posicion)) !== null) {
                $invitacion = ['invite_url' => $liga['url'], 'invite_expires_on' => $liga['expires_on']];
            }

            $pendiente = $data['pendiente'];
            unset($data['pendiente']);

            return $cuenta->slots()->create($data + $invitacion + ['position' => $posicion, 'paid_on' => $pendiente ? null : $data['sold_on'], 'created_by' => $request->user()->id]);
        });

        // Con liga en su espacio: se le manda su liga por correo (los lugares de Google ya están ocupados con las ligas).
        if ($creado !== null && $request->boolean('enviar_liga') && $creado->invite_url !== null) {
            $error = $this->mandarLiga($creado);

            return $error === null
                ? back()->with('success', "Cliente agregado y su liga enviada por correo a {$creado->client_email}.")
                : back()->with('error', "Cliente agregado, pero no se pudo mandar el correo: {$error}");
        }

        // «Invitar en Google al guardar» (cuentas con sesión abierta en el servidor y espacio sin liga).
        if ($creado !== null && $request->boolean('invitar_google') && GrupoGoogle::conectada($account)) {
            try {
                app(GrupoGoogle::class)->invitar($creado);

                return back()->with('success', "Cliente agregado e invitado en Google: {$creado->client_email}.");
            } catch (RuntimeException $e) {
                return back()->with('error', "Cliente agregado, pero no se pudo invitar en Google: {$e->getMessage()}");
            }
        }

        return $creado !== null
            ? back()->with('success', 'Cliente agregado al espacio.')
            : back()->with('error', 'La cuenta ya tiene sus '.Account::capacity().' espacios ocupados.');
    }

    public function update(Request $request, Slot $slot): RedirectResponse
    {
        $data = $this->validated($request, $slot);
        $pendiente = $data['pendiente'];
        unset($data['pendiente']);
        // Pendiente → sin fecha de pago; pagado → conserva la fecha en que pagó (o la de la venta si no tenía).
        $data['paid_on'] = $pendiente ? null : ($slot->paid_on?->toDateString() ?? $data['sold_on']);
        $slot->update($data);

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
        $error = $this->mandarLiga($slot);

        return $error === null
            ? back()->with('success', "Invitación enviada a {$slot->client_email}.")
            : back()->with('error', $error);
    }

    /** Manda al cliente su liga por correo (el de botón verde) y la marca enviada. Devuelve el error, o null si salió. */
    private function mandarLiga(Slot $slot): ?string
    {
        if ($slot->invite_url === null) {
            return 'Primero guarda la liga de invitación de este cliente.';
        }

        if ($slot->inviteStatus() === 'caducada') {
            return 'La liga ya caducó: genera una nueva y guárdala.';
        }

        if (app()->isProduction() && in_array(config('mail.default'), ['log', 'array'], true)) {
            return 'El correo de envío todavía no está configurado en el servidor.';
        }

        try {
            Mail::to($slot->client_email)->send(new InvitacionGrupo($slot));
        } catch (\Throwable $e) {
            report($e);

            return 'No se pudo enviar el correo. Intenta de nuevo en unos minutos.';
        }

        $slot->update(['invite_sent_at' => now()]);

        return null;
    }

    /** Marca el pago del cliente (cuenta como venta en esa fecha; hoy por defecto) o lo regresa a pendiente. */
    public function pago(Request $request, Slot $slot): RedirectResponse
    {
        $data = $request->validate([
            'pagado' => ['required', 'boolean'],
            'fecha' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:'.Hoy::carbon()->addDay()->toDateString()],
        ], [], ['fecha' => 'fecha de pago']);

        if ($data['pagado'] && $slot->seller_id === null) {
            return back()->with('error', "Antes de marcarlo pagado, edita a {$slot->client_email} y ponle precio y vendedor.");
        }

        $slot->update(['paid_on' => $data['pagado'] ? ($data['fecha'] ?? Hoy::fecha()) : null]);

        return back()->with('success', $data['pagado'] ? "Pago registrado: {$slot->client_email}." : "{$slot->client_email} quedó pendiente de pago.");
    }

    /** Manda la invitación de Google al cliente desde la sesión de la cuenta en el servidor. */
    public function googleInvitar(Slot $slot, GrupoGoogle $grupo): RedirectResponse
    {
        try {
            $grupo->invitar($slot);
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', "Invitación de Google enviada a {$slot->client_email}.");
    }

    /** Saca al cliente del grupo de Google (o cancela su invitación) y libera su espacio en el sistema. */
    public function googleSacar(Slot $slot, GrupoGoogle $grupo): RedirectResponse
    {
        try {
            $grupo->sacar($slot);
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', "{$slot->client_email} salió del grupo de Google y se liberó su espacio.");
    }

    public function destroy(Slot $slot): RedirectResponse
    {
        $slot->delete();

        return back()->with('success', 'Espacio liberado.');
    }

    /**
     * Liga de invitación opcional al agregar el cliente (si ya se tiene de antes). Sin fecha, vence en 7 días.
     *
     * @return array<string, mixed>
     */
    private function invitacionInicial(Request $request): array
    {
        $data = $request->validate([
            'invite_url' => ['nullable', 'url:https,http', 'max:500'],
            'invite_expires_on' => ['nullable', 'date_format:Y-m-d'],
        ], [], ['invite_url' => 'liga de invitación', 'invite_expires_on' => 'caducidad de la liga']);

        if (blank($data['invite_url'] ?? null)) {
            return [];
        }

        return [
            'invite_url' => trim($data['invite_url']),
            'invite_expires_on' => $data['invite_expires_on'] ?? Hoy::carbon()->addDays(7)->toDateString(),
        ];
    }

    /**
     * El precio llega en pesos (200, 400, 500 o personalizado) y se guarda en centavos.
     *
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Slot $slot = null): array
    {
        // Los que llegaron solos desde Google pueden quedarse sin precio ni vendedor hasta que se sepa.
        $opcional = $slot?->origen === 'google';
        $data = $request->validate([
            'client_email' => ['required', 'email:rfc', 'max:255'],
            'client_phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\-\s]{7,30}$/'],
            'price' => [$opcional ? 'nullable' : 'required', 'numeric', 'min:0', 'max:100000'],
            'seller_id' => [$opcional ? 'nullable' : 'required', 'integer', Rule::exists('sellers', 'id')->where('active', true)],
            'pendiente' => ['nullable', 'boolean'],
            'sold_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.Hoy::carbon()->addDay()->toDateString()],
        ], ['client_phone.regex' => 'El teléfono solo puede llevar números, espacios, + y guiones.'], [
            'client_email' => 'Gmail del cliente', 'client_phone' => 'teléfono', 'price' => 'precio', 'seller_id' => 'vendedor', 'sold_on' => 'fecha de venta',
        ]);

        return [
            'client_email' => $data['client_email'],
            'client_phone' => filled($data['client_phone'] ?? null) ? trim($data['client_phone']) : null,
            'price_cents' => (int) round(((float) ($data['price'] ?? 0)) * 100),
            'seller_id' => filled($data['seller_id'] ?? null) ? (int) $data['seller_id'] : null,
            'sold_on' => $data['sold_on'],
            'pendiente' => (bool) ($data['pendiente'] ?? false),
        ];
    }
}
