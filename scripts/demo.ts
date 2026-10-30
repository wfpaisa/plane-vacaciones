/**
 * Datos de prueba: un viaje de 20 días por Europa para cuatro personas, con
 * ruta, lugares por día y gastos. Se entra con la cuenta de la familia de
 * `.env` y PocketBase tiene que estar corriendo (`bun run dev`).
 *
 * Si el viaje ya existe, se borra y se vuelve a crear.
 */
import PocketBase from "pocketbase";

import { PB_PORT } from "./pb";

const NAME = "Europa en otoño 2027";
const START = "2027-10-14";

const pb = new PocketBase(`http://127.0.0.1:${PB_PORT}`);
pb.autoCancellation(false);

const user = process.env.ADMIN_USER;
const password = process.env.ADMIN_PASSWORD;
if (!user || !password) {
  console.error("Faltan ADMIN_USER y ADMIN_PASSWORD en .env.");
  process.exit(1);
}
await pb.collection("users").authWithPassword(user, password);

/** "2027-10-14" + n días, como lo guarda la web. */
function date(offset: number, from = START) {
  const [y, m, d] = from.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + offset));
  return `${t.toISOString().slice(0, 10)} 12:00:00.000Z`;
}
/** Fecha del día n del viaje (el día 1 es la llegada). */
const day = (n: number) => date(n - 1);

// ── Viaje ──────────────────────────────────────────────────────────────

const old = await pb.collection("trips").getFullList({ filter: pb.filter("name = {:n}", { n: NAME }) });
for (const t of old) await pb.collection("trips").delete(t.id);

const trip = await pb.collection("trips").create({
  name: NAME,
  destination: "Madrid, Comunidad de Madrid, España",
  lat: 40.4168,
  lng: -3.7038,
  start_date: day(1),
  end_date: day(20),
  budget: 21000,
  currency: "EUR",
  cover: "ciudad",
  category_budgets: {
    transporte: 7600,
    alojamiento: 7200,
    comida: 3400,
    actividades: 1600,
    compras: 800,
    otros: 400,
  },
  notes: [
    "Pasaportes vigentes hasta 2028 (revisado). No se necesita visa Schengen para colombianos; llevar reservas impresas y extractos por si preguntan en migración.",
    "Ida: IB6586 BOG→MAD 13 oct, 17:05. Regreso: AZ582 FCO→MAD + IB6585 MAD→BOG 2 nov.",
    "Clima esperado: 12–20 °C, lluvia en París y Ámsterdam. Llevar chaqueta impermeable.",
    "En Italia, validar siempre el tiquete de tren regional antes de subir.",
  ].join("\n"),
});

// ── Viajeros ───────────────────────────────────────────────────────────

const people = {
  sara: { name: "Sara", color: "oklch(0.64 0.17 38)" },
  felipe: { name: "Felipe", color: "oklch(0.6 0.11 215)" },
  marta: { name: "Marta", color: "oklch(0.58 0.12 150)" },
  natalia: { name: "Natalia", color: "oklch(0.58 0.16 350)" },
};
type Who = keyof typeof people;
const who = {} as Record<Who, string>;
for (const [key, t] of Object.entries(people)) {
  who[key as Who] = (await pb.collection("travelers").create({ ...t, trip: trip.id })).id;
}

// ── Ruta: 19 noches ────────────────────────────────────────────────────

