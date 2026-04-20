const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, {
    polling: { autoStart: true, interval: 2000 }
});

const DB_FILE = "./data.json";

// =====================
let db = {
    numeros: {},
    total: 0
};

let chatId = null;
let timers = {};

// =====================
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
function user(u) {
    return u.username ? `@${u.username}` : u.first_name;
}

// =====================
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
        } else if (n.estado === "pendiente" || n.estado === "reservado") {

            let t = 600000 - (Date.now() - n.start);
            let min = Math.floor(t / 60000);

            kb.push([{ text: `⛔ ${i}- ${n.user} ⏱ ${min}m`, callback_data: `n_${i}` }]);
        }
    }

    return kb;
}

// =====================
function repost() {

    if (!chatId) return;

    bot.sendMessage(chatId,
`🎰 BINGO

💰 Total: $${db.total}`, {
        reply_markup: {
            inline_keyboard: board()
        }
    });
}

// =====================
function timer(num) {

    if (timers[num]) clearTimeout(timers[num]);

    db.numeros[num].start = Date.now();

    timers[num] = setTimeout(() => {

        if (!db.numeros[num]) return;

        delete db.numeros[num];

        save();
        repost();

    }, 600000);
}

// ===================== START
bot.onText(/\/bingo/, (msg) => {

    chatId = msg.chat.id;

    bot.sendMessage(chatId, "🎰 BINGO ACTIVO", {
        reply_markup: { inline_keyboard: board() }
    });
});

// ===================== CALLBACKS
bot.on("callback_query", (q) => {

    bot.answerCallbackQuery(q.id).catch(()=>{});

    const d = q.data;

    if (d.startsWith("n_")) {

        const n = d.split("_")[1];

        if (db.numeros[n]) return;

        db.numeros[n] = {
            user: user(q.from),
            estado: "reservado",
            start: Date.now()
        };

        timer(n);
        save();
        repost();

        bot.sendMessage(chatId,
`🎰 TOMADO ${n}

💰 Nequi: 3123902322
⏱ 10 min`);

        return;
    }

    if (q.from.id !== ADMIN_ID) return;

    const args = d.split("_")[1]?.split("-") || [];

    if (d.startsWith("ok_")) {

        args.forEach(n => {
            if (db.numeros[n]) {
                db.numeros[n].estado = "pagado";
            }
        });

        db.total += args.length * 3000;

        save();
        repost();
    }

    if (d.startsWith("no_")) {

        args.forEach(n => {
            delete db.numeros[n];
        });

        save();
        repost();
    }
});

// ===================== FOTO (PAGO)
bot.on("message", (msg) => {

    if (!msg.photo) return;

    const file = msg.photo[msg.photo.length - 1].file_id;

    let nums = [];

    for (let n in db.numeros) {
        if (db.numeros[n].user === user(msg.from)) {
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

// ===================== ADMIN COMMANDS

// PAYALL
bot.onText(/\/payall/, (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    let count = 0;

    for (let i = 1; i <= 15; i++) {

        if (!db.numeros[i]) {
            db.numeros[i] = { user: "ADMIN", estado: "pagado" };
        } else {
            db.numeros[i].estado = "pagado";
        }

        count++;
    }

    db.total = 15 * 3000;

    save();
    repost();

    bot.sendMessage(msg.chat.id, `⚡ PAYALL OK (${count})`);
});

// PAY SOME
bot.onText(/\/pay (.+)/, (msg, match) => {

    if (msg.from.id !== ADMIN_ID) return;

    let nums = match[1].split(" ");

    nums.forEach(n => {
        if (db.numeros[n]) {
            db.numeros[n].estado = "pagado";
            db.total += 3000;
        }
    });

    save();
    repost();

    bot.sendMessage(msg.chat.id, "✅ PAGOS ACTUALIZADOS");
});

// REMOVE
bot.onText(/\/remove (.+)/, (msg, match) => {

    if (msg.from.id !== ADMIN_ID) return;

    let nums = match[1].split(" ");

    nums.forEach(n => delete db.numeros[n]);

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