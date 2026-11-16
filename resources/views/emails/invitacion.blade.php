@php
    $sans = "'Helvetica Neue',Helvetica,Arial,sans-serif";
    $hero = rtrim(config('app.url'), '/').'/email/hero-gemini.jpg';
@endphp
<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>{{ $inv['asunto'] }}</title>
<style>
    body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
    a { text-decoration:none; }
    @media (max-width:600px) {
        .px { padding-left:22px !important; padding-right:22px !important; }
        .t1 { font-size:28px !important; }
        .btn a { display:block !important; }
    }
</style>
</head>
<body style="margin:0;padding:0;background:#03040d;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Activa {{ $inv['producto'] }} por {{ $inv['meses'] }} meses con Gemini 4 Argon y 5 TB.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#03040d;">
<tr><td align="center" style="padding:28px 10px 36px 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#070a1f;border:1px solid #1b2150;">

    {{-- Barra superior --}}
    <tr><td class="px" style="padding:18px 32px;border-bottom:1px solid #1b2150;font-family:{!! $sans !!};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="font-size:13px;font-weight:800;letter-spacing:4px;color:#ffffff;">ZENGPT</td>
            <td align="right" style="font-size:12px;letter-spacing:1px;color:#8b93c9;text-transform:uppercase;">Activación de cuenta</td>
        </tr></table>
    </td></tr>

    {{-- Encabezado (imagen) --}}
    <tr><td style="padding:0;line-height:0;font-size:0;">
        <img src="{{ $hero }}" width="600" alt="Gemini 4 Argon ya está aquí: la IA más potente para ideas, creación, análisis y respuestas." style="display:block;width:100%;max-width:600px;height:auto;border:0;background:#0a1650;color:#ffffff;font-family:{!! $sans !!};font-size:16px;line-height:1.4;">
    </td></tr>

    {{-- Mensaje principal --}}
    <tr><td class="px" style="padding:40px 40px 0 40px;font-family:{!! $sans !!};">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#8ab4ff;">Tu lugar está reservado</p>
        <h1 class="t1" style="margin:12px 0 0 0;font-size:32px;line-height:1.15;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">{{ $inv['producto'] }}<span style="color:#8ab4ff;"> · {{ $inv['meses'] }} meses</span></h1>
        <p style="margin:16px 0 0 0;font-size:16px;line-height:1.65;color:#c3c9ea;">Acepta la invitación con tu cuenta <span style="color:#ffffff;font-weight:700;">{{ $correo }}</span> y tendrás todo activo al instante, en tu propio espacio.</p>
    </td></tr>

    {{-- Botón --}}
    <tr><td class="px btn" style="padding:30px 40px 0 40px;font-family:{!! $sans !!};">
        <a href="{{ $liga }}" target="_blank" style="display:inline-block;padding:18px 34px;background:#16a34a;border:1px solid #22c55e;border-radius:4px;color:#ffffff;font-size:16px;font-weight:700;letter-spacing:0.2px;text-align:center;">{{ $inv['boton'] }} &nbsp;&rarr;</a>
        @if ($vence)
            <p style="margin:14px 0 0 0;font-size:13px;color:#7c84b8;">Invitación personal. Válida hasta el {{ $vence }}.</p>
        @endif
    </td></tr>

    {{-- Beneficios --}}
    <tr><td class="px" style="padding:44px 40px 0 40px;font-family:{!! $sans !!};">
        <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#8ab4ff;">Qué incluye</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            @foreach ($inv['beneficios'] as $i => $b)
            <tr>
                <td width="42" valign="top" style="padding:18px 0;border-bottom:1px solid #161b42;font-size:13px;font-weight:700;color:#5b6bd6;letter-spacing:1px;">{{ str_pad($i + 1, 2, '0', STR_PAD_LEFT) }}</td>
                <td valign="top" style="padding:18px 0;border-bottom:1px solid #161b42;">
                    <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;">{{ $b['titulo'] }}</p>
                    <p style="margin:5px 0 0 0;font-size:14px;line-height:1.55;color:#9aa2d4;">{{ $b['texto'] }}</p>
                </td>
            </tr>
            @endforeach
        </table>
    </td></tr>

    {{-- Pasos --}}
    <tr><td class="px" style="padding:40px 40px 0 40px;font-family:{!! $sans !!};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b1030;border-left:3px solid #6d7cff;">
            <tr><td style="padding:22px 24px;">
                <p style="margin:0 0 10px 0;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#8ab4ff;">Actívalo en 3 pasos</p>
                <p style="margin:0;font-size:15px;line-height:1.9;color:#d3d8f2;">
                    1.&nbsp; Toca el botón verde.<br>
                    2.&nbsp; Entra con tu Gmail {{ $correo }}.<br>
                    3.&nbsp; Acepta unirte al grupo familiar.
                </p>
            </td></tr>
        </table>
    </td></tr>

    {{-- Pie --}}
    <tr><td class="px" style="padding:36px 40px 34px 40px;font-family:{!! $sans !!};">
        <p style="margin:0;font-size:12px;line-height:1.7;color:#6b72a3;">¿El botón no abre? Copia esta liga en tu navegador:<br>
            <a href="{{ $liga }}" style="color:#8ab4ff;word-break:break-all;">{{ $liga }}</a></p>
        <p style="margin:18px 0 0 0;padding-top:18px;border-top:1px solid #161b42;font-size:12px;line-height:1.7;color:#6b72a3;">ZenGPT · Si tienes dudas, responde a este correo.</p>
    </td></tr>

</table>
</td></tr>
</table>
</body>
</html>
