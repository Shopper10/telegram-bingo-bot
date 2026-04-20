const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, {
    polling: { autoStart: true, interval: 1500 }
});

const DB_FILE = "./data.json";

let db = { numeros: {}, total: 0 };

let chatId = null;
let boardMessageId = null;
let startTime = null;
let bingoIniciado = false;

// =====================
function load() {
    if (fs.existsSync(DB_FILE)) {
        db = JSON.parse(fs.readFileSync(DB_FILE));
    }
}
function save() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
load();

// =====================
function userName(u) {
    return u.username ? `@${u.username}` : u.first_name;
}

// =====================
// 🎰 TABLERO
function generarTablero() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const n = db.numeros[i];

        if (!n) {
            kb.push([{ text: `🟢 ${i}`, callback_data: `buy_${i}` }]);
            continue;
        }

        if (n.estado === "reservado") {
            kb.push([{ text: `⛔️ ${n.name}`, callback_data: "none" }]);
            continue;
        }

        if (n.estado === "pendiente") {
            kb.push([{ text: `🔍 ${n.name}`, callback_data: "none" }]);
            continue;
        }

        if (n.estado === "pagado") {
            kb.push([{ text: `✅ ${n.name}`, callback_data: "none" }]);
        }
    }

    return { inline_keyboard: kb };
}

// =====================
function updateBoard() {

    if (!chatId || !boardMessageId) return;

    bot.editMessageText(
`🎰 CASINO BINGO

💰 Total: $${db.total}

🕒 Sistema automático activo`, {
        chat_id: chatId,
        message_id: boardMessageId,
        reply_markup: generarTablero()
    }).catch(()=>{});
}

// =====================
// 🚀 /bingo
bot.onText(/\/bingo/, async (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    chatId = msg.chat.id;

    db.numeros = {};
    db.total = 0;
    bingoIniciado = false;

    save();

    startTime = Date.now();

    const board = await bot.sendMessage(chatId,
`🎰 CASINO BINGO - NUEVA PARTIDA`, {
        reply_markup: generarTablero()
    });

    boardMessageId = board.message_id;

    bot.sendMessage(chatId, "⏱ Sistema iniciado (10 min por número)");
});

// =====================
// 🎯 COMPRA
bot.on("callback_query", (q) => {

    bot.answerCallbackQuery(q.id).catch(()=>{});

    const d = q.data;

    if (d.startsWith("buy_")) {

        const n = d.split("_")[1];

        if (db.numeros[n]) return;

        db.numeros[n] = {
            name: userName(q.from),
            estado: "reservado",
            time: Date.now()
        };

        db.total += 3000;

        save();
        updateBoard();

        bot.sendMessage(chatId, `💰 Número ${n} reservado`);

        return;
    }

    // =====================
    // 🟢 APROBAR (solo admin)
    if (d.startsWith("ok_")) {

        if (q.from.id !== ADMIN_ID) return;

        let nums = d.split("_")[1].split("-");

        nums.forEach(n => {
            if (db.numeros[n]) db.numeros[n].estado = "pagado";
        });

        save();
        updateBoard();

        bot.sendMessage(chatId, "✅ PAGOS APROBADOS");

        return;
    }

    // =====================
    // 🔴 RECHAZAR (solo admin)
    if (d.startsWith("no_")) {

        if (q.from.id !== ADMIN_ID) return;

        let nums = d.split("_")[1].split("-");

        nums.forEach(n => delete db.numeros[n]);

        save();
        updateBoard();

        bot.sendMessage(chatId, "❌ PAGOS RECHAZADOS");

        return;
    }
});

// =====================
// 📸 FOTO (PAGO EN REVISIÓN)
bot.on("message", (msg) => {

    if (!msg.photo) return;

    let nums = [];

    for (let n in db.numeros) {

        if (db.numeros[n].name === userName(msg.from)) {
            db.numeros[n].estado = "pendiente";
            nums.push(n);
        }
    }

    if (!nums.length) return;

    save();

    bot.sendMessage(chatId,
`📸 PAGO EN REVISIÓN

🎰 ${nums.join(", ")}
👤 ${userName(msg.from)}`, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🟢 APROBAR", callback_data: `ok_${nums.join("-")}` },
                    { text: "🔴 RECHAZAR", callback_data: `no_${nums.join("-")}` }
                ]
            ]
        }
    });
});

// =====================
// ⏱ LIBERACIÓN AUTOMÁTICA 10 MIN (CLAVE REAL)
setInterval(() => {

    let changed = false;

    const now = Date.now();

    for (let n in db.numeros) {

        const item = db.numeros[n];

        if (item.estado === "reservado") {

            if (now - item.time >= 10 * 60 * 1000) {

                delete db.numeros[n];
                db.total = Math.max(0, db.total - 3000);

                changed = true;
            }
        }
    }

    if (changed) {
        save();
        updateBoard();
    }

}, 5000);

// =====================
// 🎰 AUTO INICIO BINGO
function checkFull() {

    if (!bingoIniciado && Object.keys(db.numeros).length === 15) {

        bingoIniciado = true;

        bot.sendMessage(chatId, "🎰 INICIO DE BINGO");
    }
}