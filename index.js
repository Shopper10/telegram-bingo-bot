const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

// 🔥 evitar doble instancia Railway
if (global.__RUNNING__) process.exit(0);
global.__RUNNING__ = true;

const bot = new TelegramBot(token, {
    polling: { autoStart: true, interval: 2000 }
});

console.log("🎰 CASINO FINAL ONLINE");

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
// 🎰 TABLERO SOLO USUARIOS (IMPORTANTE)
function boardUser() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const n = db.numeros[i];

        if (!n) {
            kb.push([{ text: `🟢 ${i}- DISPONIBLE`, callback_data: `take_${i}` }]);
            continue;
        }

        if (n.estado === "pagado") {
            kb.push([{ text: `✅ ${i}- PAGADO`, callback_data: "ignore" }]);
        } else {

            let t = 600000 - (Date.now() - n.start);
            let m = Math.max(0, Math.floor(t / 60000));

            kb.push([{
                text: `⛔ ${i}- ${n.name} ⏱ ${m}m`,
                callback_data: "ignore"
            }]);
        }
    }

    return kb;
}

// =====================
// 🔄 ACTUALIZAR TABLERO (1 MENSAJE)
function updateBoard() {

    if (!chatId || !messageId) return;

    bot.editMessageText(
`🎰 CASINO BINGO PRO

💰 Total: $${db.total}
🎯 Activo`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: boardUser() }
    }).catch(()=>{});
}

// =====================
// ⏱ TIMER 10 MIN
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
// 🎰 RULETA VEGAS (CORREGIDA)
function ruletaVegas(chatId) {

    let nums = Array.from({ length: 15 }, (_, i) => i + 1);

    let text = "🎰 RULETA VEGAS...\n\n";

    bot.sendMessage(chatId, text).then((m) => {

        let mid = m.message_id;

        let steps = 0;
        let maxSteps = 25;
        let delay = 80;

        let interval = setInterval(() => {

            let pick = nums[Math.floor(Math.random() * nums.length)];

            bot.editMessageText(
`🎰 GIRANDO RULETA...\n\n➡️ ${pick}`, {
                chat_id: chatId,
                message_id: mid
            }).catch(()=>{});

            steps++;

            if (steps > 10) delay += 40;
            if (steps > 15) delay += 80;

            if (steps >= maxSteps) {

                clearInterval(interval);

                let winner = nums[Math.floor(Math.random() * nums.length)];
                let name = db.numeros[winner]?.name || "Sin registro";

                showWinner(mid, winner, name);
            }

        }, delay);
    });
}

// =====================
// 🏆 GANADOR ANIMADO
function showWinner(mid, winner, name) {

    let frames = [
        "🎉 B I N G O 🎉",
        "🎉 B I N G O 🎉🏆",
        "🏆 GANADOR",
        `🎰 ${winner}`,
        `👤 ${name}`,
        "🎉 FELICIDADES 🏆"
    ];

    let i = 0;

    let anim = setInterval(() => {

        bot.editMessageText(frames[i], {
            chat_id: chatId,
            message_id: mid
        }).catch(()=>{});

        i++;

        if (i >= frames.length) clearInterval(anim);

    }, 900);
}

// =====================
// 🔥 CHECK SOLD OUT
function checkSoldOut() {

    if (bingoStarted) return;

    for (let i = 1; i <= 15; i++) {
        if (!db.numeros[i] || db.numeros[i].estado !== "pagado") return;
    }

    bingoStarted = true;

    bot.sendMessage(chatId, "🎉 SOLD OUT - INICIANDO RULETA VEGAS");

    ruletaVegas(chatId);
}

// =====================
// 🚀 START
bot.onText(/\/bingo/, async (msg) => {

    chatId = msg.chat.id;

    const sent = await bot.sendMessage(chatId,
`🎰 CASINO BINGO`, {
        reply_markup: { inline_keyboard: boardUser() }
    });

    messageId = sent.message_id;
});

// =====================
// 🛠 ADMIN SOLO (OCULTO)
bot.onText(/^\/admin$/, (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    bot.sendMessage(msg.chat.id, "🛠 PANEL ADMIN", {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "⚡ PAY ALL", callback_data: "admin_payall" },
                    { text: "🔄 RESET", callback_data: "admin_reset" }
                ],
                [
                    { text: "📊 STATUS", callback_data: "admin_status" },
                    { text: "🎰 RULETA", callback_data: "admin_roulette" }
                ]
            ]
        }
    });
});

// =====================
// 🎯 CALLBACKS
bot.on("callback_query", (q) => {

    bot.answerCallbackQuery(q.id).catch(()=>{});

    const d = q.data;

    // TOMAR NÚMERO
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

        checkSoldOut();
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
🎰 Activos: ${Object.keys(db.numeros).length}`);
    }

    // RULETA MANUAL
    if (d === "admin_roulette") {

        ruletaVegas(chatId);
    }
});

// =====================
// 📸 FOTO PAGO
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

    bot.sendMessage(chatId, "🔍 COMPROBANDO PAGO...");

    bot.sendPhoto(chatId, file, {
        caption: `📥 PAGO\n🎰 ${nums.join(", ")}`,
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