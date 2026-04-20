const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

// 🔥 EVITA DOBLE BOT EN RAILWAY
if (global.__BOT__) {
    console.log("BOT YA ACTIVO");
    process.exit(0);
}
global.__BOT__ = true;

// 🔥 BOT ESTABLE
const bot = new TelegramBot(token, {
    polling: { autoStart: true, interval: 2000 }
});

console.log("🤖 CASINO PRO ONLINE");

// =====================
const DB_FILE = "./data.json";

let db = {
    numeros: {},
    total: 0
};

let chatId = null;
let timers = {};

// =====================
// LOAD / SAVE
function load() {
    try {
        if (fs.existsSync(DB_FILE)) {
            db = JSON.parse(fs.readFileSync(DB_FILE));
        }
    } catch {}
}

function save() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

load();

// =====================
// USER
function getUser(u) {
    return u.username ? `@${u.username}` : u.first_name;
}

// =====================
// TABLERO
function board() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const n = db.numeros[i];

        if (!n) {
            kb.push([{ text: `🟢 ${i}- DISPONIBLE`, callback_data: `n_${i}` }]);
            continue;
        }

        if (n.estado === "pagado") {
            kb.push([{ text: `✅ ${i}- PAGADO`, callback_data: `n_${i}` }]);
        } else {

            let t = 600000 - (Date.now() - n.start);
            let m = Math.floor(t / 60000);

            kb.push([{ text: `⛔ ${i}- ${n.user} ⏱ ${m}m`, callback_data: `n_${i}` }]);
        }
    }

    return kb;
}

// =====================
// REPOST
function repost() {

    if (!chatId) return;

    bot.sendMessage(chatId,
`🎰 BINGO CASINO

💰 Total: $${db.total}`, {
        reply_markup: { inline_keyboard: board() }
    }).catch(()=>{});
}

// =====================
// TIMER 10 MIN
function startTimer(num) {

    if (timers[num]) clearTimeout(timers[num]);

    db.numeros[num].start = Date.now();

    timers[num] = setTimeout(() => {

        if (!db.numeros[num]) return;

        delete db.numeros[num];

        save();
        repost();

        bot.sendMessage(chatId, `⛔ ${num} liberado`);

    }, 600000);
}

// =====================
// START
bot.onText(/\/bingo/, (msg) => {

    chatId = msg.chat.id;

    bot.sendMessage(chatId, "🎰 BINGO INICIADO", {
        reply_markup: { inline_keyboard: board() }
    });
});

// =====================
// CALLBACKS
bot.on("callback_query", (q) => {

    bot.answerCallbackQuery(q.id).catch(()=>{});

    const d = q.data;

    if (d.startsWith("n_")) {

        const n = d.split("_")[1];

        if (db.numeros[n]) return;

        db.numeros[n] = {
            user: getUser(q.from),
            estado: "reservado",
            start: Date.now()
        };

        startTimer(n);
        save();
        repost();

        bot.sendMessage(chatId,
`🎰 TOMADO ${n}

💰 Nequi: 3123902322
⏱ 10 minutos`);

        return;
    }

    if (q.from.id !== ADMIN_ID) return;

    const nums = d.split("_")[1]?.split("-") || [];

    if (d.startsWith("ok_")) {

        nums.forEach(n => {
            if (db.numeros[n]) db.numeros[n].estado = "pagado";
        });

        db.total += nums.length * 3000;

        save();
        repost();
    }

    if (d.startsWith("no_")) {

        nums.forEach(n => delete db.numeros[n]);

        save();
        repost();
    }
});

// =====================
// FOTO PAGO
bot.on("message", (msg) => {

    if (!msg.photo) return;

    const file = msg.photo[msg.photo.length - 1].file_id;

    let nums = [];

    for (let n in db.numeros) {
        if (db.numeros[n].user === getUser(msg.from)) {
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

// =====================
// COMMANDS PRO

// PAYALL
bot.onText(/\/payall/, (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    for (let i = 1; i <= 15; i++) {
        if (!db.numeros[i]) {
            db.numeros[i] = { user: "ADMIN", estado: "pagado", start: Date.now() };
        } else {
            db.numeros[i].estado = "pagado";
        }
    }

    db.total = 15 * 3000;

    save();
    repost();

    bot.sendMessage(msg.chat.id, "⚡ PAYALL OK");
});

// PAY SPECIFIC
bot.onText(/\/pay (.+)/, (msg, match) => {

    if (msg.from.id !== ADMIN_ID) return;

    const nums = match[1].split(" ");

    nums.forEach(n => {
        if (db.numeros[n]) {
            db.numeros[n].estado = "pagado";
            db.total += 3000;
        }
    });

    save();
    repost();

    bot.sendMessage(msg.chat.id, "✅ PAGADOS");
});

// REMOVE
bot.onText(/\/remove (.+)/, (msg, match) => {

    if (msg.from.id !== ADMIN_ID) return;

    match[1].split(" ").forEach(n => delete db.numeros[n]);

    save();
    repost();

    bot.sendMessage(msg.chat.id, "🗑 ELIMINADOS");
});

// RESET
bot.onText(/\/reset/, (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    db = { numeros: {}, total: 0 };

    save();
    repost();

    bot.sendMessage(msg.chat.id, "🔄 RESET OK");
});

// STATUS
bot.onText(/\/status/, (msg) => {

    const libres = 15 - Object.keys(db.numeros).length;

    bot.sendMessage(msg.chat.id,
`📊 STATUS

💰 Total: $${db.total}
🟢 Libres: ${libres}
🎰 Ocupados: ${Object.keys(db.numeros).length}`);
});

// DEBUG
bot.onText(/\/debug/, (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    bot.sendMessage(msg.chat.id,
`🧠 DEBUG

${JSON.stringify(db, null, 2)}`);
});