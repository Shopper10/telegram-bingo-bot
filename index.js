const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, { polling: true });

// 📦 DATA
let numeros = {};
let tableroChatId = null;
let tableroMessageId = null;
let totalDinero = 0;

let timers = {};
let startTimes = {};
let alertados = {};

// 👤 USER
function getUser(user) {
    return user.username ? `@${user.username}` : user.first_name;
}

// ⏱️ TIEMPO
function formatTiempo(ms) {
    let total = Math.max(0, Math.floor(ms / 1000));
    let min = Math.floor(total / 60);
    let sec = total % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

// 🎰 TABLERO
function generarTablero() {

    let keyboard = [];

    for (let i = 1; i <= 15; i++) {

        const item = numeros[i];
        let texto = `🟢 ${i} - DISPONIBLE`;

        if (item) {

            const u = item.user.name;

            if (item.estado === "reservado") {

                let tiempo = "";

                if (startTimes[i]) {
                    let restante = 300000 - (Date.now() - startTimes[i]);
                    tiempo = ` ${formatTiempo(restante)}`;

                    if (restante <= 30000 && !alertados[i]) {
                        alertados[i] = true;

                        bot.sendMessage(tableroChatId,
`⚠️ ÚLTIMOS 30 SEGUNDOS

👤 ${u}
🔢 ${i}

⏳ Si no paga se libera`);
                    }
                }

                texto = `⛔️ ${i} - ${u}${tiempo}`;
            }

            if (item.estado === "pendiente") {
                texto = `⏱️ ${i} - ${u} PENDIENTE`;
            }

            if (item.estado === "pagado") {
                texto = `✅ ${i} - ${u} PAGADO`;
            }
        }

        keyboard.push([{
            text: texto,
            callback_data: `num_${i}`
        }]);
    }

    return keyboard;
}

// 🔄 TABLERO
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

// 🔁 REFRESH
setInterval(() => {
    actualizarTablero();
}, 5000);

// 🎰 INICIO
bot.onText(/\/bingo/, async (msg) => {

    tableroChatId = msg.chat.id;

    const sent = await bot.sendMessage(msg.chat.id,
`🎰 CASINO BINGO EN VIVO

💰 Total: $${totalDinero}`, {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });

    tableroMessageId = sent.message_id;
});

// ⏱️ TIMER
function iniciarTimer(num) {

    startTimes[num] = Date.now();
    alertados[num] = false;

    timers[num] = setTimeout(() => {

        if (numeros[num] && numeros[num].estado === "reservado") {

            const user = numeros[num].user.name;

            delete numeros[num];

            actualizarTablero();

            bot.sendMessage(tableroChatId,
`⛔️ TIEMPO AGOTADO

👤 ${user}
🔢 ${num}

🟢 Disponible nuevamente`);
        }

    }, 300000);
}

// 🎯 CALLBACK UNICO (ARREGLADO)
bot.on('callback_query', async (query) => {

    try {

        const data = query.data;
        const user = getUser(query.from);

        // 🎯 TOMAR NÚMERO
        if (data.startsWith("num_")) {

            const num = parseInt(data.split("_")[1]);

            if (numeros[num]) {
                bot.answerCallbackQuery(query.id, { text: "❌ Ocupado" });
                return;
            }

            numeros[num] = {
                user: {
                    id: query.from.id,
                    name: user
                },
                estado: "reservado"
            };

            iniciarTimer(num);
            actualizarTablero();

            bot.sendMessage(tableroChatId,
`🎯 NÚMERO TOMADO

👤 ${user}
🔢 ${num}

⏱️ 5 minutos para pagar`);

            bot.answerCallbackQuery(query.id);
            return;
        }

        // 🔒 ADMIN
        if (query.from.id !== ADMIN_ID) {
            bot.answerCallbackQuery(query.id, { text: "⛔ No autorizado" });
            return;
        }

        const num = parseInt(data.split("_")[1]);
        if (!numeros[num]) return;

        const name = numeros[num].user.name;

        // ❌ RECHAZAR
        if (data.startsWith("no_")) {

            delete numeros[num];
            actualizarTablero();

            bot.sendMessage(tableroChatId,
`❌ RECHAZADO

🔢 ${num}
👤 ${name}`);

            return;
        }

        // ✅ APROBAR (TU RUEDA SE MANTIENE)
        if (data.startsWith("ok_")) {

            numeros[num].estado = "pagado";
            totalDinero += 3000;

            actualizarTablero();

            bot.sendMessage(tableroChatId,
`🎰 APROBADO

👤 ${name}
🔢 ${num}
💰 +$3.000`);
        }

    } catch (err) {
        console.log("ERROR CALLBACK:", err);
    }
});