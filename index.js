const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

// 🔥 anti duplicado Railway
if (global.__BOT__) process.exit(0);
global.__BOT__ = true;

const bot = new TelegramBot(token, {
    polling: { autoStart: true, interval: 2000 }
});

console.log("🎰 CASINO PRO FINAL ONLINE");

// =====================
const DB_FILE = "./data.json";

let db = {
    numeros: {},
    total: 0
};

let chatId = null;
let messageId = null;
let timers = {};
let bingoStarted = false;

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
// 🎰 TABLERO APP
function board() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const n = db.numeros[i];

        if (!n) {
            kb.push([{ text: `🟢 ${i}- DISPONIBLE`, callback_data: `take_${i}` }]);
            continue;
        }

        if (n.estado === "pagado") {
            kb.push([{ text: `✅ ${i}- PAGADO`, callback_data: "none" }]);
        } else {

            let t = 600000 - (Date.now() - n.start);
            let m = Math.max(0, Math.floor(t / 60000));

            kb.push([{
                text: `⛔ ${i}- ${n.name} ⏱ ${m}m`,
                callback_data: `info_${i}`
            }]);
        }
    }

    kb.push([
        { text: "⚡ PAY ALL", callback_data: "admin_payall" },
        { text: "🔄 RESET", callback_data: "admin_reset" }
    ]);

    kb.push([
        { text: "📊 STATUS", callback_data: "admin_status" }
    ]);

    return kb;
}

// =====================
// 🔄 UPDATE BOARD
function updateBoard() {

    if (!chatId || !messageId) return;

    bot.editMessageText(
`🎰 CASINO BINGO PRO

💰 Total: $${db.total}
🎯 Estado activo`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: board() }
    }).catch(()=>{});
}

// =====================
// ⏱ TIMER 10 MIN
function startTimer(n) {

    if (timers[n]) clearTimeout(timers[n]);

    db.numeros[n].start = Date.now();

    timers[n] = setTimeout(() => {

        if (!db.numeros[n]) return;

        delete db.numeros[n];

        save();
        updateBoard();

    }, 600000);
}

// =====================
// 🎰 START BINGO
function startBingo() {

    let nums = Array.from({ length: 15 }, (_, i) => i + 1);

    bot.sendMessage(chatId, "🎉 INICIANDO RULETA FINAL...");

    let msg = "🎰 RULETA GIRANDO...\n\n";

    bot.sendMessage(chatId, msg).then((m) => {

        let mid = m.message_id;

        let interval = setInterval(() => {

            let i = Math.floor(Math.random() * nums.length);
            let pick = nums[i];

            msg += `➡️ ${pick}\n`;

            bot.editMessageText(msg, {
                chat_id: chatId,
                message_id: mid
            });

        }, 700);

        setTimeout(() => {

            clearInterval(interval);

            let winner = nums[Math.floor(Math.random() * nums.length)];

            bot.editMessageText(
`🎉 GANADOR FINAL

🎰 Número: ${winner}
🏆 CASINO TERMINADO`, {
                chat_id: chatId,
                message_id: mid
            });

        }, 9000);
    });
}

// =====================
// 🔥 CHECK SOLD OUT
function checkSold() {

    if (bingoStarted) return;

    for (let i = 1; i <= 15; i++) {
        if (!db.numeros[i] || db.numeros[i].estado !== "pagado") return;
    }

    bingoStarted = true;

    bot.sendMessage(chatId, "🎉 TODOS LOS NÚMEROS VENDIDOS");

    startBingo();
}

// =====================
// START
bot.onText(/\/bingo/, async (msg) => {

    chatId = msg.chat.id;

    const sent = await bot.sendMessage(chatId,
`🎰 CASINO BINGO

💰 Total: $${db.total}`, {
        reply_markup: { inline_keyboard: board() }
    });

    messageId = sent.message_id;
});

// =====================
// CALLBACKS
bot.on("callback_query", (q) => {

    bot.answerCallbackQuery(q.id).catch(()=>{});

    const d = q.data;

    // TOMAR
    if (d.startsWith("take_")) {

        const n = d.split("_")[1];

        if (db.numeros[n]) return;

        db.numeros[n] = {
            name: user(q.from),
            estado: "reservado",
            start: Date.now()
        };

        startTimer(n);
        save();
        updateBoard();

        bot.sendMessage(chatId,
`💰 PAGAR
Nequi 3123902322
🎰 Número ${n}
⏱ 10 min`);

        return;
    }

    if (q.from.id !== ADMIN_ID) return;

    // PAYALL
    if (d === "admin_payall") {

        for (let i = 1; i <= 15; i++) {
            if (!db.numeros[i]) {
                db.numeros[i] = { name: "ADMIN", estado: "pagado", start: Date.now() };
            } else {
                db.numeros[i].estado = "pagado";
            }
        }

        db.total = 15 * 3000;

        save();
        updateBoard();

        checkSold();
    }

    // RESET
    if (d === "admin_reset") {

        db = { numeros: {}, total: 0 };
        bingoStarted = false;

        save();
        updateBoard();
    }

    // STATUS
    if (d === "admin_status") {

        bot.sendMessage(chatId,
`📊 STATUS

💰 Total: $${db.total}
🎰 Ocupados: ${Object.keys(db.numeros).length}`);
    }
});

// =====================
// FOTO PAGO
bot.on("message", (msg) => {

    if (!msg.photo) return;

    const file = msg.photo[msg.photo.length - 1].file_id;

    let nums = [];

    for (let n in db.numeros) {
        if (db.numeros[n].name === user(msg.from)) {
            nums.push(n);
            db.numeros[n].estado = "pendiente";
        }
    }

    if (!nums.length) return;

    save();

    bot.sendMessage(chatId, "🔍 COMPROBANDO PAGO...");

    bot.sendPhoto(chatId, file, {
        caption: `📥 PAGO\n🎰 ${nums.join(", ")}`,
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