const route = {
  madrid: {
    name: "Madrid",
    address: "Madrid, Comunidad de Madrid, España",
    country: "España",
    lat: 40.4168,
    lng: -3.7038,
    nights: 4,
    transport: "avion",
    notes: "Llegada en Iberia a la T4. Metro línea 8 + 10 hasta Plaza de España (o taxi tarifa fija 33 €).",
  },
  barcelona: {
    name: "Barcelona",
    address: "Barcelona, Cataluña, España",
    country: "España",
    lat: 41.3874,
    lng: 2.1686,
    nights: 3,
    transport: "tren",
    notes: "AVE desde Atocha, 2 h 30 min. Coche 6, asientos 7A-7D.",
  },
  paris: {
    name: "París",
    address: "París, Isla de Francia, Francia",
    country: "Francia",
    lat: 48.8566,
    lng: 2.3522,
    nights: 4,
    transport: "avion",
    notes: "Vueling VY8012 BCN→ORY. Desde Orly, Orlyval + RER B, o taxi tarifa fija 36 € a la orilla izquierda.",
  },
  amsterdam: {
    name: "Ámsterdam",
    address: "Ámsterdam, Holanda Septentrional, Países Bajos",
    country: "Países Bajos",
    lat: 52.3676,
    lng: 4.9041,
    nights: 3,
    transport: "tren",
    notes: "Eurostar desde Gare du Nord, 3 h 20 min. Llegar 30 min antes al andén.",
  },
  florencia: {
    name: "Florencia",
    address: "Florencia, Toscana, Italia",
    country: "Italia",
    lat: 43.7696,
    lng: 11.2558,
    nights: 2,
    transport: "avion",
    notes: "KLM KL1647 AMS→FLR. Tranvía T2 del aeropuerto a Unità, 20 min.",
  },
  roma: {
    name: "Roma",
    address: "Roma, Lacio, Italia",
    country: "Italia",
    lat: 41.9028,
    lng: 12.4964,
    nights: 3,
    transport: "tren",
    notes: "Frecciarossa desde Santa Maria Novella, 1 h 35 min. Regreso desde Fiumicino el 2 nov.",
  },
} as const;
type City = keyof typeof route;
const stop = {} as Record<City, string>;
let position = 0;
for (const [key, s] of Object.entries(route)) {
  stop[key as City] = (await pb.collection("stops").create({ ...s, trip: trip.id, position: position++ })).id;
}

// ── Lugares por día ────────────────────────────────────────────────────
// Madrid 1–5 · Barcelona 5–8 · París 8–12 · Ámsterdam 12–15 · Florencia 15–17 · Roma 17–20

type P = [
  city: City,
  day: number,
  time: string,
  name: string,
  category: string,
  lat: number,
  lng: number,
  address: string,
  cost?: number,
  notes?: string,
  link?: string,
];

