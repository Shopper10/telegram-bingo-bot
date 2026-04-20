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

let db = { numeros: {}, total: 0 };
let chatId = null;
let messageId = null;
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
function getUser(u) {
    return u.username ? `@${u.username}` : u.first_name;
}

// =====================
function getMinutesLeft(start) {
    const limit = 10 * 60 * 1000;
    const diff = limit - (Date.now() - start);
    return Math.ceil(diff / 60000);
}

// =====================
// ⏱ AUTO LIBERAR
setInterval(() => {
    let changed = false;

    for (let n in db.numeros) {
        let item = db.numeros[n];

        if (item.estado === "reservado") {
            let diff = Date.now() - item.time;

            if (diff >= 10 * 60 * 1000) {
                delete db.numeros[n];
                db.total -= 3000;
                changed = true;

                bot.sendMessage(chatId, `⏱ Número ${n} liberado por no pago`);
            }
        }
    }

    if (changed) {
        save();
        updateBoard();
    }

}, 30000);

// =====================
function generarTablero() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const item = db.numeros[i];

        if (!item) {
            kb.push([{ text: `🟢 ${i} - DISPONIBLE`, callback_data: `buy_${i}` }]);
            continue;
        }

        if (item.estado === "reservado") {
            kb.push([{ text: `⛔️ ${i} - ${item.name} ⏱ ${getMinutesLeft(item.time)}min`, callback_data: "wait" }]);
            continue;
        }

        if (item.estado === "pendiente") {
            kb.push([{ text: `🔍 ${i} - ${item.name} COMPROBANDO`, callback_data: "wait" }]);
            continue;
        }

        if (item.estado === "pagado") {
            kb.push([{ text: `✅ ${i} - ${item.name} PAGADO`, callback_data: "wait" }]);
        }
    }

    return { inline_keyboard: kb };
}

// =====================
function updateBoard() {

    if (!chatId || !messageId) return;

    bot.editMessageText(
`🎰 CASINO BINGO

💰 Total: $${db.total}`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: generarTablero()
    }).catch(()=>{});

    checkFull();
    checkAlmostFull();
}

// =====================
// ⚠️ CASI LLENO
function checkAlmostFull() {
    let disponibles = 15 - Object.keys(db.numeros).length;

    if (disponibles === 3) {
        bot.sendMessage(chatId, "⚠️ QUEDAN SOLO 3 NÚMEROS");
    }
}

// =====================
// 🎰 SOLO AVISA INICIO
function checkFull() {

    if (!bingoIniciado && Object.keys(db.numeros).length === 15) {

        bingoIniciado = true;

        bot.sendMessage(chatId,
`🎰 INICIO DE BINGO`);
    }
}

// =====================
// 🚀 INICIAR BINGO
bot.onText(/\/bingo/, async (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    chatId = msg.chat.id;
    bingoIniciado = false;

    const sent = await bot.sendMessage(chatId,
`🎰 CASINO BINGO`, {
        reply_markup: generarTablero()
    });

    messageId = sent.message_id;
});

