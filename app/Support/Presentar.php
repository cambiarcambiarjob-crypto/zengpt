<?php

namespace App\Support;

use App\Models\Account;
use App\Models\Slot;
use App\Services\GrupoGoogle;

/** Forma en que las cuentas y los espacios viajan a las pantallas (Inertia). */
final class Presentar
{
    /** @return array<string, mixed> */
    public static function cuenta(Account $account): array
    {
        $espacios = $account->slots->map(fn (Slot $slot): array => self::espacio($slot))->values()->all();

        return [
            'id' => $account->id,
            'email' => $account->email,
            'password' => $account->password,
            'twofa_url' => $account->twofa_url,
            'invite_links' => collect(range(1, Account::capacity()))->map(fn (int $p): array => ['position' => $p] + ($account->inviteLinkFor($p) ?? ['url' => null, 'expires_on' => null]))->all(),
            'started_on' => $account->started_on->toDateString(),
            'expires_on' => $account->expires_on->toDateString(),
            'dias_restantes' => $account->daysLeft(),
            'activa' => $account->isActive(),
            'por_vencer' => $account->isActive() && $account->daysLeft() <= (int) config('zengpt.dias_aviso', 14),
            'notes' => $account->notes,
            'capacidad' => Account::capacity(),
            'ocupados' => count($espacios),
            'libres' => max(0, Account::capacity() - count($espacios)),
            'ingresos' => (int) $account->slots->whereNotNull('paid_on')->sum('price_cents'),
            'pendientes_pago' => $account->slots->whereNull('paid_on')->count(),
            'espacios' => $espacios,
            'google' => [
                'conectada' => GrupoGoogle::conectada($account),
                'revisada' => $account->google_synced_at?->toIso8601String(),
                'extra' => $account->google_extra ?? [],
                'ligas' => (int) $account->google_ligas,
            ],
        ];
    }

    /** @return array<string, mixed> */
    public static function espacio(Slot $slot): array
    {
        return [
            'id' => $slot->id,
            'account_id' => $slot->account_id,
            'account_email' => $slot->relationLoaded('account') ? $slot->account?->email : null,
            'position' => $slot->position,
            'client_email' => $slot->client_email,
            'client_phone' => $slot->client_phone,
            'price_cents' => $slot->price_cents,
            'seller_id' => $slot->seller_id,
            'seller_name' => $slot->seller?->name,
            'sold_on' => $slot->sold_on->toDateString(),
            'paid_on' => $slot->paid_on?->toDateString(),
            'invite_url' => $slot->invite_url,
            'invite_expires_on' => $slot->invite_expires_on?->toDateString(),
            'invite_status' => $slot->inviteStatus(),
            'google_status' => $slot->google_status,
            'origen' => $slot->origen,
        ];
    }
}
