@php
    $filas = array_chunk($inv['beneficios'], 2);
@endphp
<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{{ $inv['asunto'] }}</title>
<style>
    body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
    a { text-decoration:none; }
    @media (max-width:560px) {
        .px { padding-left:24px !important; padding-right:24px !important; }
        .col { display:block !important; width:100% !important; padding:0 0 12px 0 !important; }
        .hero-t { font-size:34px !important; }
        .num { font-size:72px !important; }
        .btn a { display:block !important; padding:20px 18px !important; font-size:17px !important; }
    }
</style>
</head>
<body style="margin:0;padding:0;background:#05080a;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Acepta tu invitación y activa {{ $inv['producto'] }} por {{ $inv['meses'] }} meses en tu propia cuenta.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#05080a;background-image:radial-gradient(ellipse at top,#0e2a22 0%,#05080a 60%);">
<tr><td align="center" style="padding:36px 12px 40px 12px;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

    {{-- Marca --}}
    <tr><td align="center" style="padding:0 0 26px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <span style="display:inline-block;padding:7px 14px;border:1px solid #1f3d33;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:3px;color:#6ee9c2;">ZENGPT</span>
    </td></tr>

    {{-- Tarjeta principal --}}
    <tr><td style="background:#0b1210;border:1px solid #1a2c26;border-radius:28px;overflow:hidden;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

        {{-- Hero --}}
        <tr><td class="px" align="center" style="padding:48px 44px 8px 44px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
            <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#7f8d88;">Tu acceso está listo</p>
            <h1 class="hero-t" style="margin:14px 0 0 0;font-size:40px;line-height:1.1;font-weight:800;letter-spacing:-1px;color:#ffffff;">{{ $inv['producto'] }}</h1>
        </td></tr>

        <tr><td align="center" style="padding:22px 44px 6px 44px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td align="center" style="padding:22px 38px;border-radius:24px;background:#0f1d18;background-image:linear-gradient(160deg,#123a2e 0%,#0b1210 100%);border:1px solid #1f4a3b;">
                    <p class="num" style="margin:0;font-size:84px;line-height:1;font-weight:800;letter-spacing:-3px;color:#34d8a6;">{{ $inv['meses'] }}</p>
                    <p style="margin:6px 0 0 0;font-size:14px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#a4b1ac;">meses</p>
                </td>
            </tr></table>
        </td></tr>

        <tr><td class="px" align="center" style="padding:26px 52px 0 52px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
            <p style="margin:0;font-size:17px;line-height:1.6;color:#c4d0cc;">Ya apartamos tu lugar. Acepta la invitación con tu cuenta<br>
                <span style="color:#ffffff;font-weight:700;">{{ $correo }}</span></p>
        </td></tr>

        {{-- Botón --}}
        <tr><td class="px btn" align="center" style="padding:30px 44px 0 44px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
            <a href="{{ $liga }}" target="_blank" style="display:inline-block;padding:20px 40px;border-radius:999px;background:#22c55e;background-image:linear-gradient(135deg,#4ade80 0%,#16a34a 100%);color:#04210f;font-size:18px;font-weight:800;letter-spacing:-0.2px;box-shadow:0 10px 30px rgba(34,197,94,0.35);">{{ $inv['boton'] }}</a>
        </td></tr>
        @if ($vence)
        <tr><td align="center" style="padding:16px 44px 0 44px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
            <p style="margin:0;font-size:13px;color:#7f8d88;">Invitación personal · válida hasta el <span style="color:#c4d0cc;">{{ $vence }}</span></p>
        </td></tr>
        @endif

        {{-- Separador --}}
        <tr><td style="padding:44px 44px 0 44px;"><div style="height:1px;background:#1a2c26;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>

        {{-- Beneficios --}}
        <tr><td class="px" style="padding:36px 36px 8px 36px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
            <p style="margin:0 0 22px 0;text-align:center;font-size:13px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#34d8a6;">Todo lo que incluye</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                @foreach ($filas as $fila)
                <tr>
                    @foreach ($fila as $b)
                    <td class="col" width="50%" valign="top" style="padding:0 6px 12px 6px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f1a17;border:1px solid #1a2c26;border-radius:18px;">
                            <tr><td style="padding:20px 20px 20px 20px;">
                                <p style="margin:0;font-size:26px;line-height:1;">{{ $b['icono'] }}</p>
                                <p style="margin:14px 0 0 0;font-size:16px;font-weight:700;color:#ffffff;">{{ $b['titulo'] }}</p>
                                <p style="margin:6px 0 0 0;font-size:14px;line-height:1.5;color:#93a39d;">{{ $b['texto'] }}</p>
                            </td></tr>
                        </table>
                    </td>
                    @endforeach
                </tr>
                @endforeach
            </table>
        </td></tr>

        {{-- Pasos --}}
        <tr><td class="px" style="padding:22px 44px 44px 44px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
            <p style="margin:0 0 18px 0;text-align:center;font-size:13px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#34d8a6;">Actívalo en 3 pasos</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                @foreach (['Toca el botón verde.', 'Entra con tu Gmail '.$correo.'.', 'Acepta unirte al grupo familiar. ¡Listo!'] as $i => $paso)
                <tr>
                    <td width="44" valign="top" style="padding:0 0 14px 0;">
                        <div style="width:30px;height:30px;border-radius:50%;background:#123a2e;color:#34d8a6;font-size:14px;font-weight:800;line-height:30px;text-align:center;">{{ $i + 1 }}</div>
                    </td>
                    <td valign="middle" style="padding:0 0 14px 0;font-size:15px;line-height:1.5;color:#c4d0cc;">{{ $paso }}</td>
                </tr>
                @endforeach
            </table>
        </td></tr>

    </table>
    </td></tr>

    {{-- Pie --}}
    <tr><td align="center" class="px" style="padding:26px 40px 0 40px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <p style="margin:0;font-size:12px;line-height:1.7;color:#5d6b66;">¿El botón no abre? Copia esta liga en tu navegador:<br>
            <a href="{{ $liga }}" style="color:#34d8a6;word-break:break-all;">{{ $liga }}</a></p>
        <p style="margin:18px 0 0 0;font-size:12px;line-height:1.7;color:#5d6b66;">ZenGPT · ¿Dudas? Responde a este correo.</p>
    </td></tr>

</table>
</td></tr>
</table>
</body>
</html>
