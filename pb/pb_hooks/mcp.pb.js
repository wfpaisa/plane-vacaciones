/// <reference path="../pb_data/types.d.ts" />
routerAdd("GET", "/api/vacaciones/mcp/settings", (e) => {
  const m = require(`${__hooks}/mcp.js`);
  e.response.header().set("Cache-Control", "no-store");
  return e.json(200, m.settings(e.app, e.auth.id));
}, $apis.requireAuth("users"));
routerAdd("POST", "/api/vacaciones/mcp/settings", (e) => {
  const m = require(`${__hooks}/mcp.js`);
  const enabled = e.requestInfo().body.enabled;
  if (typeof enabled !== "boolean") throw new BadRequestError("enabled debe ser booleano.");
  e.response.header().set("Cache-Control", "no-store");
  return e.json(200, m.settings(e.app, e.auth.id, enabled));
}, $apis.requireAuth("users"));
routerAdd("POST", "/api/vacaciones/mcp/token", (e) => {
  const m = require(`${__hooks}/mcp.js`);
  e.response.header().set("Cache-Control", "no-store");
  m.token(e.app, e.auth.id, true);
  return e.json(200, m.settings(e.app, e.auth.id));
}, $apis.requireAuth("users"));
routerAdd("POST", "/api/vacaciones/mcp", (e) => {
  const m = require(`${__hooks}/mcp.js`);
  const user = m.auth(e);
  e.response.header().set("Cache-Control", "no-store");
  const protocol = e.request.header.get("MCP-Protocol-Version");
  if (protocol && !["2025-03-26", "2025-06-18", "2025-11-25"].includes(protocol)) return e.json(400, { error: "Versión MCP no admitida." });
  const req = e.requestInfo().body;
  if (!req || req.jsonrpc !== "2.0" || typeof req.method !== "string" || (req.id !== undefined && typeof req.id !== "string" && typeof req.id !== "number")) return e.json(400, { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Solicitud JSON-RPC inválida." } });
  if (req.id === undefined) return e.noContent(202);
  const ok = result => e.json(200, { jsonrpc: "2.0", id: req.id, result });
  const fail = (code, message) => e.json(200, { jsonrpc: "2.0", id: req.id, error: { code, message } });
  switch (req.method) {
    case "initialize": return ok({ protocolVersion: ["2025-03-26", "2025-06-18", "2025-11-25"].includes(req.params?.protocolVersion) ? req.params.protocolVersion : "2025-06-18", capabilities: { tools: {}, resources: {}, prompts: {} }, serverInfo: { name: "vacaciones", version: "1.0.0" }, instructions: m.CONTEXT.workflow.join("\n") });
    case "ping": return ok({});
    case "tools/list": return ok({ tools: m.TOOLS });
    case "tools/call":
      if (!req.params || typeof req.params.name !== "string") return fail(-32602, "Indica el nombre de la herramienta.");
      try { return ok({ content: [{ type: "text", text: JSON.stringify(m.call(e.app, user, req.params.name, req.params.arguments || {})) }] }); }
      catch (err) { const message = err.name === "Error" ? err.message : "Revisa los campos obligatorios, fechas, categorías e índices de relación. Consulta get_context y get_trip antes de reintentar."; return ok({ isError: true, content: [{ type: "text", text: "No se guardaron cambios. " + message }] }); }
    case "resources/list": return ok({ resources: [{ uri: "vacaciones://context", name: "Guía de planificación", mimeType: "application/json", description: "Reglas, categorías y estructura de los viajes." }] });
    case "resources/read": if (req.params?.uri !== "vacaciones://context") return fail(-32602, "Recurso desconocido."); return ok({ contents: [{ uri: "vacaciones://context", mimeType: "application/json", text: JSON.stringify(m.call(e.app, user, "get_context", {})) }] });
    case "prompts/list": return ok({ prompts: [{ name: "plan_vacation", description: "Prepara un viaje completo en Vacaciones.", arguments: [{ name: "preferences", description: "Destino, fechas, presupuesto, viajeros y preferencias.", required: true }] }] });
    case "prompts/get": if (req.params?.name !== "plan_vacation") return fail(-32602, "Prompt desconocido."); return ok({ messages: [{ role: "user", content: { type: "text", text: m.CONTEXT.workflow.join("\n") + "\nPreferencias: " + String(req.params?.arguments?.preferences || "Pregúntame por las preferencias del viaje.") } }] });
    default: return fail(-32601, "Método MCP desconocido.");
  }
}, $apis.bodyLimit(2000000));
routerAdd("GET", "/api/vacaciones/mcp", (e) => { require(`${__hooks}/mcp.js`).auth(e); return e.noContent(405); });
routerAdd("DELETE", "/api/vacaciones/mcp", (e) => { require(`${__hooks}/mcp.js`).auth(e); return e.noContent(405); });
