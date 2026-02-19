export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 1. Cabeceras CORS para que el Dashboard (HTML) pueda comunicarse con este Worker
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Responder a peticiones de control (Preflight)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Solo aceptamos POST para guardar datos
    if (request.method !== "POST") {
      return new Response("Método no permitido", { status: 405, headers: corsHeaders });
    }

    try {
      const body = await request.json() as any;
      const { widgetId, nuevoContenido, fuente } = body;

      // Validación de datos recibidos
      if (!widgetId || !nuevoContenido) {
        return new Response(JSON.stringify({ error: "Faltan datos requeridos" }), { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // 2. Obtener el contexto actual de la Base de Datos
      const registro = await env.DB.prepare(
        "SELECT contexto_entrenamiento FROM 360ia_db WHERE widget_id = ?"
      ).bind(widgetId).first();

      if (!registro) {
        return new Response(JSON.stringify({ error: "Widget no encontrado" }), { 
          status: 404, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // 3. Unir la información vieja con la nueva
      const fecha = new Date().toLocaleDateString();
      const bloqueNuevo = `\n\n=== NUEVO CONOCIMIENTO (${fuente} - ${fecha}) ===\n${nuevoContenido}\n`;
      const contextoFinal = (registro.contexto_entrenamiento || "") + bloqueNuevo;

      // 4. Guardar en la base de datos
      await env.DB.prepare(
        "UPDATE 360ia_db SET contexto_entrenamiento = ? WHERE widget_id = ?"
      ).bind(contextoFinal, widgetId).run();

      return new Response(JSON.stringify({ success: true, message: "Cerebro actualizado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
  }
};
