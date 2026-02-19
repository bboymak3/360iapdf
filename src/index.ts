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

    // Manejo de Preflight para el navegador
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Método no permitido", { status: 405, headers: corsHeaders });
    }

    try {
      const body = (await request.json()) as { 
        widgetId: string; 
        nuevoContenido: string; 
        fuente: string 
      };

      const { widgetId, nuevoContenido, fuente } = body;

      if (!widgetId || !nuevoContenido) {
        return new Response(JSON.stringify({ error: "Faltan datos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Obtener el contexto actual usando tus nombres de columna
      // Nota: Ponemos el nombre de la tabla entre comillas por si empieza con números
      const registro = await env.DB.prepare(
        "SELECT contexto_entrenamiento FROM \"360ia_db\" WHERE widget_id = ?"
      )
        .bind(widgetId)
        .first<{ contexto_entrenamiento: string }>();

      if (!registro) {
        return new Response(JSON.stringify({ error: "El widget_id no existe en la DB" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Preparar el nuevo bloque de información
      const fecha = new Date().toLocaleDateString();
      const bloqueNuevo = `\n\n=== DATOS EXTRA (${fuente} - ${fecha}) ===\n${nuevoContenido}\n`;
      const contextoFinal = (registro.contexto_entrenamiento || "") + bloqueNuevo;

      // 3. Actualizar la tabla con la nueva información acumulada
      await env.DB.prepare(
        "UPDATE \"360ia_db\" SET contexto_entrenamiento = ? WHERE widget_id = ?"
      )
        .bind(contextoFinal, widgetId)
        .run();

      return new Response(JSON.stringify({ success: true, message: "Cerebro actualizado correctamente" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
