const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = process.env.TOKEN;

if (global.__RUN__) process.exit(0);
global.__RUN__ = true;

const bot = new TelegramBot(token, {
    polling: { autoStart: true, interval: 1500 }
});

const DB_FILE = "./data.json";

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
// ⏱️ TIEMPO EN MINUTOS
function getMinutesLeft(start) {
    const limit = 10 * 60 * 1000;
    const diff = limit - (Date.now() - start);
    return Math.ceil(diff / 60000);
}

// =====================
// 📊 BARRA VISUAL
function getBar(min) {

    const total = 10;
    const filled = Math.max(0, total - min);

    let bar = "";

    for (let i = 0; i < total; i++) {
        bar += i < filled ? "🟩" : "⬜️";
    }

    return bar;
}

// =====================
// 🎰 TABLERO CON BOTONES + BARRA
function board() {

    let kb = [];
    let alertMsg = false;

    for (let i = 1; i <= 15; i++) {

        const n = db.numeros[i];

        if (!n) {
            kb.push([{
                text: `🟢 ${i} - DISPONIBLE`,
                callback_data: `buy_${i}`
            }]);
            continue;
        }

        if (n.estado === "reservado") {

            let min = getMinutesLeft(n.time);

            if (min <= 0) continue;

            if (min <= 2) alertMsg = true;

            kb.push([{
                text: `⛔️ ${n.name} ⏱️ ${min}min ${getBar(min)}`,
                callback_data: "wait"
            }]);
            continue;
        }

        if (n.estado === "pendiente") {
            kb.push([{
                text: `🔍 ${n.name} COMPROBANDO`,
                callback_data: "wait"
            }]);
            continue;
        }

        if (n.estado === "pagado") {
            kb.push([{
                text: `✅ ${n.name} PAGADO`,
                callback_data: "wait"
            }]);
        }
    }

    // 🔴 ALERTA GLOBAL
    if (alertMsg && chatId) {
        bot.sendMessage(chatId, "⚠️ HAY JUGADORES A PUNTO DE EXPIRAR (2 MIN O MENOS)");
    }

    return { inline_keyboard: kb };
}

// =====================
// 🔄 UPDATE TABLERO
function updateBoard() {

    if (!chatId || !messageId) return;

    bot.editMessageText(`🎰 CASINO BINGO\n\n💰 Total: $${db.total}`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: board()
    }).catch(()=>{});
}

// =====================
// 🧹 AUTO LIBERACIÓN
function autoRelease() {

    let changed = false;

    for (let i in db.numeros) {

        let n = db.numeros[i];

        if (n.estado === "reservado") {

            let min = getMinutesLeft(n.time);

            if (min <= 0) {
                delete db.numeros[i];
                changed = true;
            }
        }
    }

    if (changed) {
        save();
        updateBoard();
    }
}

// =====================
// 🚀 START
bot.onText(/\/bingo/, async (msg) => {

    chatId = msg.chat.id;

    const sent = await bot.sendMessage(chatId,
`🎰 CASINO BINGO`, {
        reply_markup: board()
    });

    messageId = sent.message_id;
});

// =====================
// 🎯 COMPRA
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
⏱️ 10 MIN`);
});

// =====================
// 📸 PAGO
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

    bot.sendMessage(chatId, "🔍 COMPROBANDO PAGOS...");

    setTimeout(() => {

        nums.forEach(n => {
            db.numeros[n].estado = "pagado";
        });

        save();
        updateBoard();

        bot.sendMessage(chatId, "✅ PAGOS APROBADOS");

    }, 3000);
});

// =====================
// 🔁 LOOP SISTEMA
setInterval(() => {

    autoRelease();
    updateBoard();

}, 5000);