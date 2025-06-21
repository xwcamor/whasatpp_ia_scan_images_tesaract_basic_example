process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage } from "@whiskeysockets/baileys";
import axios from "axios";
import qrcode from "qrcode-terminal";
import mysql from "mysql2/promise";
import tesseract from "node-tesseract-ocr";

// === RUTAS DE ARCHIVOS Y CONFIG ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = await mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "1234",
  database: "examen",
  port: 3307 // <-- Agrega esta línea
});

// === WHITELIST ===
const whitelistPath = path.join(__dirname, "whitelist.txt");
let whitelist = [];
try {
  const content = fs.readFileSync(whitelistPath, "utf-8");
  whitelist = content.split("\n").map(n => n.trim()).filter(n => n !== "");
  console.log("✅ Números autorizados cargados:", whitelist);
} catch (err) {
  console.error("❌ No se pudo leer whitelist.txt:", err.message);
}

function puedeUsarBot(jid) {
  const numero = jid.split("@")[0].replace(/\D/g, "");
  return whitelist.some(n => n.replace(/\D/g, "") === numero);
}

// === IA (OpenRouter) ===
async function analizarFacturaIA(textoFactura) {
  const prompt = `
Extrae los siguientes datos de la factura en texto plano. Responde SOLO en JSON, aunque alguno esté vacío:

- Ruc o DNI del cliente o empresa (ruc_dni)
- Nombre o razón social del cliente (nombre_cliente)
- Fecha de emisión (fecha_emision)
- Número de factura, boleta, recibo o comprobante (numero_comprobante)
- Subtotal (subtotal)
- IGV (igv)
- Total (total)
- Moneda (moneda)

Ejemplo de respuesta:
{
  "ruc_dni": "",
  "nombre_cliente": "",
  "fecha_emision": "",
  "numero_comprobante": "",
  "subtotal": "",
  "igv": "",
  "total": "",
  "moneda": ""
}

Factura:
---
${textoFactura}
---
`;

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      },
      {
        headers: {
          "Authorization": `Bearer AQUI TU TOKENNNNNNNN DE OPENROUTER`, // Cambia por tu key real
          "Content-Type": "application/json"
        }
      }
    );

    // Buscar bloque JSON en respuesta
    const txt = response.data.choices[0].message.content;
    const jsonMatch = txt.match(/{[\s\S]+}/);
    if (!jsonMatch) throw new Error("La IA no devolvió datos en formato JSON");

    const datos = JSON.parse(jsonMatch[0]);
    return datos;
  } catch (err) {
    console.error("❌ Error al usar la IA:", err.response?.data || err.message);
    throw new Error("No se pudo analizar la factura con IA");
  }
}

// === BOT WHATSAPP ===
const startSock = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const sock = makeWASocket({ auth: state });

  const esperaConfirmacion = new Map();

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === "open") console.log("✅ Conectado a WhatsApp");
    if (connection === "close") {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      console.log("⚠️ Desconectado. ¿Reconectar?", shouldReconnect);
      if (shouldReconnect) startSock();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const texto = msg.message.conversation || msg.message?.extendedTextMessage?.text || "";

    if (!puedeUsarBot(from)) return;

    // SOLO responde si está en flujo de escaneo/confirmar
    if (
      texto.trim().toLowerCase() !== "/escanear" &&
      texto.trim().toLowerCase() !== "confirmar" &&
      !msg.message.imageMessage && !msg.message.documentMessage &&
      !esperaConfirmacion.has(from)
    ) {
      // No hace nada, el chat queda normal
      return;
    }

    // === FLUJO DE ESCANEO DE FACTURA ===
    if (texto.trim().toLowerCase() === "/escanear") {
      esperaConfirmacion.set(from, null);
      await sock.sendMessage(from, { text: "📤 Envíame la imagen o PDF de la factura." });
      return;
    }

    // === PROCESAR IMAGEN DE FACTURA ===
    if (msg.message.imageMessage || msg.message.documentMessage) {
      if (!esperaConfirmacion.has(from)) return;

      const tipo = msg.message.imageMessage ? "imageMessage" : "documentMessage";
      const stream = await downloadContentFromMessage(msg.message[tipo], tipo.startsWith("image") ? "image" : "document");
      const buffer = [];
      for await (const chunk of stream) buffer.push(chunk);
      const ruta = path.join(__dirname, `factura_${Date.now()}.jpg`);
      fs.writeFileSync(ruta, Buffer.concat(buffer));

      try {
        // 1. OCR
        const configOCR = { lang: "spa" };
        const textoFactura = await tesseract.recognize(ruta, configOCR);

        // 2. IA
        const datos = await analizarFacturaIA(textoFactura);

        // 3. Guardar para confirmar
        esperaConfirmacion.set(from, { ...datos });

        let txt = `✅ *Datos detectados:*\n`;
        txt += `*RUC/DNI:* ${datos.ruc_dni || "(no encontrado)"}\n`;
        txt += `*Nombre:* ${datos.nombre_cliente || "(no encontrado)"}\n`;
        txt += `*Fecha emisión:* ${datos.fecha_emision || "(no encontrado)"}\n`;
        txt += `*Comprobante:* ${datos.numero_comprobante || "(no encontrado)"}\n`;
        txt += `*Subtotal:* ${datos.subtotal || "(no encontrado)"}\n`;
        txt += `*IGV:* ${datos.igv || "(no encontrado)"}\n`;
        txt += `*Total:* ${datos.total || "(no encontrado)"}\n`;
        txt += `*Moneda:* ${datos.moneda || "(no encontrado)"}\n`;
        txt += `\n¿Confirma el registro? Escribe *CONFIRMAR*.\n`;

        await sock.sendMessage(from, { text: txt });

      } catch (err) {
        console.error("❌ Error al procesar factura:", err);
        await sock.sendMessage(from, { text: "❌ Error al procesar la factura con IA: " + err.message });
      } finally {
        // ELIMINA la imagen
        try { fs.unlinkSync(ruta); } catch {}
      }
      return;
    }

    // === CONFIRMAR Y GUARDAR EN MYSQL (con validación de duplicados) ===
    if (texto.trim().toLowerCase() === "confirmar" && esperaConfirmacion.has(from)) {
      const datos = esperaConfirmacion.get(from);
      if (datos) {
        // Verifica si ya existe el registro por ruc_dni y numero_comprobante
        const [rows] = await db.execute(
          "SELECT id FROM facturas WHERE ruc_dni = ? AND numero_comprobante = ?",
          [datos.ruc_dni, datos.numero_comprobante]
        );
        if (rows.length > 0) {
          await sock.sendMessage(from, { text: "❌ Este registro ya existe en la base de datos." });
          esperaConfirmacion.delete(from);
          return;
        }

        // Si no existe, lo inserta
        await db.execute(
          "INSERT INTO facturas (ruc_dni, nombre_cliente, fecha_emision, numero_comprobante, subtotal, igv, total, moneda) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            datos.ruc_dni,
            datos.nombre_cliente,
            datos.fecha_emision,
            datos.numero_comprobante,
            datos.subtotal,
            datos.igv,
            datos.total,
            datos.moneda
          ]
        );
        await sock.sendMessage(from, { text: "📦 Factura registrada con éxito en la base de datos." });
        esperaConfirmacion.delete(from);
      }
      return;
    }
  });
};

startSock();
