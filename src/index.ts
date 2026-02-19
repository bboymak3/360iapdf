export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Manejo de Preflight para CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Método no permitido", { status: 405, headers: corsHeaders });
    }

    try {
      const { widgetId, nuevoContenido, fuente } = await request.json() as any;

      if (!widgetId || !nuevoContenido) {
        return new Response(JSON.stringify({ error: "Faltan datos requeridos" }), { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // 1. Obtener el contexto actual para no borrarlo
      const registro = await env.DB.prepare(
        `SELECT contexto_entrenamiento FROM "360ia_db" WHERE widget_id = ?`
      ).bind(widgetId).first();

      if (!registro) {
        return new Response(JSON.stringify({ error: "Widget ID no encontrado" }), { 
          status: 404, 
          headers: corsHeaders 
        });
      }

      // 2. Preparar la nueva información con separadores claros para la IA
      const timestamp = new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' });
      const bloqueNuevo = `
\n\n--- NUEVA INFORMACIÓN CARGADA (${fuente}) - ${timestamp} ---
${nuevoContenido.trim()}
----------------------------------------------------------\n`;

      const nuevoContextoTotal = (registro.contexto_entrenamiento as string) + bloqueNuevo;

      // 3. Actualizar la base de datos (haciendo el "Appender")
      await env.DB.prepare(
        `UPDATE "360ia_db" SET contexto_entrenamiento = ? WHERE widget_id = ?`
      ).bind(nuevoContextoTotal, widgetId).run();

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Información integrada al cerebro correctamente",
        fuente: fuente
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  }
};
