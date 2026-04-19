const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, { polling: true });

// 📦 ESTADO GLOBAL
let numeros = {};
let tableroChatId = null;
let tableroMessageId = null;
let totalDinero = 0;

let timers = {};
let startTimes = {};
let alertados = {};

// 👤 USER NAME
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
                    let restante = 600000 - (Date.now() - startTimes[i]);
                    tiempo = ` ${formatTiempo(restante)}`;

                    if (restante <= 30000 && !alertados[i]) {
                        alertados[i] = true;

                        bot.sendMessage(tableroChatId,
`⚠️ ÚLTIMO AVISO

👤 ${u}
🔢 ${i}
⏳ 30s restantes`);
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

// 🔄 ACTUALIZAR TABLERO
function actualizarTablero() {

    if (!tableroChatId || !tableroMessageId) return;

    bot.editMessageReplyMarkup(
        { inline_keyboard: generarTablero() },
        {
            chat_id: tableroChatId,
            message_id: tableroMessageId
        }
    ).catch(err => console.log("update error:", err.message));
}

// 📢 REPOST TABLERO
function reenviarTablero() {

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

// 🔁 LOOP
setInterval(actualizarTablero, 5000);

// 🎰 INICIO TABLERO
bot.onText(/\/bingo/, async (msg) => {

    tableroChatId = msg.chat.id;

    const sent = await bot.sendMessage(msg.chat.id,
`🎰 BINGO EN VIVO

💰 Total: $${totalDinero}`, {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });

    tableroMessageId = sent.message_id;
});

// ⏱️ TIMER 10 MIN
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

🟢 LIBERADO`);
        }

    }, 600000);
}

// 🎯 CALLBACKS
bot.on('callback_query', async (query) => {

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

💰 PAGA Y ENVÍA CAPTURA`);

        bot.answerCallbackQuery(query.id);
        return;
    }

    // 🔒 ADMIN ONLY
    if (query.from.id !== ADMIN_ID) return;

    const num = parseInt(data.split("_")[1]);
    if (!numeros[num] && !data.includes("all")) return;

    // ❌ RECHAZAR TODO
    if (data.startsWith("no_all_")) {

        const nums = data.replace("no_all_", "").split("-");

        nums.forEach(n => delete numeros[n]);

        actualizarTablero();
        reenviarTablero();

        bot.sendMessage(tableroChatId,
`❌ PAGO RECHAZADO

🔢 ${nums.join(", ")}`);

        return;
    }

    // ✅ APROBAR TODO
    if (data.startsWith("ok_all_")) {

        const nums = data.replace("ok_all_", "").split("-");

        nums.forEach(n => {
            if (numeros[n]) {
                numeros[n].estado = "pagado";
                totalDinero += 3000;
            }
        });

        actualizarTablero();

        bot.sendMessage(tableroChatId,
`⏳ VERIFICANDO PAGO...`);

        setTimeout(() => {

            bot.sendMessage(tableroChatId,
`✅ PAGO CONFIRMADO

👤 ${numeros[nums[0]].user.name}
🔢 ${nums.join(", ")}
💰 TOTAL: $${nums.length * 3000}`);

            reenviarTablero();

        }, 1500);

        return;
    }

    // ❌ RECHAZAR INDIVIDUAL
    if (data.startsWith("no_")) {

        delete numeros[num];

        actualizarTablero();
        reenviarTablero();

        bot.sendMessage(tableroChatId,
`❌ RECHAZADO

🔢 ${num}`);

        return;
    }

    // ✅ APROBAR INDIVIDUAL
    if (data.startsWith("ok_")) {

        numeros[num].estado = "pagado";
        totalDinero += 3000;

        actualizarTablero();

        bot.sendMessage(tableroChatId,
`⏳ VERIFICANDO PAGO...`);

        setTimeout(() => {

            bot.sendMessage(tableroChatId,
`✅ PAGO CONFIRMADO

👤 ${numeros[num].user.name}
🔢 ${num}
💰 +$3.000`);

            reenviarTablero();

        }, 1500);
    }
});

// 📸 FOTO (MULTI PAGO)
bot.on('photo', (msg) => {

    const userId = msg.from.id;
    const fileId = msg.photo[msg.photo.length - 1].file_id;

    let numerosUsuario = [];

    for (let n in numeros) {
        if (
            numeros[n].user.id === userId &&
            numeros[n].estado === "reservado"
        ) {
            numerosUsuario.push(n);
        }
    }

    if (numerosUsuario.length === 0) {
        bot.sendMessage(msg.chat.id, "❌ No tienes números");
        return;
    }

    numerosUsuario.forEach(n => {
        clearTimeout(timers[n]);
        numeros[n].estado = "pendiente";
    });

    actualizarTablero();

    bot.sendPhoto(tableroChatId, fileId, {
        caption:
`📥 PAGO EN REVISIÓN

👤 ${numeros[numerosUsuario[0]].user.name}
🔢 ${numerosUsuario.join(", ")}
💰 TOTAL: $${numerosUsuario.length * 3000}`,

        reply_markup: {
            inline_keyboard: [
                [
                    { text: "✅ APROBAR TODO", callback_data: `ok_all_${numerosUsuario.join("-")}` },
                    { text: "❌ RECHAZAR TODO", callback_data: `no_all_${numerosUsuario.join("-")}` }
                ]
            ]
        }
    });
});