const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

if (global.__RUN__) process.exit(0);
global.__RUN__ = true;

const bot = new TelegramBot(token, {
    polling: { autoStart: true, interval: 1500 }
});

const DB_FILE = "./data.json";

// =====================
let db = { numeros: {}, total: 0 };
let chatId = null;
let messageId = null;

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
function user(u) {
    return u.username ? `@${u.username}` : u.first_name;
}

// =====================
function getMinutesLeft(start) {
    const limit = 10 * 60 * 1000;
    const diff = limit - (Date.now() - start);
    return Math.ceil(diff / 60000);
}

// =====================
// 🎰 TABLERO
function board() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const n = db.numeros[i];

        if (!n) {
            kb.push([{ text: `🟢 ${i} DISPONIBLE`, callback_data: `buy_${i}` }]);
            continue;
        }

        if (n.estado === "reservado") {
            kb.push([{ text: `⛔️ ${n.name} ⏱ ${getMinutesLeft(n.time)}min`, callback_data: "wait" }]);
            continue;
        }

        if (n.estado === "pendiente") {
            kb.push([{ text: `🔍 ${n.name} COMPROBANDO`, callback_data: "wait" }]);
            continue;
        }

        if (n.estado === "pagado") {
            kb.push([{ text: `✅ ${n.name} PAGADO`, callback_data: "wait" }]);
        }
    }

    return { inline_keyboard: kb };
}

// =====================
function updateBoard() {

    if (!chatId || !messageId) return;

    bot.editMessageText(`🎰 CASINO BINGO\n\n💰 Total: $${db.total}`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: board()
    }).catch(()=>{});
}

// =====================
// 🎰 COMPRA
bot.on("callback_query", (q) => {

    bot.answerCallbackQuery(q.id).catch(()=>{});

    if (!q.data.startsWith("buy_")) return;

    let n = q.data.split("_")[1];

    if (db.numeros[n]) return;

    db.numeros[n] = {
        name: user(q.from),
        estado: "reservado",
        time: Date.now()
    };

    db.total += 3000;

    save();
    updateBoard();

    bot.sendMessage(chatId,
`💰 RESERVADO
🎰 ${n}
⏱ 10 MIN`);
});

// =====================
// 📸 COMPROBANTE (solo aviso)
bot.on("message", (msg) => {

    if (!msg.photo) return;

    let nums = [];

    for (let n in db.numeros) {
        if (db.numeros[n].name === user(msg.from)) {
            db.numeros[n].estado = "pendiente";
            nums.push(n);
        }
    }

    if (!nums.length) return;

    save();

    bot.sendMessage(chatId,
`🔍 COMPROBANDO PAGO...
🎰 ${nums.join(", ")}

👮 Esperando admin`);
});

// =====================
// 🚀 /BINGO
bot.onText(/\/bingo/, async (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    chatId = msg.chat.id;

    db.numeros = {};
    save();

    const sent = await bot.sendMessage(chatId,
`🎰 NUEVA PARTIDA BINGO`, {
        reply_markup: board()
    });

    messageId = sent.message_id;
});

// =====================
// ♻ /RESET
bot.onText(/\/reset/, (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    db = { numeros: {}, total: 0 };
    save();

    updateBoard();

    bot.sendMessage(msg.chat.id, "♻ SISTEMA REINICIADO");
});

// =====================
// 💰 /PAYALL
bot.onText(/\/payall/, (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    for (let n in db.numeros) {
        db.numeros[n].estado = "pagado";
    }

    save();
    updateBoard();

    bot.sendMessage(msg.chat.id, "💰 TODOS MARCADOS COMO PAGADOS");
});

// =====================
// 🎯 /PAY X
bot.onText(/\/pay (\d+)/, (msg, match) => {

    if (msg.from.id !== ADMIN_ID) return;

    let num = match[1];

    if (db.numeros[num]) {
        db.numeros[num].estado = "pagado";
        save();
        updateBoard();

        bot.sendMessage(msg.chat.id, `✅ NÚMERO ${num} PAGADO`);
    } else {
        bot.sendMessage(msg.chat.id, "❌ NÚMERO NO EXISTE");
    }
});