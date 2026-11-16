<?php

namespace App\Mail;

use App\Models\Slot;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** Correo al cliente con su liga personal al grupo familiar (botón verde) y los beneficios del plan. */
class InvitacionGrupo extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Slot $slot) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: (string) config('zengpt.invitacion.asunto'));
    }

    public function content(): Content
    {
        return new Content(view: 'emails.invitacion', with: [
            'liga' => $this->slot->invite_url,
            'correo' => $this->slot->client_email,
            'vence' => $this->slot->invite_expires_on?->locale('es')->translatedFormat('l j \\d\\e F'),
            'inv' => config('zengpt.invitacion'),
        ]);
    }
}
