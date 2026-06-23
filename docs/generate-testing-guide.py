#!/usr/bin/env python3
"""Regenerate Xitty testing guide PDF (v3) adding curated-content section."""

from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, KeepTogether,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from PIL import Image as PILImage

SCREENSHOTS_DIR = Path("/Users/1234/xitty/xitty-frontend/screenshots")
OUT_PATH = Path("/Users/1234/xitty/xitty-backend/docs/xitty-testing-guide.pdf")

# ---------- styles ----------
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    "TitleX", parent=styles["Title"], fontName="Helvetica-Bold",
    fontSize=28, textColor=colors.HexColor("#FF5A4E"), alignment=TA_CENTER,
    spaceAfter=12,
)
subtitle_style = ParagraphStyle(
    "SubtitleX", parent=styles["Normal"], fontName="Helvetica",
    fontSize=14, alignment=TA_CENTER, textColor=colors.HexColor("#333333"),
    spaceAfter=6,
)
small_center = ParagraphStyle(
    "SmallCenter", parent=styles["Normal"], fontName="Helvetica",
    fontSize=11, alignment=TA_CENTER, textColor=colors.HexColor("#666666"),
)
h1_style = ParagraphStyle(
    "H1X", parent=styles["Heading1"], fontName="Helvetica-Bold",
    fontSize=18, textColor=colors.HexColor("#0E9F8C"),
    spaceBefore=4, spaceAfter=10,
)
h2_style = ParagraphStyle(
    "H2X", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=14, textColor=colors.HexColor("#FF5A4E"),
    spaceBefore=10, spaceAfter=6,
)
h3_style = ParagraphStyle(
    "H3X", parent=styles["Heading3"], fontName="Helvetica-Bold",
    fontSize=12, textColor=colors.HexColor("#333333"),
    spaceBefore=8, spaceAfter=4,
)
body_style = ParagraphStyle(
    "BodyX", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=10.5, leading=14, alignment=TA_LEFT, spaceAfter=6,
)
toc_style = ParagraphStyle(
    "TocX", parent=styles["Normal"], fontName="Helvetica",
    fontSize=11, leading=16,
)
caption_style = ParagraphStyle(
    "CapX", parent=styles["Normal"], fontName="Helvetica-Oblique",
    fontSize=9.5, alignment=TA_CENTER, textColor=colors.HexColor("#555555"),
    spaceBefore=4,
)
filename_style = ParagraphStyle(
    "FileX", parent=styles["Normal"], fontName="Courier",
    fontSize=8.5, alignment=TA_CENTER, textColor=colors.HexColor("#888888"),
    spaceAfter=10,
)


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#888888"))
    canvas.drawString(2 * cm, 1.2 * cm, "Xitty - Guia de Testing")
    canvas.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f"Pagina {doc.page}")
    canvas.restoreState()


