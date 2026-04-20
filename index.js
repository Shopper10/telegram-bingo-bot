const TelegramBot = require('node-telegram-bot-api');
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, { polling: true });

const DATA_FILE = "./data.json";

// =====================
// ESTADO
// =====================
let numeros = {};
let tableroChatId = null;
let tableroMessageId = null;
let totalDinero = 0;

let timers = {};
let startTimes = {};
let alertados = {};

// =====================
// GUARDAR / CARGAR
// =====================
function cargarDatos() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE));
            numeros = data.numeros || {};
            totalDinero = data.totalDinero || 0;
        }
    } catch (e) {
        console.log(e.message);
    }
}

function guardarDatos() {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        numeros,
        totalDinero
    }));
}

// =====================
// USER
// =====================
function getUser(user) {
    return user.username ? `@${user.username}` : user.first_name;
}

// =====================
// TIEMPO
// =====================
function formatTiempo(ms) {
    let total = Math.max(0, Math.floor(ms / 1000));
    let min = Math.floor(total / 60);
    let sec = total % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

// =====================
// TABLERO CASINO
// =====================
function generarTablero() {

    let keyboard = [];

    for (let i = 1; i <= 15; i++) {

        const item = numeros[i];

        let texto = `🟢 ${i} - DISPONIBLE`;

        if (item) {

            const u = item.user.name;

            if (item.estado === "reservado") {
                let restante = 600000 - (Date.now() - startTimes[i]);
                texto = `⛔️ ${i} - ${u} - ${formatTiempo(restante)}`;
            }

            if (item.estado === "pagado") {
                texto = `✅ ${i} - ${u}`;
            }
        }

        keyboard.push([{
            text: texto,
            callback_data: `num_${i}`
        }]);
    }

    return keyboard;
}

// =====================
// REENVIAR TABLERO COMPLETO
// =====================
function reenviarTableroCompleto() {

    if (!tableroChatId) return;

    bot.sendMessage(tableroChatId,
`🎰 TABLERO ACTUALIZADO

💰 Total: $${totalDinero}`, {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    }).then(msg => {
        tableroMessageId = msg.message_id;
    });
}

// =====================
// ACTUALIZAR TABLERO (SOLO BOTONES)
// =====================
function actualizarTablero() {

    if (!tableroChatId || !tableroMessageId) return;

    bot.editMessageReplyMarkup(
        { inline_keyboard: generarTablero() },
        {
            chat_id: tableroChatId,
            message_id: tableroMessageId
        }
    ).catch(() => {});
}

// =====================
// TIMER 10 MIN
// =====================
function iniciarTimer(num) {

    startTimes[num] = Date.now();
    alertados[num] = { a2: false, a1: false };

    if (timers[num]) clearTimeout(timers[num]);

    timers[num] = setTimeout(() => {

        const item = numeros[num];

        if (!item || item.estado === "pagado") return;

        const user = item.user.name;

        delete numeros[num];
        delete timers[num];
        delete startTimes[num];
        delete alertados[num];

        guardarDatos();
        actualizarTablero();

        bot.sendMessage(tableroChatId,
`⛔️ LIBERADO

🔢 ${num}
👤 ${user}
⌛ Sin pago`);
    }, 600000);
}

// =====================
// LOOP ALERTAS + UI
// =====================
setInterval(() => {

    for (let i in numeros) {

        if (numeros[i].estado !== "reservado") continue;

        let restante = 600000 - (Date.now() - startTimes[i]);

        if (!alertados[i]) continue;

        if (restante <= 120000 && !alertados[i].a2) {
            alertados[i].a2 = true;
            bot.sendMessage(tableroChatId,
`⚠️ QUEDAN 2 MIN

🔢 ${i}`);
        }

        if (restante <= 60000 && !alertados[i].a1) {
            alertados[i].a1 = true;
            bot.sendMessage(tableroChatId,
`🔥 ÚLTIMO MINUTO

🔢 ${i}`);
        }
    }

    actualizarTablero();

}, 2000);

// =====================
// INICIO
// =====================
cargarDatos();

bot.onText(/\/bingo/, async (msg) => {

    tableroChatId = msg.chat.id;

    const sent = await bot.sendMessage(msg.chat.id,
`🎰 CASINO BINGO

💰 Total: $${totalDinero}`, {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });

    tableroMessageId = sent.message_id;
});

// =====================
// TOMAR NÚMERO
// =====================
bot.on('callback_query', (query) => {

    const data = query.data;

    if (data.startsWith("num_")) {

        const num = parseInt(data.split("_")[1]);

        if (numeros[num]) return;

        numeros[num] = {
            user: {
                id: query.from.id,
                name: getUser(query.from)
            },
            estado: "reservado"
        };

        iniciarTimer(num);
        guardarDatos();

        bot.sendMessage(tableroChatId,
`🎰 TOMADO

🔢 ${num}
👤 ${numeros[num].user.name}

💰 Nequi: 3123902322
📸 Envía comprobante
⏱ 10 min`);
        return;
    }

    if (query.from.id !== ADMIN_ID) return;

    // ✅ APROBAR
    if (data.startsWith("ok_")) {

        const nums = data.split("_")[1].split("-");

        nums.forEach(n => {
            if (numeros[n]) {
                numeros[n].estado = "pagado";
                totalDinero += 3000;
                if (timers[n]) clearTimeout(timers[n]);
            }
        });

        guardarDatos();

        bot.sendMessage(tableroChatId,
`✅ PAGOS APROBADOS

🎰 ${nums.join(", ")}`);

        // 🔥 REPUBLICAR TABLERO COMPLETO
        reenviarTableroCompleto();
    }

    // ❌ RECHAZAR
    if (data.startsWith("no_")) {

        const nums = data.split("_")[1].split("-");

        nums.forEach(n => {
            delete numeros[n];
            if (timers[n]) clearTimeout(timers[n]);
        });

        guardarDatos();

        bot.sendMessage(tableroChatId,
`❌ PAGOS RECHAZADOS`);

        // 🔥 REPUBLICAR TABLERO COMPLETO
        reenviarTableroCompleto();
    }
});

// =====================
// FOTO (ADMIN CONTROL)
// =====================
bot.on('message', (msg) => {

    if (!msg.photo) return;

    const userId = msg.from.id;
    const fileId = msg.photo[msg.photo.length - 1].file_id;

    let nums = [];

    for (let n in numeros) {
        if (numeros[n].user.id === userId &&
            numeros[n].estado === "reservado") {
            nums.push(n);
        }
    }

    if (!nums.length) return;

    nums.forEach(n => {
        numeros[n].estado = "reservado";
        iniciarTimer(n);
    });

    guardarDatos();

    bot.sendPhoto(tableroChatId, fileId, {
        caption:
`📥 PAGO

👤 ${getUser(msg.from)}
🔢 ${nums.join(", ")}

⚠️ SOLO ADMIN`,
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "✅ APROBAR", callback_data: `ok_${nums.join("-")}` },
                    { text: "❌ RECHAZAR", callback_data: `no_${nums.join("-")}` }
                ]
            ]
        }
    });
});