const places: P[] = [
  // Madrid
  ["madrid", 1, "08:40", "Aeropuerto Adolfo Suárez Madrid-Barajas T4", "transporte", 40.4919, -3.5934, "Terminal 4, 28042 Madrid", 0, "Llegada IB6586."],
  ["madrid", 1, "11:00", "Hotel Riu Plaza España", "alojamiento", 40.4239, -3.7114, "Calle Gran Vía 84, 28013 Madrid", 0, "Check-in desde las 15:00; dejar maletas en recepción. Pedir habitación alta, la terraza del piso 27 está incluida.", "https://www.riu.com"],
  ["madrid", 1, "13:30", "Mercado de San Miguel", "comida", 40.4154, -3.7090, "Plaza de San Miguel s/n, 28005 Madrid", 60],
  ["madrid", 1, "16:00", "Plaza Mayor", "atraccion", 40.4155, -3.7074, "Plaza Mayor, 28012 Madrid"],
  ["madrid", 1, "17:00", "Puerta del Sol y Km 0", "atraccion", 40.4169, -3.7035, "Puerta del Sol, 28013 Madrid", 0, "Foto con el oso y el madroño."],
  ["madrid", 2, "10:00", "Museo del Prado", "atraccion", 40.4138, -3.6921, "Calle de Ruiz de Alarcón 23, 28014 Madrid", 60, "Entradas con hora 10:00. No perderse Las Meninas y El jardín de las delicias.", "https://www.museodelprado.es"],
  ["madrid", 2, "14:00", "Parque del Retiro", "naturaleza", 40.4153, -3.6845, "Plaza de la Independencia 7, 28001 Madrid", 24, "Alquilar barca en el estanque (6 € por 45 min)."],
  ["madrid", 2, "15:30", "Palacio de Cristal", "atraccion", 40.4136, -3.6825, "Paseo de Venezuela s/n, Parque del Retiro"],
  ["madrid", 2, "21:00", "Restaurante Sobrino de Botín", "comida", 40.4140, -3.7079, "Calle de los Cuchilleros 17, 28005 Madrid", 200, "Reserva a nombre de Felipe. Cochinillo asado para compartir.", "https://botin.es"],
  ["madrid", 3, "10:00", "Palacio Real de Madrid", "atraccion", 40.4180, -3.7143, "Calle de Bailén s/n, 28071 Madrid", 56, "Es sábado: relevo de la guardia en la Puerta del Príncipe a las 11:00."],
  ["madrid", 3, "12:30", "Catedral de la Almudena", "atraccion", 40.4157, -3.7146, "Calle de Bailén 10, 28013 Madrid", 28],
  ["madrid", 3, "14:00", "Taberna La Bola", "comida", 40.4194, -3.7090, "Calle de la Bola 5, 28013 Madrid", 120, "Cocido madrileño."],
  ["madrid", 3, "18:45", "Templo de Debod", "atraccion", 40.4240, -3.7177, "Calle de Ferraz 1, 28008 Madrid", 0, "Atardecer hacia las 19:15."],
  ["madrid", 3, "21:30", "Chocolatería San Ginés", "comida", 40.4168, -3.7069, "Pasadizo de San Ginés 5, 28013 Madrid", 30],
  ["madrid", 4, "09:20", "Excursión a Toledo · tren Avant desde Atocha", "transporte", 40.4065, -3.6895, "Estación de Madrid Puerta de Atocha", 0, "Salida 9:20, regreso 18:25. 33 min de trayecto."],
  ["madrid", 4, "11:00", "Catedral Primada de Toledo", "atraccion", 39.8568, -4.0234, "Calle Cardenal Cisneros 1, 45002 Toledo", 48],
  ["madrid", 4, "13:30", "Comida en Toledo · carcamusas y mazapán", "comida", 39.8581, -4.0226, "Plaza de Zocodover, Toledo", 90],
  ["madrid", 4, "15:30", "Mirador del Valle", "naturaleza", 39.8508, -4.0241, "Carretera de Circunvalación, Toledo", 0, "Tomar el bus 71 desde Zocodover."],
  // Barcelona
  ["barcelona", 5, "10:30", "AVE Madrid-Atocha → Barcelona-Sants", "transporte", 41.3793, 2.1400, "Estació de Sants, Barcelona", 0, "AVE 03093, llega 13:00."],
  ["barcelona", 5, "14:00", "Apartamento en el Eixample", "alojamiento", 41.3953, 2.1617, "Carrer de Mallorca 280, 08037 Barcelona", 0, "Llaves en caja con código; el anfitrión lo envía el día anterior por WhatsApp."],
  ["barcelona", 5, "16:30", "Casa Batlló", "atraccion", 41.3916, 2.1649, "Passeig de Gràcia 43, 08007 Barcelona", 140, "", "https://www.casabatllo.es"],
  ["barcelona", 5, "18:30", "La Pedrera", "atraccion", 41.3954, 2.1619, "Passeig de Gràcia 92, 08008 Barcelona", 0, "Solo fachada; de noche iluminan la azotea."],
  ["barcelona", 5, "21:00", "Cervecería Catalana", "comida", 41.3926, 2.1611, "Carrer de Mallorca 236, 08008 Barcelona", 110, "No reservan: llegar antes de las 21:00."],
  ["barcelona", 6, "09:15", "Basílica de la Sagrada Família", "atraccion", 41.4036, 2.1744, "Carrer de Mallorca 401, 08013 Barcelona", 140, "Entrada con subida a la torre de la Pasión.", "https://sagradafamilia.org"],
  ["barcelona", 6, "13:00", "Park Güell", "atraccion", 41.4145, 2.1527, "Carrer d'Olot s/n, 08024 Barcelona", 72, "Turno 13:00. Subir en bus V19 o caminar desde metro Vallcarca."],
  ["barcelona", 6, "16:30", "Bunkers del Carmel", "naturaleza", 41.4190, 2.1617, "Carrer de Marià Labèrnia s/n, 08032 Barcelona", 0, "La mejor vista de la ciudad."],
  ["barcelona", 6, "21:00", "El Xampanyet", "comida", 41.3846, 2.1813, "Carrer de Montcada 22, 08003 Barcelona", 90],
  ["barcelona", 7, "09:30", "Mercat de la Boqueria", "comida", 41.3817, 2.1716, "La Rambla 91, 08001 Barcelona", 40],
  ["barcelona", 7, "11:00", "Barri Gòtic y Catedral de Barcelona", "atraccion", 41.3840, 2.1762, "Pla de la Seu s/n, 08002 Barcelona", 64],
  ["barcelona", 7, "13:30", "Playa de la Barceloneta", "playa", 41.3784, 2.1925, "Passeig Marítim de la Barceloneta", 0, "En octubre ya no es para bañarse, pero el paseo vale la pena."],
  ["barcelona", 7, "14:30", "Can Solé · arroz a la marinera", "comida", 41.3786, 2.1876, "Carrer de Sant Carles 4, 08003 Barcelona", 140],
  ["barcelona", 7, "18:00", "Montjuïc y Palau Nacional", "atraccion", 41.3685, 2.1534, "Parc de Montjuïc s/n, 08038 Barcelona", 0, "La fuente mágica no funciona en invierno: confirmar horario antes."],
  // París
  ["paris", 8, "10:05", "Vuelo Vueling BCN → París-Orly", "transporte", 48.7262, 2.3652, "Aéroport de Paris-Orly", 0, "VY8012, salida 10:05, llega 12:05."],
  ["paris", 8, "14:00", "Apartamento en Saint-Germain", "alojamiento", 48.8530, 2.3359, "12 Rue Dauphine, 75006 París", 0, "Cuarto piso sin ascensor. Código de la puerta en el correo de Booking."],
  ["paris", 8, "17:30", "Torre Eiffel · cumbre", "atraccion", 48.8584, 2.2945, "Champ de Mars, 5 Av. Anatole France, 75007 París", 168, "Entrada con hora 17:30, ascensor hasta la cima.", "https://www.toureiffel.paris"],
  ["paris", 8, "20:30", "Crucero Bateaux Mouches por el Sena", "atraccion", 48.8638, 2.3060, "Port de la Conférence, 75008 París", 68],
  ["paris", 9, "09:00", "Museo del Louvre", "atraccion", 48.8606, 2.3376, "Rue de Rivoli, 75001 París", 88, "Entrar por la Pirámide con la reserva de las 9:00. Gioconda primero, antes de que se llene.", "https://www.louvre.fr"],
  ["paris", 9, "13:00", "Jardín de las Tullerías", "naturaleza", 48.8635, 2.3275, "Place de la Concorde, 75001 París"],
  ["paris", 9, "15:00", "Sainte-Chapelle", "atraccion", 48.8554, 2.3450, "10 Bd du Palais, 75001 París", 76],
  ["paris", 9, "16:30", "Catedral de Notre-Dame", "atraccion", 48.8530, 2.3499, "6 Parvis Notre-Dame, 75004 París", 0, "Entrada gratis; reservar franja en la app para no hacer fila."],
  ["paris", 9, "20:00", "Le Relais de l'Entrecôte", "comida", 48.8541, 2.3328, "20 Rue Saint-Benoît, 75006 París", 140],
  ["paris", 10, "08:30", "Palacio de Versalles", "atraccion", 48.8049, 2.1204, "Place d'Armes, 78000 Versalles", 128, "RER C hasta Versailles Château Rive Gauche. Pasaporte con jardines.", "https://www.chateauversailles.fr"],
  ["paris", 10, "13:30", "Almuerzo en Versalles · Ore", "comida", 48.8045, 2.1222, "Pavillon Dufour, Château de Versailles", 130],
  ["paris", 10, "15:00", "Jardines y Trianón", "naturaleza", 48.8150, 2.1100, "Domaine de Trianon, Versalles"],
  ["paris", 11, "10:00", "Montmartre y Sacré-Cœur", "atraccion", 48.8867, 2.3431, "35 Rue du Chevalier de la Barre, 75018 París"],
  ["paris", 11, "12:30", "Le Consulat", "comida", 48.8861, 2.3404, "18 Rue Norvins, 75018 París", 100],
  ["paris", 11, "15:00", "Museo de Orsay", "atraccion", 48.8600, 2.3266, "1 Rue de la Légion d'Honneur, 75007 París", 64],
  ["paris", 11, "18:30", "Arco del Triunfo y Campos Elíseos", "atraccion", 48.8738, 2.2950, "Place Charles de Gaulle, 75008 París", 64],
  ["paris", 11, "19:30", "Galeries Lafayette", "compras", 48.8738, 2.3320, "40 Bd Haussmann, 75009 París", 0, "Terraza gratis con vista a la Ópera."],
  // Ámsterdam
  ["amsterdam", 12, "09:13", "Eurostar París-Nord → Amsterdam Centraal", "transporte", 52.3791, 4.9003, "Stationsplein, 1012 AB Ámsterdam", 0, "Sale 9:13, llega 12:33. Coche 14."],
  ["amsterdam", 12, "13:30", "Hotel V Nesplein", "alojamiento", 52.3693, 4.8936, "Nes 49, 1012 KD Ámsterdam", 0, "Pago en el hotel al hacer check-in."],
  ["amsterdam", 12, "16:00", "Paseo en barco por los canales", "atraccion", 52.3780, 4.8970, "Prins Hendrikkade 33A, Ámsterdam", 84],
  ["amsterdam", 12, "19:30", "Foodhallen", "comida", 52.3669, 4.8681, "Bellamyplein 51, 1053 AT Ámsterdam", 90],
  ["amsterdam", 13, "09:00", "Rijksmuseum", "atraccion", 52.3600, 4.8852, "Museumstraat 1, 1071 XX Ámsterdam", 100, "La ronda de noche está en restauración visible: vale la pena.", "https://www.rijksmuseum.nl"],
  ["amsterdam", 13, "13:00", "The Pancake Bakery", "comida", 52.3768, 4.8838, "Prinsengracht 191, 1015 DS Ámsterdam", 70],
  ["amsterdam", 13, "15:00", "Museo Van Gogh", "atraccion", 52.3584, 4.8811, "Museumplein 6, 1071 DJ Ámsterdam", 92, "Entrada con hora 15:00; solo se compran en línea.", "https://www.vangoghmuseum.nl"],
  ["amsterdam", 13, "17:30", "Vondelpark", "naturaleza", 52.3580, 4.8686, "Vondelpark, 1071 AA Ámsterdam"],
  ["amsterdam", 14, "09:00", "Casa de Ana Frank", "atraccion", 52.3752, 4.8840, "Westermarkt 20, 1016 DK Ámsterdam", 64, "Las entradas salen 6 semanas antes, los martes. Ya compradas.", "https://www.annefrank.org"],
  ["amsterdam", 14, "11:30", "Zaanse Schans · molinos", "naturaleza", 52.4740, 4.8167, "Schansend 7, 1509 AW Zaandam", 40, "Tren a Zaandijk Zaanse Schans, 17 min desde Centraal."],
  ["amsterdam", 14, "17:00", "Mercado de Albert Cuyp", "compras", 52.3557, 4.8945, "Albert Cuypstraat, 1073 BD Ámsterdam", 40, "Probar stroopwafel recién hecho."],
  ["amsterdam", 14, "20:00", "Restaurant Moeders", "comida", 52.3697, 4.8744, "Rozengracht 251, 1016 SX Ámsterdam", 150, "Comida holandesa casera."],
  // Florencia
  ["florencia", 15, "10:45", "Vuelo KLM AMS → Florencia", "transporte", 43.8100, 11.2051, "Aeroporto di Firenze-Peretola", 0, "KL1647, llega 12:50."],
  ["florencia", 15, "14:00", "Hotel Davanzati", "alojamiento", 43.7700, 11.2530, "Via Porta Rossa 5, 50123 Florencia", 0, "Aperitivo gratis en el hotel a las 18:30."],
  ["florencia", 15, "16:00", "Ponte Vecchio", "atraccion", 43.7680, 11.2531, "Ponte Vecchio, 50125 Florencia"],
  ["florencia", 15, "18:15", "Piazzale Michelangelo", "naturaleza", 43.7629, 11.2650, "Piazzale Michelangelo, 50125 Florencia", 0, "Atardecer a las 18:10 (ya en horario de invierno)."],
  ["florencia", 15, "20:30", "Buca Mario · bistecca", "comida", 43.7712, 11.2493, "Piazza degli Ottaviani 16, 50123 Florencia", 220, "Bistecca alla fiorentina para cuatro (1,6 kg)."],
  ["florencia", 16, "08:15", "Galleria dell'Accademia · David", "atraccion", 43.7768, 11.2588, "Via Ricasoli 58/60, 50129 Florencia", 100],
  ["florencia", 16, "10:30", "Duomo y cúpula de Brunelleschi", "atraccion", 43.7731, 11.2560, "Piazza del Duomo, 50122 Florencia", 120, "Subida a la cúpula a las 10:45, 463 escalones.", "https://duomo.firenze.it"],
  ["florencia", 16, "13:00", "Mercato Centrale", "comida", 43.7764, 11.2531, "Piazza del Mercato Centrale, 50123 Florencia", 70],
  ["florencia", 16, "15:00", "Galería Uffizi", "atraccion", 43.7678, 11.2553, "Piazzale degli Uffizi 6, 50122 Florencia", 120],
  ["florencia", 16, "18:00", "Mercado de San Lorenzo · cuero", "compras", 43.7758, 11.2539, "Via dell'Ariento, 50123 Florencia", 0],
  // Roma
  ["roma", 17, "10:15", "Frecciarossa Firenze SMN → Roma Termini", "transporte", 41.9010, 12.5018, "Piazza dei Cinquecento, 00185 Roma", 0, "Llega 11:50."],
  ["roma", 17, "12:30", "Apartamento en Monti", "alojamiento", 41.8957, 12.4932, "Via Panisperna 54, 00184 Roma", 0, "Tasa turística (6 € por persona y noche) se paga en efectivo."],
  ["roma", 17, "15:00", "Fontana di Trevi", "atraccion", 41.9009, 12.4833, "Piazza di Trevi, 00187 Roma", 8, "Desde 2026 cobran 2 € para acercarse a la fuente."],
  ["roma", 17, "16:00", "Panteón", "atraccion", 41.8986, 12.4769, "Piazza della Rotonda, 00186 Roma", 20],
  ["roma", 17, "17:00", "Giolitti", "comida", 41.9009, 12.4767, "Via degli Uffici del Vicario 40, 00186 Roma", 20],
  ["roma", 17, "18:00", "Piazza Navona", "atraccion", 41.8992, 12.4731, "Piazza Navona, 00186 Roma"],
  ["roma", 18, "09:00", "Coliseo", "atraccion", 41.8902, 12.4922, "Piazza del Colosseo 1, 00184 Roma", 96, "Entrada Full Experience con arena. Llegar 15 min antes con pasaporte.", "https://colosseo.it"],
  ["roma", 18, "11:30", "Foro Romano y Palatino", "atraccion", 41.8925, 12.4853, "Via della Salara Vecchia 5/6, 00186 Roma"],
  ["roma", 18, "14:00", "Ai Tre Scalini", "comida", 41.8952, 12.4925, "Via Panisperna 251, 00184 Roma", 90],
  ["roma", 18, "20:00", "Trastevere · Da Enzo al 29", "comida", 41.8882, 12.4772, "Via dei Vascellari 29, 00153 Roma", 140, "No reservan; hacer fila desde las 19:30."],
  ["roma", 19, "08:30", "Museos Vaticanos y Capilla Sixtina", "atraccion", 41.9065, 12.4536, "Viale Vaticano, 00165 Roma", 120, "Entrada temprana 8:30. Hombros y rodillas cubiertos.", "https://www.museivaticani.va"],
  ["roma", 19, "12:30", "Basílica de San Pedro y cúpula", "atraccion", 41.9022, 12.4539, "Piazza San Pietro, 00120 Ciudad del Vaticano", 40],
  ["roma", 19, "16:30", "Castel Sant'Angelo", "atraccion", 41.9031, 12.4663, "Lungotevere Castello 50, 00193 Roma", 64],
  ["roma", 19, "18:30", "Escalinata de Piazza di Spagna", "atraccion", 41.9060, 12.4828, "Piazza di Spagna, 00187 Roma"],
  ["roma", 19, "20:30", "Cena de despedida · Roscioli", "comida", 41.8940, 12.4741, "Via dei Giubbonari 21, 00186 Roma", 220, "Reserva confirmada a las 20:30 para 4."],
  ["roma", 20, "10:00", "Leonardo Express Termini → Fiumicino", "transporte", 41.9010, 12.5018, "Roma Termini, binario 23", 56],
  ["roma", 20, "13:20", "Aeropuerto de Roma-Fiumicino", "transporte", 41.7999, 12.2462, "Via dell'Aeroporto di Fiumicino, 00054 Fiumicino", 0, "AZ582 a Madrid 13:20; conexión IB6585 a Bogotá 18:10."],
];

