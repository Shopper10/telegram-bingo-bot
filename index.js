const TelegramBot = require('node-telegram-bot-api');
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, {
    polling: { interval: 1000, autoStart: true }
});

const DATA_FILE = "./data.json";

// =====================
let numeros = {};
let tableroChatId = null;
let totalDinero = 0;

let timers = {};
let startTimes = {};

let bingoActivo = false;
let sorteados = [];

// =====================
function cargar() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const d = JSON.parse(fs.readFileSync(DATA_FILE));
            numeros = d.numeros || {};
            totalDinero = d.totalDinero || 0;
        }
    } catch {}
}

function guardar() {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ numeros, totalDinero }));
}

// =====================
function user(u) {
    return u.username ? `@${u.username}` : u.first_name;
}

// =====================
function tiempo(ms) {
    let t = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2,"0")}`;
}

// ===================== TABLERO
function tablero() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        const n = numeros[i];

        if (!n) {
            kb.push([{ text: `🟢 ${i}- DISPONIBLE`, callback_data: `num_${i}` }]);
            continue;
        }

        let txt = `🟢 ${i}- DISPONIBLE`;

        if (n.estado === "reservado" || n.estado === "pendiente") {
            let r = 600000 - (Date.now() - startTimes[i]);
            txt = `⛔ ${i}- ${n.user.name} ⏱ ${tiempo(r)}`;
        }

        if (n.estado === "pagado") {
            txt = `✅ ${i}- ${n.user.name} - PAGADO`;
        }

        kb.push([{ text: txt, callback_data: `num_${i}` }]);
    }

    return kb;
}

// =====================
function repost() {

    if (!tableroChatId) return;

    bot.sendMessage(tableroChatId,
`🎰 CASINO BINGO

💰 Total: $${totalDinero}`, {
        reply_markup: { inline_keyboard: tablero() }
    });
}

// =====================
function todosVendidos() {

    for (let i = 1; i <= 15; i++) {
        if (!numeros[i] || numeros[i].estado !== "pagado") {
            return false;
        }
    }

    return true;
}

// =====================
function iniciarBingo() {

    if (bingoActivo) return;

    bingoActivo = true;
    sorteados = [];

    bot.sendMessage(tableroChatId,
`🎉 TODOS LOS NÚMEROS VENDIDOS
🎰 INICIA BINGO`);

    setTimeout(sacarNumero, 2500);
}

// =====================
function sacarNumero() {

    if (!bingoActivo) return;

    let libres = [];

    for (let i = 1; i <= 15; i++) {
        if (!sorteados.includes(i)) libres.push(i);
    }

    let num = libres[Math.floor(Math.random() * libres.length)];

    sorteados.push(num);

    bot.sendMessage(tableroChatId,
`🎰 SALE: ${num}
📊 ${sorteados.join(" - ")}`);

    const lineas = [
        [1,2,3,4,5],
        [6,7,8,9,10],
        [11,12,13,14,15]
    ];

    for (let l of lineas) {

        if (l.every(n => sorteados.includes(n))) {

            bingoActivo = false;

            bot.sendMessage(tableroChatId,
`🏆 ¡BINGO!
🎯 Línea: ${l.join(" - ")}`);

            return;
        }
    }

    setTimeout(sacarNumero, 2500);
}

// ===================== TIMER CORREGIDO (CLAVE)
function timer(num) {

    startTimes[num] = Date.now();

    if (timers[num]) clearTimeout(timers[num]);

    timers[num] = setTimeout(() => {

        const item = numeros[num];

        if (!item || item.estado === "pagado") return;

        const u = item.user.name;

        delete numeros[num];
        delete timers[num];
        delete startTimes[num];

        guardar();

        bot.sendMessage(tableroChatId,
`⛔ TIEMPO EXPIRADO

🎰 ${num}
👤 ${u}`);

        repost();

    }, 600000);
}

// =====================
cargar();

// =====================
bot.onText(/\/bingo/, (msg) => {

    tableroChatId = msg.chat.id;

    bot.sendMessage(msg.chat.id,
`🎰 CASINO BINGO

