<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>{{ $inv['asunto'] }}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef3f1;font-family:Arial,Helvetica,sans-serif;color:#0f1d18;">
<div style="display:none;max-height:0;overflow:hidden;">Tu lugar en {{ $inv['producto'] }} por {{ $inv['meses'] }} meses está listo: acepta la invitación con un clic.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef3f1;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(15,29,24,0.08);">

    <tr>
        <td style="background-color:#0b1411;background-image:linear-gradient(135deg,#0b1411 0%,#0f3a2d 55%,#1a7a5c 100%);padding:40px 36px 36px 36px;">
            <p style="margin:0 0 22px 0;font-size:15px;font-weight:bold;letter-spacing:2px;color:#6ee9c2;">ZENGPT</p>
            <h1 style="margin:0;font-size:30px;line-height:1.2;color:#ffffff;font-weight:bold;">Tu {{ $inv['producto'] }}<br>está listo</h1>
            <p style="margin:14px 0 0 0;font-size:16px;line-height:1.6;color:#cfe9df;">
                {{ $inv['meses'] }} meses de almacenamiento, inteligencia artificial y herramientas premium de Google, en tu propia cuenta.
            </p>
        </td>
    </tr>

    <tr>
        <td style="padding:32px 36px 8px 36px;">
            <p style="margin:0;font-size:16px;line-height:1.6;color:#2b3a35;">¡Hola! Ya te reservamos tu lugar. Solo tienes que aceptar la invitación con tu cuenta
                <strong style="color:#0f1d18;">{{ $correo }}</strong>.</p>
        </td>
    </tr>

    <tr>
        <td align="center" style="padding:24px 36px 8px 36px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                    <td align="center" bgcolor="#16a34a" style="border-radius:12px;background-color:#16a34a;background-image:linear-gradient(135deg,#22c55e 0%,#15803d 100%);">
                        <a href="{{ $liga }}" target="_blank" style="display:inline-block;padding:18px 34px;font-size:17px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px;">{{ $inv['boton'] }} &rarr;</a>
                    </td>
                </tr>
            </table>
            @if ($vence)
                <p style="margin:14px 0 0 0;font-size:13px;color:#6b7a75;">La invitación es personal y vence el <strong>{{ $vence }}</strong>.</p>
            @endif
        </td>
    </tr>

    <tr>
        <td style="padding:30px 36px 6px 36px;">
            <p style="margin:0 0 16px 0;font-size:13px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#15803d;">Lo que incluye</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                @foreach ($inv['beneficios'] as $b)
                    <tr>
                        <td valign="top" width="40" style="padding:0 0 18px 0;">
                            <div style="width:28px;height:28px;border-radius:50%;background-color:#dcfce7;color:#15803d;font-size:15px;font-weight:bold;line-height:28px;text-align:center;">&#10003;</div>
                        </td>
                        <td valign="top" style="padding:2px 0 18px 0;">
                            <p style="margin:0;font-size:15px;font-weight:bold;color:#0f1d18;">{{ $b['titulo'] }}</p>
                            <p style="margin:4px 0 0 0;font-size:14px;line-height:1.55;color:#55635e;">{{ $b['texto'] }}</p>
                        </td>
                    </tr>
                @endforeach
            </table>
        </td>
    </tr>

    <tr>
        <td style="padding:6px 36px 30px 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f8f6;border-radius:12px;">
                <tr><td style="padding:18px 20px;">
                    <p style="margin:0 0 8px 0;font-size:14px;font-weight:bold;color:#0f1d18;">Cómo activarlo</p>
                    <p style="margin:0;font-size:14px;line-height:1.7;color:#55635e;">
                        1. Toca el botón verde.<br>
                        2. Entra con tu Gmail <strong>{{ $correo }}</strong>.<br>
                        3. Acepta unirte al grupo familiar. ¡Listo! Los beneficios se activan al momento.
                    </p>
                </td></tr>
            </table>
            <p style="margin:18px 0 0 0;font-size:12px;line-height:1.6;color:#8a9893;word-break:break-all;">
                ¿El botón no abre? Copia esta liga en tu navegador:<br>
                <a href="{{ $liga }}" style="color:#15803d;">{{ $liga }}</a>
            </p>
        </td>
    </tr>

    <tr>
        <td style="background-color:#0b1411;padding:20px 36px;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#8fb3a7;">Enviado por ZenGPT. Si tienes dudas, responde a este correo o escríbele a tu vendedor.</p>
        </td>
    </tr>

</table>
</td></tr>
</table>
</body>
</html>
