const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

if (global.__RUNNING__) process.exit(0);
global.__RUNNING__ = true;

const bot = new TelegramBot(token, {
    polling: { autoStart: true, interval: 2000 }
});

console.log("🎰 BINGO CASINO PRO ONLINE");

// =====================
const DB_FILE = "./data.json";

let db = {
    numeros: {},
    total: 0
};

let chatId = null;
let msgId = null;
let timers = {};
let bingoActive = false;

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
// 🎰 TABLERO
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
                callback_data: "none"
            }]);
        }
    }

    return kb;
}

// =====================
// 🔄 UPDATE TABLERO
function updateBoard() {

    if (!chatId || !msgId) return;

    bot.editMessageText(
`🎰 BINGO CASINO PRO

💰 Total: $${db.total}
🎯 Activo`, {
        chat_id: chatId,
        message_id: msgId,
        reply_markup: { inline_keyboard: board() }
    }).catch(()=>{});
}

// =====================
// ⏱ TIMER
function startTimer(n) {

    if (timers[n]) clearTimeout(timers[n]);

    db.numeros[n].start = Date.now();

    timers[n] = setTimeout(() => {

        delete db.numeros[n];

        save();
        updateBoard();

    }, 600000);
}

// =====================
// 🎯 RULETA ANIMADA
function ruletaAnimada(nums, cb) {

    bot.sendMessage(chatId, "🎰 INICIANDO RULETA...");

    let text = "🎰 GIRANDO RULETA...\n\n";

    bot.sendMessage(chatId, text).then((m) => {

        let mid = m.message_id;

        let i = 0;

        let interval = setInterval(() => {

            let pick = nums[Math.floor(Math.random() * nums.length)];

            text += `➡️ ${pick}\n`;

            bot.editMessageText(text, {
                chat_id: chatId,
                message_id: mid
            });

            i++;

        }, 600);

        setTimeout(() => {

            clearInterval(interval);

            let winner = nums[Math.floor(Math.random() * nums.length)];

            cb(winner, mid);

        }, 8000);
    });
}

// =====================
// 🏆 ANUNCIO GANADOR
function announceWinner(winner, mid) {

    let userName = db.numeros[winner]?.name || "Sin registro";

    let steps = [
        "🎉 B I N G O 🎉",
        "🎉 B I N G O 🎉🏆",
        "🎉 B I N G O 🎉🏆🔥",
        `🏆 GANADOR: ${winner}`,
        `👤 ${userName}`
    ];

    let i = 0;

    let interval = setInterval(() => {

        bot.editMessageText(steps[i], {
            chat_id: chatId,
            message_id: mid
        }).catch(()=>{});

        i++;

        if (i >= steps.length) {
            clearInterval(interval);
        }

    }, 900);
}

// =====================
// 🔥 CHECK SOLD OUT
function checkSold() {

    if (bingoActive) return;

    for (let i = 1; i <= 15; i++) {
        if (!db.numeros[i] || db.numeros[i].estado !== "pagado") return;
    }

    bingoActive = true;

    let nums = Array.from({ length: 15 }, (_, i) => i + 1);

    ruletaAnimada(nums, (winner, mid) => {

        announceWinner(winner, mid);
    });
}

// =====================
// START
bot.onText(/\/bingo/, async (msg) => {

    chatId = msg.chat.id;

    let sent = await bot.sendMessage(chatId,
`🎰 BINGO CASINO PRO`, {
        reply_markup: { inline_keyboard: board() }
    });

    msgId = sent.message_id;
});

// =====================
// CALLBACKS
bot.on("callback_query", (q) => {

    bot.answerCallbackQuery(q.id).catch(()=>{});

    let d = q.data;

    // TOMAR
    if (d.startsWith("take_")) {

        let n = d.split("_")[1];

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
`💰 PAGA:
Nequi 3123902322
🎰 Número ${n}
⏱ 10 min`);

        return;
    }

    if (q.from.id !== ADMIN_ID) return;

    // PAYALL
    if (d === "admin_payall") {

        for (let i = 1; i <= 15; i++) {
            db.numeros[i] = { name: "ADMIN", estado: "pagado", start: Date.now() };
        }

        db.total = 15 * 3000;

        save();
        updateBoard();

        checkSold();
    }

    // RESET
    if (d === "admin_reset") {

        db = { numeros: {}, total: 0 };
        bingoActive = false;

        save();
        updateBoard();
    }

    // STATUS
    if (d === "admin_status") {

        bot.sendMessage(chatId,
`📊 STATUS

💰 Total: $${db.total}
🎰 Activos: ${Object.keys(db.numeros).length}`);
    }
});

// =====================
// FOTO PAGO
bot.on("message", (msg) => {

    if (!msg.photo) return;

    let file = msg.photo[msg.photo.length - 1].file_id;

    let nums = [];

    for (let n in db.numeros) {

        if (db.numeros[n].name === user(msg.from)) {
            nums.push(n);
            db.numeros[n].estado = "pendiente";
        }
    }

    if (!nums.length) return;

    save();

    bot.sendMessage(chatId, "🔍 revisando pago...");

    bot.sendPhoto(chatId, file, {
        caption: `📥 Pago\n🎰 ${nums.join(", ")}`,
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🟢 APROBAR", callback_data: "ok" },
                    { text: "🔴 RECHAZAR", callback_data: "no" }
                ]
            ]
        }
    });
});