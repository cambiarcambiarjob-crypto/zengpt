<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
| Sala del juego de zombies (easter egg): canal de presencia para ver quién está conectado y mandarse los
| datos de la partida directo entre jugadores (whispers). Solo usuarios con sesión en ZenGPT.
*/
Broadcast::channel('arena', fn (User $user): array => ['id' => $user->id, 'nombre' => $user->name]);
