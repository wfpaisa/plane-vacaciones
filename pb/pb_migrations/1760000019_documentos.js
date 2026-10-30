/// <reference path="../pb_data/types.d.ts" />
/**
 * Documentos del viaje: seguros, tiquetes, entradas, reservas… Cada uno es de
 * un viajero o de todo el grupo (sin `traveler`). Los archivos son protegidos:
 * solo se abren con un token de archivo de una cuenta de la familia, nunca con
 * el enlace de solo lectura. Si se quita al viajero, su documento pasa al grupo
 * en lugar de borrarse.
 */
const FAMILIA = '@request.auth.id != ""';

migrate(
  (app) => {
    const trips = app.findCollectionByNameOrId("trips");
    const travelers = app.findCollectionByNameOrId("travelers");
    const documents = new Collection({
      type: "base",
      name: "documents",
      listRule: FAMILIA,
      viewRule: FAMILIA,
      createRule: FAMILIA,
      updateRule: FAMILIA,
      deleteRule: FAMILIA,
      fields: [
        { type: "relation", name: "trip", required: true, collectionId: trips.id, cascadeDelete: true, maxSelect: 1 },
        { type: "relation", name: "traveler", collectionId: travelers.id, cascadeDelete: false, maxSelect: 1 },
        { type: "text", name: "title", required: true, max: 160 },
        { type: "select", name: "kind", maxSelect: 1, values: ["seguro", "tiquete", "entrada", "reserva", "identidad", "otro"] },
        {
          type: "file",
          name: "file",
          required: true,
          maxSelect: 1,
          maxSize: 20 * 1024 * 1024,
          mimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
          protected: true,
        },
        { type: "text", name: "notes", max: 2000 },
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_documents_trip ON documents (trip)"],
    });
    app.save(documents);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("documents"));
  },
);