// =====================
// 🎯 COMPRA
bot.on("callback_query", (q) => {

    bot.answerCallbackQuery(q.id).catch(()=>{});

    let d = q.data;

    if (d.startsWith("buy_")) {

        let n = d.split("_")[1];

        if (db.numeros[n]) return;

        db.numeros[n] = {
            name: getUser(q.from),
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
    }

    // =====================
    if (q.from.id !== ADMIN_ID) return;

    // APROBAR
    if (d.startsWith("ok_")) {

        let nums = d.split("_")[1].split("-");

        nums.forEach(n => db.numeros[n].estado = "pagado");

        save();
        updateBoard();

        bot.deleteMessage(chatId, q.message.message_id).catch(()=>{});
        bot.sendMessage(chatId, "✅ PAGO APROBADO");
    }

    // RECHAZAR
    if (d.startsWith("no_")) {

        let nums = d.split("_")[1].split("-");

        nums.forEach(n => delete db.numeros[n]);

        save();
        updateBoard();

        bot.deleteMessage(chatId, q.message.message_id).catch(()=>{});
        bot.sendMessage(chatId, "❌ PAGO RECHAZADO");
    }

    // PAY ALL
    if (d === "admin_payall") {

        for (let n in db.numeros) {
            db.numeros[n].estado = "pagado";
        }

        save();
        updateBoard();
    }

    // PAY INDIVIDUAL
    if (d.startsWith("pay_")) {

        let n = d.split("_")[1];

        if (db.numeros[n]) {
            db.numeros[n].estado = "pagado";
            save();
            updateBoard();
        }
    }

    // NUEVA PARTIDA
    if (d === "admin_new") {

        db.numeros = {};
        db.total = 0;
        bingoIniciado = false;

        save();
        updateBoard();
    }

    // RESET
    if (d === "admin_reset") {

        db = { numeros: {}, total: 0 };
        bingoIniciado = false;

        save();
        updateBoard();
    }

    // PANEL PAY
    if (d === "admin_payselect") {

        let botones = [];

        for (let i = 1; i <= 15; i++) {
            if (db.numeros[i] && db.numeros[i].estado !== "pagado") {
                botones.push([{ text: `💰 Pagar ${i}`, callback_data: `pay_${i}` }]);
            }
        }

        bot.sendMessage(ADMIN_ID, "🎯 Selecciona número:", {
            reply_markup: { inline_keyboard: botones }
        });
    }
});

// =====================
// 📸 COMPROBANTE
bot.on("message", (msg) => {

    if (!msg.photo) return;

    let nums = [];

    for (let n in db.numeros) {
        if (db.numeros[n].name === getUser(msg.from)) {
            db.numeros[n].estado = "pendiente";
            nums.push(n);
        }
    }

    if (!nums.length) return;

    save();

    let bar = ["⬜️⬜️⬜️⬜️⬜️","🟩⬜️⬜️⬜️⬜️","🟩🟩⬜️⬜️⬜️","🟩🟩🟩⬜️⬜️","🟩🟩🟩🟩⬜️","🟩🟩🟩🟩🟩"];
    let i = 0;

    bot.sendMessage(chatId, "🔍 COMPROBANDO PAGO...\n⬜️⬜️⬜️⬜️⬜️").then((m) => {

        let id = m.message_id;

        let interval = setInterval(() => {

            bot.editMessageText(
`🔍 COMPROBANDO PAGO...

${bar[i]}

🎰 ${nums.join(", ")}`, {
                chat_id: chatId,
                message_id: id
            }).catch(()=>{});

            i++;

            if (i >= bar.length) {
                clearInterval(interval);

                bot.sendMessage(chatId,
`📸 PAGO EN REVISIÓN

🎰 ${nums.join(", ")}
👤 ${getUser(msg.from)}`, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "🟢 APROBAR", callback_data: `ok_${nums.join("-")}` },
                                { text: "🔴 RECHAZAR", callback_data: `no_${nums.join("-")}` }
                            ]
                        ]
                    }
                });
            }

        }, 700);
    });
});

// =====================
// 🎛 PANEL ADMIN PRIVADO
bot.onText(/\/admin/, (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    if (msg.chat.type !== "private") {
        bot.sendMessage(msg.chat.id, "❌ Usa /admin en privado");
        return;
    }

    bot.sendMessage(msg.chat.id,
`🎛 PANEL ADMIN

💰 Total: $${db.total}`, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🎰 Nueva partida", callback_data: "admin_new" },
                    { text: "♻ Reset", callback_data: "admin_reset" }
                ],
                [
                    { text: "💰 Pay all", callback_data: "admin_payall" },
                    { text: "🎯 Pay número", callback_data: "admin_payselect" }
                ]
            ]
        }
    });
});