def make_table(rows, col_widths=None, header=True):
    t = Table(rows, colWidths=col_widths, repeatRows=1 if header else 0)
    style = [
        ("FONT", (0, 0), (-1, -1), "Helvetica", 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0E9F8C")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 10),
        ]
    t.setStyle(TableStyle(style))
    return t


def add_screenshot(story, path: Path, caption: str, max_w=15 * cm, max_h=10 * cm):
    if not path.exists():
        story.append(Paragraph(f"<i>(falta: {path.name})</i>", caption_style))
        return
    try:
        pil = PILImage.open(path)
        w, h = pil.size
        ratio = min(max_w / w, max_h / h)
        new_w, new_h = w * ratio, h * ratio
        img = Image(str(path), width=new_w, height=new_h)
        img.hAlign = "CENTER"
        story.append(img)
        story.append(Paragraph(caption, caption_style))
        story.append(Paragraph(path.name, filename_style))
    except Exception as e:
        story.append(Paragraph(f"<i>(error con {path.name}: {e})</i>", caption_style))


def build():
    doc = SimpleDocTemplate(
        str(OUT_PATH), pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
        title="Xitty - Guia de Testing",
    )
    story = []

    # ---------- COVER ----------
    story.append(Spacer(1, 5 * cm))
    story.append(Paragraph("XITTY", title_style))
    story.append(Paragraph("Guia de Testing", subtitle_style))
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph("Plataforma de turismo para Barranquilla, Colombia", small_center))
    story.append(Paragraph(
        "Documentacion para testers: roles, flujos, rutas y casos de prueba",
        small_center,
    ))
    story.append(Spacer(1, 1.5 * cm))
    story.append(Paragraph("v5 - Junio 2026", small_center))
    story.append(PageBreak())

    # ---------- TOC ----------
    story.append(Paragraph("Contenido", h1_style))
    toc_items = [
        "1. Introduccion",
        "2. Credenciales",
        "3. Probar por rol",
        "&nbsp;&nbsp;&nbsp;&nbsp;3.1 Visitante publico (sin sesion iniciada)",
        "&nbsp;&nbsp;&nbsp;&nbsp;3.2 Turista",
        "&nbsp;&nbsp;&nbsp;&nbsp;3.3 Dueno de negocio",
        "&nbsp;&nbsp;&nbsp;&nbsp;3.4 Administrador",
        "4. Flujos de prueba",
        "&nbsp;&nbsp;&nbsp;&nbsp;4.1 Registro y verificacion de correo",
        "&nbsp;&nbsp;&nbsp;&nbsp;4.2 Inicio de sesion y recuperacion de contrasena",
        "&nbsp;&nbsp;&nbsp;&nbsp;4.3 Onboarding del turista",
        "&nbsp;&nbsp;&nbsp;&nbsp;4.4 Explorar lugares y experiencias",
        "&nbsp;&nbsp;&nbsp;&nbsp;4.5 Reservar una experiencia",
        "&nbsp;&nbsp;&nbsp;&nbsp;4.6 Gestion de negocio (dueno)",
        "&nbsp;&nbsp;&nbsp;&nbsp;4.7 Gestion de patrocinios (admin)",
        "&nbsp;&nbsp;&nbsp;&nbsp;4.8 Microsite publico",
        "4bis. Nuevas features del pivot",
        "&nbsp;&nbsp;&nbsp;&nbsp;4bis.1 Vale la pena hacer hoy",
        "&nbsp;&nbsp;&nbsp;&nbsp;4bis.2 Ads / Promociones hero",
        "&nbsp;&nbsp;&nbsp;&nbsp;4bis.3 Zona segura y geofencing",
        "&nbsp;&nbsp;&nbsp;&nbsp;4bis.4 Chat AI",
        "&nbsp;&nbsp;&nbsp;&nbsp;4bis.5 Selector de idioma (i18n)",
        "4ter. Contenido curado con IA  <font color='#FF5A4E'><b>(nuevo)</b></font>",
        "&nbsp;&nbsp;&nbsp;&nbsp;4ter.1 Que es y como funciona",
        "&nbsp;&nbsp;&nbsp;&nbsp;4ter.2 Como probar el flujo",
        "&nbsp;&nbsp;&nbsp;&nbsp;4ter.3 Variables de entorno y cron semanal",
        "&nbsp;&nbsp;&nbsp;&nbsp;4ter.4 Pruebas automatizadas (autotest)",
        "&nbsp;&nbsp;&nbsp;&nbsp;4ter.5 Checklist de validacion + estado conocido",
        "5. Indice de rutas",
        "6. Casos especiales",
        "7. Notas para el tester",
        "8. Screenshots de referencia",
    ]
    for item in toc_items:
        story.append(Paragraph(item, toc_style))
    story.append(PageBreak())

    # ---------- 1. INTRO ----------
    story.append(Paragraph("1. Introduccion", h1_style))
    story.append(Paragraph(
        "Xitty es una plataforma de turismo enfocada en Barranquilla, Colombia. Conecta turistas con "
        "lugares (restaurantes, sitios turisticos, playas, bares, etc.), experiencias bookables "
        "(tours, talleres, aventuras), y permite a los duenos de negocios gestionar su presencia y "
        "promociones. La plataforma tiene tres tipos de usuarios:",
        body_style,
    ))
    story.append(Paragraph("- Turista: descubre lugares, guarda favoritos, hace reservas y resenas.", body_style))
    story.append(Paragraph(
        "- Dueno de negocio: gestiona su lugar, experiencias, promociones y revisa metricas.",
        body_style,
    ))
    story.append(Paragraph(
        "- Administrador: gestiona patrocinios, contenido curado por IA y supervisa la plataforma.",
        body_style,
    ))
    story.append(PageBreak())

    # ---------- 2. CREDENCIALES ----------
    story.append(Paragraph("2. Credenciales", h1_style))
    story.append(Paragraph(
        "Contrasena unica para todas las cuentas de prueba: <b>xitty-seed-2026</b>",
        body_style,
    ))

    story.append(Paragraph("Turistas", h2_style))
    story.append(Paragraph(
        "30 cuentas en total. Las primeras 25 tienen preferencias completas y entran directo al home. "
        "Las ultimas 5 (026 a 030) no tienen preferencias y se redirigen al onboarding al iniciar sesion.",
        body_style,
    ))
    tur_rows = [["Etiqueta", "Email", "Password", "Rol"]]
    tur_rows += [
        ["Turista activa principal", "seed_turista_023@xitty.local", "xitty-seed-2026", "user"],
        ["Turista activa", "seed_turista_001@xitty.local", "xitty-seed-2026", "user"],
        ["Turista activa", "seed_turista_002@xitty.local", "xitty-seed-2026", "user"],
        ["Sin onboarding", "seed_turista_026@xitty.local", "xitty-seed-2026", "user"],
        ["Sin onboarding", "seed_turista_030@xitty.local", "xitty-seed-2026", "user"],
    ]
    story.append(make_table(tur_rows, col_widths=[4.2*cm, 6.5*cm, 4*cm, 2.3*cm]))

    story.append(Paragraph("Duenos de negocio", h2_style))
    duenos = [["Etiqueta", "Email", "Password", "Rol"]]
    duenos += [
        ["Cultura", "seed_dueno_007@xitty.local", "xitty-seed-2026", "business"],
        ["Compras", "seed_dueno_008@xitty.local", "xitty-seed-2026", "business"],
        ["Naturaleza", "seed_dueno_009@xitty.local", "xitty-seed-2026", "business"],
        ["Deportes", "seed_dueno_010@xitty.local", "xitty-seed-2026", "business"],
    ]
    story.append(make_table(duenos, col_widths=[4.2*cm, 6.5*cm, 4*cm, 2.3*cm]))

    story.append(Paragraph("Administradores", h2_style))
    admins = [["Etiqueta", "Email", "Password", "Rol"]]
    admins += [
        ["Admin principal", "seed_admin_001@xitty.local", "xitty-seed-2026", "admin"],
        ["Admin editorial", "seed_admin_002@xitty.local", "xitty-seed-2026", "admin"],
    ]
    story.append(make_table(admins, col_widths=[4.2*cm, 6.5*cm, 4*cm, 2.3*cm]))
    story.append(PageBreak())

    # ---------- 3. ROLES ----------
    story.append(Paragraph("3. Probar por rol", h1_style))

    story.append(Paragraph("3.1 Visitante publico", h2_style))
    story.append(Paragraph(
        "Sin sesion iniciada el visitante solo puede ver los microsites publicos de cada lugar "
        "(/microsites/<slug>), el formulario de login, el de registro y las pantallas de recuperacion "
        "de contrasena.",
        body_style,
    ))

    story.append(Paragraph("3.2 Turista", h2_style))
    story.append(Paragraph(
        "El turista accede al home personalizado, directorio de lugares, catalogo de experiencias, "
        "favoritos, reservas, perfil, promociones y la nueva seccion 'Descubre lo nuevo' con contenido "
        "curado.",
        body_style,
    ))

    story.append(Paragraph("3.3 Dueno de negocio", h2_style))
    story.append(Paragraph(
        "Gestiona su lugar, sube fotos, crea y edita experiencias, define cupos, crea promociones y "
        "revisa metricas en su dashboard.",
        body_style,
    ))

    story.append(Paragraph("3.4 Administrador", h2_style))
    story.append(Paragraph(
        "Accede a /admin/sponsorships y al nuevo /admin/scraping para revisar el contenido curado por "
        "IA antes de publicarlo en el home de turistas.",
        body_style,
    ))
    story.append(PageBreak())

    # ---------- 4. FLUJOS ----------
    story.append(Paragraph("4. Flujos de prueba", h1_style))

    story.append(Paragraph("4.1 Registro y verificacion de correo", h2_style))
    flow_rows = [["#", "Accion", "Ruta o elemento"]]
    flow_rows += [
        ["1", "Acceder al formulario de registro", "/register"],
        ["2", "Completar email, nombre y password", "(formulario)"],
        ["3", "Recibir codigo OTP y completarlo", "/verify-email"],
        ["4", "Confirmar redireccion al onboarding", "/onboarding"],
    ]
    story.append(make_table(flow_rows, col_widths=[1.2*cm, 9*cm, 6.8*cm]))

    story.append(Paragraph("4.2 Inicio de sesion y recuperacion", h2_style))
    flow_rows = [["#", "Accion", "Ruta o elemento"]]
    flow_rows += [
        ["1", "Iniciar sesion con credenciales validas", "/login"],
        ["2", "Solicitar recuperacion de contrasena", "/forgot-password"],
        ["3", "Confirmar nueva contrasena con el enlace", "/reset-password"],
    ]
    story.append(make_table(flow_rows, col_widths=[1.2*cm, 9*cm, 6.8*cm]))

    story.append(Paragraph("4.3 Onboarding del turista", h2_style))
    story.append(Paragraph(
        "Wizard de tres pasos para nuevos turistas: intereses, ubicacion de referencia y momento del "
        "dia preferido. Usar las cuentas seed_turista_026 a 030 para verlo activo.",
        body_style,
    ))

    story.append(Paragraph("4.4 Explorar lugares y experiencias", h2_style))
    story.append(Paragraph(
        "Desde el home y desde /places se filtra por categoria, precio y rating. Las cards muestran "
        "fotos, etiquetas y razon de aparicion. /experiences lista experiencias bookables.",
        body_style,
    ))

    story.append(Paragraph("4.5 Reservar una experiencia", h2_style))
    flow_rows = [["#", "Accion", "Ruta o elemento"]]
    flow_rows += [
        ["1", "Abrir detalle de una experiencia", "/experiences/<slug>"],
        ["2", "Elegir cupo (fecha y hora)", "(selector de cupos)"],
        ["3", "Confirmar la reserva", "(boton reservar)"],
        ["4", "Acceder a mis reservas", "/reservations"],
        ["5", "Cancelar (libera el cupo)", "(boton Cancelar)"],
        ["6", "Resenar experiencia completada", "(pestana Pasadas)"],
    ]
    story.append(make_table(flow_rows, col_widths=[1.2*cm, 9*cm, 6.8*cm]))

    story.append(Paragraph("4.6 Gestion de negocio (dueno)", h2_style))
    flow_rows = [["#", "Accion", "Ruta o elemento"]]
    flow_rows += [
        ["1", "Iniciar sesion como dueno", "/login"],
        ["2", "Editar datos del lugar", "/dashboard/place"],
        ["3", "Crear nuevo cupo", "(detalle de experiencia)"],
        ["4", "Crear una promocion", "/dashboard/promotions"],
        ["5", "Revisar metricas", "/dashboard/metrics"],
    ]
    story.append(make_table(flow_rows, col_widths=[1.2*cm, 9*cm, 6.8*cm]))

    story.append(Paragraph("4.7 Gestion de patrocinios (admin)", h2_style))
    flow_rows = [["#", "Accion", "Ruta o elemento"]]
    flow_rows += [
        ["1", "Login como administrador", "/login"],
        ["2", "Acceder al panel", "/admin/sponsorships"],
        ["3", "Marcar o quitar patrocinio", "(toggle)"],
        ["4", "Refrescar el home y confirmar orden", "/"],
    ]
    story.append(make_table(flow_rows, col_widths=[1.2*cm, 9*cm, 6.8*cm]))

    story.append(Paragraph("4.8 Microsite publico", h2_style))
    flow_rows = [["#", "Accion", "Ruta o elemento"]]
    flow_rows += [
        ["1", "Cerrar sesion o usar incognito", "(navegador)"],
        ["2", "Acceder a un microsite por URL", "/microsites/cocina-33"],
        ["3", "Revisar galeria, resenas y promociones", "(microsite)"],
        ["4", "Probar el boton 'Crear cuenta'", "/register"],
    ]
    story.append(make_table(flow_rows, col_widths=[1.2*cm, 9*cm, 6.8*cm]))
    story.append(PageBreak())

    # ---------- 4bis ----------
    story.append(Paragraph("4bis. Nuevas features del pivot", h1_style))
    story.append(Paragraph(
        "Funcionalidades incorporadas en las fases recientes: personalizacion, promociones destacadas, "
        "sugerencias por ubicacion, asistente conversacional y soporte de idiomas.",
        body_style,
    ))

    story.append(Paragraph("4bis.1 Vale la pena hacer hoy", h2_style))
    story.append(Paragraph(
        "Home con cards personalizadas combinando preferencias, ubicacion, hora del dia y ranking. "
        "Cuenta recomendada: seed_turista_023. Esperar carrusel con 5 a 8 cards y chips de razon.",
        body_style,
    ))

    story.append(Paragraph("4bis.2 Ads / Promociones hero", h2_style))
    story.append(Paragraph(
        "Primer slot del home con promociones rotando cada 5 segundos. Tracking de impresiones "
        "automatico. Esperar 15 s y validar minimo 3 banners.",
        body_style,
    ))

    story.append(Paragraph("4bis.3 Zona segura y geofencing", h2_style))
    story.append(Paragraph(
        "Badge en el topbar con nombre de zona y color (verde / amarillo / rojo). Requiere permiso "
        "de ubicacion. Si se niega, el badge no aparece.",
        body_style,
    ))

    story.append(Paragraph("4bis.4 Chat AI", h2_style))
    story.append(Paragraph(
        "Bubble flotante abajo-derecha. Quick replies y entrada libre. Requiere GEMINI_API_KEY; sin "
        "ella responde con keyword matching basico.",
        body_style,
    ))

    story.append(Paragraph("4bis.5 Selector de idioma (i18n)", h2_style))
    story.append(Paragraph(
        "Icono de globo en topbar con ES, EN, FR, PT. Solo afecta UI base; catalogo permanece en ES.",
        body_style,
    ))
    story.append(PageBreak())

    # ---------- 4ter (NEW) ----------
    story.append(Paragraph("4ter. Contenido curado con IA", h1_style))
    story.append(Paragraph(
        "Nuevo modulo (junio 2026) que automatiza el descubrimiento de actividades en Barranquilla. "
        "Combina ingesta de fuentes externas, normalizacion con LLM y moderacion humana antes de "
        "publicar en el home.",
        body_style,
    ))

    story.append(Paragraph("4ter.1 Que es y como funciona", h2_style))
    story.append(Paragraph(
        "Tool semanal del backend que trae tours, eventos y experiencias desde tres fuentes y los "
        "normaliza con un LLM:",
        body_style,
    ))
    fuentes = [["Fuente", "Que aporta", "Endpoint usado"]]
    fuentes += [
        ["Google Maps Places", "Tours, atracciones y puntos turisticos cercanos", "Places API v1"],
        ["Eventbrite", "Eventos publicados con fecha y precio", "Eventbrite Events"],
        ["Tavily (web search)", "Articulos y blogs con planes de fin de semana", "Tavily Search API"],
    ]
    story.append(make_table(fuentes, col_widths=[4*cm, 8*cm, 5*cm]))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        "Cada item crudo pasa por <b>Gemini Flash</b>, que limpia titulo, descripcion, extrae tags y "
        "lo deja en formato comun. El admin recibe los items en estado 'pendiente' y puede aprobar, "
        "editar o descartar. Los aprobados se publican en la seccion <b>'Descubre lo nuevo'</b> del "
        "home del turista.",
        body_style,
    ))

    story.append(Paragraph("4ter.2 Como probar el flujo", h2_style))
    flow_rows = [["#", "Accion", "Ruta o elemento"]]
    flow_rows += [
        ["1", "Iniciar sesion como administrador", "/login (seed_admin_001)"],
        ["2", "Abrir el panel de contenido curado", "/admin/scraping"],
        ["3", "Revisar la lista de runs (corridas semanales)", "(tabla superior)"],
        ["4", "Abrir un run y ver items normalizados", "(detalle de run)"],
        ["5", "Mover un item de 'pendiente' a 'aprobado'", "(boton aprobar)"],
        ["6", "Editar titulo o descripcion antes de aprobar", "(modal de edicion)"],
        ["7", "Descartar items irrelevantes o duplicados", "(boton descartar)"],
        ["8", "Lanzar un run manual para repoblar", "(boton 'Ejecutar ahora')"],
        ["9", "Cerrar sesion y entrar como turista", "/login (seed_turista_023)"],
        ["10", "Validar que los aprobados aparecen en el home", "/ (seccion Descubre lo nuevo)"],
    ]
    story.append(make_table(flow_rows, col_widths=[1.2*cm, 9*cm, 6.8*cm]))

    story.append(Paragraph("4ter.3 Variables de entorno y cron semanal", h2_style))
    story.append(Paragraph(
        "Las tres fuentes externas son opcionales. Si las API keys no estan configuradas, el modulo "
        "usa <i>mock data</i> y el flujo de moderacion sigue funcionando igual.",
        body_style,
    ))
    envs = [["Variable", "Para que", "Si falta..."]]
    envs += [
        ["GOOGLE_MAPS_API_KEY", "Llamadas a Google Places API v1", "Mock: 5 lugares de ejemplo"],
        ["EVENTBRITE_API_KEY", "Llamadas a Eventbrite Events API", "Mock: 3 eventos de ejemplo"],
        ["TAVILY_API_KEY", "Web search para articulos de planes", "Mock: 4 articulos de ejemplo"],
        ["GEMINI_API_KEY", "Normalizacion LLM de los items crudos", "Pasa el item tal cual sin limpiar"],
    ]
    story.append(make_table(envs, col_widths=[5.2*cm, 7*cm, 4.8*cm]))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        "<b>Cron semanal:</b> el job corre cada <b>lunes a las 8:00 AM UTC</b> (3:00 AM hora "
        "Barranquilla) via pg_cron en Supabase. Lanza un run, ingesta las tres fuentes, normaliza con "
        "Gemini y deja los items en 'pendiente' para que el admin los revise durante la semana.",
        body_style,
    ))
    story.append(PageBreak())

    # ---------- 4ter.4 Autotest ----------
    story.append(Paragraph("4ter.4 Pruebas automatizadas (autotest)", h2_style))
    story.append(Paragraph(
        "El modulo trae una bateria de pruebas automaticas que corren en cada cambio. Cubren la logica "
        "de cada pieza con datos simulados, sin pegarle a las APIs externas ni a la base real.",
        body_style,
    ))
    auto_rows = [["Capa", "Que valida automaticamente", "Como correrla"]]
    auto_rows += [
        ["Storage (backend)", "Guardar runs e items crudos/normalizados, deduplicacion", "npm run test -- scraping/storage"],
        ["Enrichment (backend)", "Normalizacion con LLM (mock), reintentos, score de calidad", "npm run test -- scraping/enrichment"],
        ["Fuentes (backend)", "Google/Eventbrite/Tavily con mock + reintento ante error", "npm run test -- sources"],
        ["Runner (backend)", "Orquestacion fetch -> normaliza -> guarda, conteos", "npm run test -- scheduler"],
        ["Moderacion (backend)", "Aprobar / editar / descartar / publicar", "npm run test -- admin-scraping"],
        ["Discover publico (backend)", "Solo items publicados, orden por calidad", "npm run test -- discover"],
        ["Curated UI (frontend)", "Card con badge 'Curado con IA', atribucion de fuente", "npm run test:run -- curated"],
        ["Panel admin (frontend)", "Cola de moderacion, editor, acciones", "npm run test:run -- admin-scraping"],
    ]
    story.append(make_table(auto_rows, col_widths=[4.2*cm, 8*cm, 4.8*cm]))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        "<b>Correr todo de una:</b> en el backend <font face='Courier'>npm run test</font> y en el "
        "frontend <font face='Courier'>npm run test:run</font>. Para el recorrido visual con navegador "
        "(capturas de la seccion curada y del panel admin) se usa Playwright: "
        "<font face='Courier'>npx playwright test e2e/screenshots-curated.spec.ts</font>.",
        body_style,
    ))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        "<b>Que NO cubre el autotest:</b> las pruebas simulan las fuentes externas y la base, asi que "
        "no detectan diferencias entre lo que el frontend espera y lo que el backend devuelve de "
        "verdad, ni fallas de SQL en la base real. Por eso, ademas del autotest, hay que recorrer el "
        "flujo manual de 4ter.2 contra el entorno real al menos una vez por release.",
        body_style,
    ))
    story.append(Spacer(1, 0.3 * cm))

    # ---------- 4ter.5 Checklist + estado conocido ----------
    story.append(Paragraph("4ter.5 Checklist de validacion + estado conocido", h2_style))
    story.append(Paragraph("Marca cada punto al probar el modulo en un entorno real:", body_style))
    check_rows = [["#", "Que verificar", "Resultado esperado"]]
    check_rows += [
        ["1", "Entrar como admin a /admin/scraping", "Carga el panel con las 3 pestanas (fuentes, runs, moderacion)"],
        ["2", "Pulsar 'Ejecutar ahora' en una fuente", "Aparece un run nuevo con conteo de items encontrados"],
        ["3", "Abrir la cola de moderacion", "Lista de items en estado 'pendiente' con titulo y datos normalizados"],
        ["4", "Editar un item y guardar", "Los cambios persisten al reabrirlo"],
        ["5", "Aprobar y publicar un item", "Pasa a estado 'publicado'"],
        ["6", "Descartar un item con motivo", "Pasa a 'rechazado' y guarda el motivo"],
        ["7", "Entrar como turista al home", "El item publicado aparece en 'Descubre lo nuevo' con badge 'Curado con IA'"],
        ["8", "Abrir el detalle de un item curado", "Muestra el enlace a la fuente original + fecha de recoleccion"],
    ]
    story.append(make_table(check_rows, col_widths=[1.2*cm, 8.3*cm, 7.5*cm]))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("Estado conocido (al cierre de esta version)", h3_style))
    story.append(Paragraph(
        "El panel de moderacion, el editor, la publicacion y la seccion publica estan completos y "
        "probados. Hay dos ajustes en curso que conviene tener presentes al testear el flujo "
        "<b>'Ejecutar ahora' de punta a punta</b>:",
        body_style,
    ))
    for txt in [
        "El boton 'Ejecutar ahora' y la cola de moderacion estan siendo conectados al mismo "
        "almacen, por lo que un run lanzado manualmente puede no reflejar sus items en la cola "
        "hasta aplicar el ajuste. Mientras tanto, la moderacion se puede probar con los items ya "
        "sembrados / del cron.",
        "El mensaje de confirmacion tras 'Ejecutar ahora' y el aviso al cancelar un descarte estan "
        "en pulido (textos menores). No afectan los datos.",
    ]:
        story.append(Paragraph("&bull; " + txt, body_style))
    story.append(Paragraph(
        "Para una demo inmediata sin depender del 'Ejecutar ahora', el contenido sembrado ya incluye "
        "items curados publicados visibles en el home.",
        body_style,
    ))
    story.append(PageBreak())

    # ---------- 5. INDICE DE RUTAS ----------
    story.append(Paragraph("5. Indice de rutas", h1_style))
    story.append(Paragraph("Listado completo de rutas de la aplicacion organizado por area.", body_style))

    story.append(Paragraph("Rutas publicas", h2_style))
    pub = [["Ruta", "Que probar"]]
    pub += [
        ["/login", "Inicio de sesion"],
        ["/register", "Registro de cuenta nueva"],
        ["/verify-email", "Verificacion de email con codigo"],
        ["/forgot-password", "Solicitud de recuperacion"],
        ["/reset-password", "Confirmacion de recuperacion"],
        ["/microsites/<slug>", "Microsite publico de un lugar"],
    ]
    story.append(make_table(pub, col_widths=[6*cm, 11*cm]))

    story.append(Paragraph("Rutas de turista", h2_style))
    tur = [["Ruta", "Que probar"]]
    tur += [
        ["/", "Home con cuatro carruseles + 'Descubre lo nuevo'"],
        ["/onboarding", "Wizard de preferencias"],
        ["/places", "Directorio con filtros"],
        ["/places/<slug>", "Detalle de un lugar"],
        ["/experiences", "Catalogo de experiencias"],
        ["/experiences/<slug>", "Detalle y reserva"],
        ["/favorites", "Lugares guardados"],
        ["/reservations", "Mis reservas"],
        ["/profile", "Perfil y datos personales"],
        ["/promotions", "Listado de promociones activas"],
    ]
    story.append(make_table(tur, col_widths=[6*cm, 11*cm]))

    story.append(Paragraph("Rutas de dueno", h2_style))
    due = [["Ruta", "Que probar"]]
    due += [
        ["/dashboard", "Resumen general"],
        ["/dashboard/place", "Editar lugar y fotos"],
        ["/dashboard/experiences", "Gestion de experiencias"],
        ["/dashboard/promotions", "Gestion de promociones"],
        ["/dashboard/metrics", "Metricas y graficas"],
        ["/dashboard/settings", "Notificaciones"],
    ]
    story.append(make_table(due, col_widths=[6*cm, 11*cm]))

    story.append(Paragraph("Rutas de administrador", h2_style))
    adm = [["Ruta", "Que probar"]]
    adm += [
        ["/admin/sponsorships", "Gestion de patrocinios"],
        ["/admin/scraping", "Contenido curado con IA (runs, items, moderacion)"],
    ]
    story.append(make_table(adm, col_widths=[6*cm, 11*cm]))
    story.append(PageBreak())

    # ---------- 6. CASOS ESPECIALES ----------
    story.append(Paragraph("6. Casos especiales", h1_style))
    story.append(Paragraph(
        "Lugares y situaciones sembradas con proposito de testeo para verificar estados especificos.",
        body_style,
    ))
    casos = [["Caso", "Que probar"]]
    casos += [
        ["/places/el-recien-abierto-sin-resenas-aun", "Lugar sin fotos ni resenas (estado vacio)"],
        ["/places/el-5-estrellas-sin-defectos", "25 resenas de 5 estrellas (rating maximo)"],
        ["/places/el-decepcionante-mejor-pasar-de-largo", "15 resenas bajas (rating ~2.0)"],
        ["seed_turista_026 a 030", "Sin preferencias: van al wizard"],
        ["Cupo pasado", "Reserva completada: permite resenar"],
        ["/admin/sponsorships", "Acceso turista / dueno: bloqueado"],
        ["/admin/scraping", "Acceso turista / dueno: bloqueado"],
    ]
    story.append(make_table(casos, col_widths=[7*cm, 10*cm]))
    story.append(PageBreak())

    # ---------- 7. NOTAS ----------
    story.append(Paragraph("7. Notas para el tester", h1_style))
    story.append(Paragraph("Refresco de pagina", h3_style))
    story.append(Paragraph(
        "Si los cambios no se reflejan, forzar Cmd+Shift+R en Mac o Ctrl+Shift+R en Windows/Linux.",
        body_style,
    ))
    story.append(Paragraph("Filtros sin coincidencias", h3_style))
    story.append(Paragraph(
        "Si la combinacion de filtros no retorna resultados, eliminar uno y volver a aplicar.",
        body_style,
    ))
    story.append(Paragraph("Cupos llenos", h3_style))
    story.append(Paragraph(
        "Si un cupo alcanzo capacidad maxima, el sistema bloquea la reserva. Refrescar para ver el "
        "estado actualizado.",
        body_style,
    ))
    story.append(Paragraph("Contenido curado vacio", h3_style))
    story.append(Paragraph(
        "Si /admin/scraping no muestra runs, lanzar uno manual con el boton 'Ejecutar ahora'. Si "
        "tampoco hay items en el home, verificar que al menos un item este en estado 'aprobado'.",
        body_style,
    ))
    story.append(Paragraph("Reporte de incidencias", h3_style))
    story.append(Paragraph(
        "Incluir: ruta exacta, email de la cuenta, pasos previos, captura de pantalla, navegador y SO.",
        body_style,
    ))
    story.append(PageBreak())

    # ---------- 8. SCREENSHOTS ----------
    story.append(Paragraph("8. Screenshots de referencia", h1_style))
    story.append(Paragraph(
        "Capturas de las vistas principales. Sirven como referencia visual de lo que debe verse al "
        "recorrer cada flujo descrito en las secciones 3, 4 y 4ter.",
        body_style,
    ))

    shots = [
        # --- Features del pivot (Fases 1-3) ---
        ("pivot-home.png", "Turista - Home del pivot: 'Vale la pena hoy', chips de modalidad y categorias"),
        ("pivot-chat.png", "Turista - Chat AI (asistente Xi) con respuestas rapidas"),
        ("pivot-safety.png", "Turista - Home con ubicacion activa (badge de zona)"),
        ("pivot-language.png", "Selector de idioma (ES / EN / FR / PT)"),
        ("pivot-sos.png", "Boton SOS de emergencia"),
        # --- Contenido curado con IA (scraper) ---
        ("admin-sponsorships.png", "Admin - Gestion de patrocinios"),
        ("admin-scraping-overview.png", "Admin - Contenido curado: vista de runs (nuevo)"),
        ("admin-scraping-moderation.png", "Admin - Contenido curado: moderacion de items (nuevo)"),
        ("admin-scraping-item-detail.png", "Admin - Contenido curado: detalle de un item (nuevo)"),
        ("curated-section.png", "Turista - Seccion 'Descubre lo nuevo' en el home (nuevo)"),
        ("dashboard-metrics.png", "Dueno - Metricas"),
        ("dashboard-place.png", "Dueno - Edicion del lugar"),
        ("dashboard.png", "Dueno - Dashboard general"),
        ("experiences-list.png", "Turista - Catalogo de experiencias"),
        ("favorites.png", "Turista - Lugares favoritos"),
        ("home-tourist.png", "Turista - Home"),
        ("login-screen.png", "Acceso - Login"),
        ("microsite.png", "Publico - Microsite de un lugar"),
        ("place-detail.png", "Turista - Detalle de un lugar"),
        ("places-list.png", "Turista - Directorio de lugares"),
        ("profile.png", "Turista - Perfil"),
        ("register-screen.png", "Acceso - Registro"),
        ("reservations.png", "Turista - Mis reservas"),
    ]
    # two screenshots per page
    for idx, (fname, caption) in enumerate(shots):
        add_screenshot(story, SCREENSHOTS_DIR / fname, caption)
        story.append(Spacer(1, 0.3 * cm))
        if idx % 2 == 1 and idx != len(shots) - 1:
            story.append(PageBreak())

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"PDF written to {OUT_PATH}")


if __name__ == "__main__":
    build()