/** Ideas sin día todavía. */
const ideas: P[] = [
  ["madrid", 0, "", "El Rastro", "compras", 40.4087, -3.7075, "Calle de la Ribera de Curtidores, 28005 Madrid", 0, "Solo domingos por la mañana."],
  ["madrid", 0, "", "Museo Reina Sofía · Guernica", "atraccion", 40.4086, -3.6943, "Calle de Santa Isabel 52, 28012 Madrid", 48],
  ["barcelona", 0, "", "Montserrat", "naturaleza", 41.5933, 1.8378, "Monistrol de Montserrat, Barcelona", 120, "Medio día en tren R5 + cremallera."],
  ["paris", 0, "", "Musée de l'Orangerie · Nenúfares", "atraccion", 48.8638, 2.3227, "Jardin des Tuileries, 75001 París", 50],
  ["paris", 0, "", "Shakespeare and Company", "compras", 48.8526, 2.3471, "37 Rue de la Bûcherie, 75005 París"],
  ["amsterdam", 0, "", "Giethoorn", "naturaleza", 52.7395, 6.0779, "Giethoorn, Overijssel", 80, "Lejos: 2 h. Solo si sobra un día."],
  ["florencia", 0, "", "Torre de Pisa", "atraccion", 43.7230, 10.3966, "Piazza del Duomo, 56126 Pisa", 80, "Tren de 1 h desde Santa Maria Novella."],
  ["roma", 0, "", "Termas de Caracalla", "atraccion", 41.8791, 12.4924, "Viale delle Terme di Caracalla, 00153 Roma", 72],
];