💰 Total: $${totalDinero}`, {
        reply_markup: { inline_keyboard: tablero() }
    });
});

// ===================== DEBUG
bot.onText(/\/debug/, (msg) => {

    let p=0, pen=0, r=0;

    for (let i=1;i<=15;i++){
        const n=numeros[i];
        if(!n)continue;
        if(n.estado==="pagado")p++;
        else if(n.estado==="pendiente")pen++;
        else r++;
    }

    bot.sendMessage(msg.chat.id,
`🧠 DEBUG

✅ ${p}
⏳ ${pen}
⛔ ${r}

📊 ${p}/15`);
});

// ===================== PAYALL (FIX FINAL)
bot.onText(/\/payall/, (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    for (let i = 1; i <= 15; i++) {

        if (!numeros[i]) {
            numeros[i] = { user: { name: "ADMIN" }, estado: "pagado" };
        } else {
            numeros[i].estado = "pagado";
        }

        if (timers[i]) {
            clearTimeout(timers[i]);
            delete timers[i];
        }

        if (startTimes[i]) {
            delete startTimes[i];
        }
    }

    totalDinero = 15 * 3000;

    guardar();

    bot.sendMessage(msg.chat.id, "⚡ PAYALL EJECUTADO");

    repost();

    setTimeout(() => {
        if (todosVendidos()) {
            bot.sendMessage(tableroChatId, "🎉 TODOS PAGADOS");
            iniciarBingo();
        }
    }, 1000);
});

// ===================== CALLBACKS
bot.on('callback_query', (q) => {

    const d = q.data;

    if (d.startsWith("num_")) {

        const n = parseInt(d.split("_")[1]);

        if (numeros[n]) return;

        numeros[n] = {
            user: { id: q.from.id, name: user(q.from) },
            estado: "reservado"
        };

        timer(n);
        guardar();

        bot.sendMessage(tableroChatId,
`🎰 TOMADO
🎰 ${n}
👤 ${numeros[n].user.name}

💰 Nequi: 3123902322
⏱ 10 min`);

        return;
    }

    if (q.from.id !== ADMIN_ID) return;

    const nums = d.split("_")[1]?.split("-") || [];

    if (d.startsWith("ok_")) {

        nums.forEach(n => {
            if (numeros[n]) {
                numeros[n].estado = "pagado";
                totalDinero += 3000;

                if (timers[n]) {
                    clearTimeout(timers[n]);
                    delete timers[n];
                }

                if (startTimes[n]) delete startTimes[n];
            }
        });

        guardar();

        bot.sendMessage(tableroChatId, "🔍 COMPROBANDO...");

        repost();

        setTimeout(() => {
            if (todosVendidos()) iniciarBingo();
        }, 1000);

        return;
    }

    if (d.startsWith("no_")) {

        nums.forEach(n => {
            delete numeros[n];

            if (timers[n]) {
                clearTimeout(timers[n]);
                delete timers[n];
            }

            if (startTimes[n]) delete startTimes[n];
        });

        guardar();

        bot.sendMessage(tableroChatId, "❌ RECHAZADO");

        repost();

        return;
    }
});

// ===================== PHOTO
bot.on('message', (msg) => {

    if (!msg.photo) return;

    const id = msg.from.id;
    const file = msg.photo[msg.photo.length - 1].file_id;

    let nums = [];

    for (let n in numeros) {
        const item = numeros[n];

        if (item.user.id === id &&
            (item.estado === "reservado" || item.estado === "pendiente")) {
            nums.push(n);
        }
    }

    if (!nums.length) return;

    nums.forEach(n => numeros[n].estado = "pendiente");

    guardar();

    bot.sendMessage(tableroChatId, "🔍 COMPROBANDO PAGO...");

    bot.sendPhoto(tableroChatId, file, {
        caption: `📥 COMPROBANTE\n👤 ${user(msg.from)}\n🎰 ${nums.join(", ")}`,
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