const counts = new Map<number, number>();
for (const [city, d, time, name, category, lat, lng, address, cost = 0, notes = "", link = ""] of [...places, ...ideas]) {
  const pos = counts.get(d) ?? 0;
  counts.set(d, pos + 1);
  await pb.collection("places").create({
    trip: trip.id,
    stop: stop[city],
    name,
    address,
    lat,
    lng,
    category,
    day: d,
    position: pos,
    time,
    cost,
    link,
    visited: false,
    notes,
  });
}

// ── Gastos ─────────────────────────────────────────────────────────────

type E = [
  title: string,
  category: string,
  amount: number,
  date: string,
  status: "planeado" | "pagado",
  paidBy: Who | null,
  city: City | null,
  split?: Who[],
  notes?: string,
];

const expenses: E[] = [
  // Ya comprado
  ["Vuelos Bogotá ↔ Europa · Iberia (4)", "transporte", 4920, date(0, "2027-03-18"), "pagado", "felipe", null, [], "Ida BOG→MAD, regreso FCO→MAD→BOG. Tarifa Classic con maleta de 23 kg. Localizador K7QX2M."],
  ["Seguro de viaje Schengen (4)", "otros", 336, date(0, "2027-08-02"), "pagado", "marta", null, [], "Assist Card, cobertura 60.000 €."],
  ["Hotel Riu Plaza España · 4 noches", "alojamiento", 1180, date(0, "2027-05-10"), "pagado", "sara", "madrid", [], "2 habitaciones dobles con desayuno."],
  ["AVE Madrid → Barcelona (4)", "transporte", 268, date(0, "2027-07-21"), "pagado", "natalia", "barcelona"],
  ["Apartamento Eixample · 3 noches", "alojamiento", 735, date(0, "2027-05-12"), "pagado", "sara", "barcelona", [], "Airbnb, 2 habitaciones."],
  ["Vuelo Vueling BCN → ORY (4)", "transporte", 312, date(0, "2027-06-30"), "pagado", "natalia", "paris", [], "Con una maleta facturada compartida."],
  ["Apartamento Saint-Germain · 4 noches", "alojamiento", 1520, date(0, "2027-05-12"), "pagado", "felipe", "paris"],
  ["Eurostar París → Ámsterdam (4)", "transporte", 436, date(0, "2027-07-08"), "pagado", "marta", "amsterdam"],
  ["Vuelo KLM AMS → FLR (4)", "transporte", 388, date(0, "2027-07-08"), "pagado", "marta", "florencia"],
  ["Apartamento Monti · 3 noches", "alojamiento", 810, date(0, "2027-05-14"), "pagado", "sara", "roma"],
  ["Entradas Museo del Prado (4)", "actividades", 60, date(0, "2027-09-20"), "pagado", "natalia", "madrid"],
  ["Entradas Sagrada Família con torre (4)", "actividades", 144, date(0, "2027-09-01"), "pagado", "felipe", "barcelona"],
  ["Entradas Park Güell (4)", "actividades", 72, date(0, "2027-09-01"), "pagado", "felipe", "barcelona"],
  ["Entradas Casa Batlló (4)", "actividades", 140, date(0, "2027-09-01"), "pagado", "felipe", "barcelona"],
  ["Torre Eiffel cumbre (4)", "actividades", 168, date(0, "2027-08-16"), "pagado", "sara", "paris"],
  ["Louvre (4)", "actividades", 88, date(0, "2027-09-12"), "pagado", "natalia", "paris"],
  ["Versalles pasaporte (4)", "actividades", 128, date(0, "2027-09-12"), "pagado", "natalia", "paris"],
  ["Casa de Ana Frank (4)", "actividades", 64, date(0, "2027-09-07"), "pagado", "marta", "amsterdam"],
  ["Rijksmuseum + Van Gogh (4)", "actividades", 192, date(0, "2027-09-07"), "pagado", "marta", "amsterdam"],
  ["Accademia + Uffizi + cúpula (4)", "actividades", 340, date(0, "2027-08-25"), "pagado", "sara", "florencia", [], "Pase Brunelleschi para la cúpula."],
  ["Coliseo Full Experience (4)", "actividades", 96, date(0, "2027-09-15"), "pagado", "felipe", "roma"],
  ["Museos Vaticanos (4)", "actividades", 120, date(0, "2027-09-15"), "pagado", "felipe", "roma"],
  ["eSIM Europa 20 días", "otros", 87, date(0, "2027-10-05"), "pagado", "natalia", null, ["sara", "felipe", "natalia"], "Marta usa el roaming de su plan."],
  // Por pagar durante el viaje
  ["Hotel V Nesplein · 3 noches", "alojamiento", 1260, day(12), "planeado", "felipe", "amsterdam", [], "Se paga al llegar."],
  ["Hotel Davanzati · 2 noches", "alojamiento", 520, day(15), "planeado", "marta", "florencia"],
  ["Tasa turística Roma", "alojamiento", 72, day(17), "planeado", "sara", "roma", [], "6 € × 4 personas × 3 noches."],
  ["Tasa turística Florencia y Ámsterdam", "alojamiento", 118, day(15), "planeado", null, null],
  ["Frecciarossa Florencia → Roma (4)", "transporte", 132, day(17), "planeado", "natalia", "roma"],
  ["Taxis aeropuerto Madrid y Orly", "transporte", 70, day(1), "planeado", "felipe", null],
  ["Abono turístico Madrid 4 días (4)", "transporte", 92, day(1), "planeado", "sara", "madrid"],
  ["Tren Avant + bus a Toledo (4)", "transporte", 96, day(4), "planeado", "marta", "madrid"],
  ["Hola BCN 72 h (4)", "transporte", 104, day(5), "planeado", "natalia", "barcelona"],
  ["Pase Navigo Easy y RER (4)", "transporte", 120, day(8), "planeado", "felipe", "paris"],
  ["GVB 72 h + tren a Zaanse Schans (4)", "transporte", 150, day(12), "planeado", "marta", "amsterdam"],
  ["Leonardo Express a Fiumicino (4)", "transporte", 56, day(20), "planeado", "sara", "roma"],
  ["Comidas Madrid", "comida", 620, day(1), "planeado", null, "madrid", [], "Estimado: 155 € por día para los cuatro."],
  ["Comidas Barcelona", "comida", 480, day(5), "planeado", null, "barcelona"],
  ["Comidas París", "comida", 720, day(8), "planeado", null, "paris"],
  ["Comidas Ámsterdam", "comida", 510, day(12), "planeado", null, "amsterdam"],
  ["Comidas Florencia", "comida", 380, day(15), "planeado", null, "florencia"],
  ["Comidas Roma", "comida", 540, day(17), "planeado", null, "roma"],
  ["Cena en Sobrino de Botín", "comida", 200, day(2), "planeado", "felipe", "madrid", [], "Invita Felipe por su cumpleaños; igual se divide."],
  ["Crucero Bateaux Mouches (4)", "actividades", 68, day(8), "planeado", "sara", "paris"],
  ["Barco por los canales (4)", "actividades", 84, day(12), "planeado", "natalia", "amsterdam"],
  ["Catedral de Toledo y Palacio Real (4)", "actividades", 104, day(3), "planeado", "marta", "madrid"],
  ["Chaqueta de cuero en San Lorenzo", "compras", 180, day(16), "planeado", "marta", "florencia", ["marta"]],
  ["Recuerdos y regalos para la familia", "compras", 400, day(19), "planeado", null, null],
  ["Perfume en Galeries Lafayette", "compras", 95, day(11), "planeado", "sara", "paris", ["sara"]],
  ["Propinas y baños públicos", "otros", 60, day(1), "planeado", null, null],
];

for (const [title, category, amount, d, status, paidBy, city, split = [], notes = ""] of expenses) {
  await pb.collection("expenses").create({
    trip: trip.id,
    stop: city ? stop[city] : "",
    title,
    category,
    amount,
    date: d,
    status,
    paid_by: paidBy ? who[paidBy] : "",
    split: split.map((s) => who[s]),
    notes,
  });
}

const total = expenses.reduce((a, e) => a + e[2], 0);
console.log(
  `Listo: «${NAME}» con ${Object.keys(route).length} paradas, ${places.length + ideas.length} lugares ` +
    `y ${expenses.length} gastos (${total.toLocaleString("es-CO")} € de 21.000 €).`,
);
