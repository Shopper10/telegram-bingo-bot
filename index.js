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

    let c = 0;

    for (let i = 1; i <= 15; i++) {
        if (numeros[i] && numeros[i].estado === "pagado") c++;
    }

    return c === 15;
}

// =====================
function iniciarBingo() {

    if (bingoActivo) return;

    bingoActivo = true;
    sorteados = [];

    bot.sendMessage(tableroChatId,
`🎉 TODOS LOS NÚMEROS VENDIDOS
🎰 INICIA BINGO`);

    setTimeout(sacar, 2500);
}

// =====================
function sacar() {

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

    setTimeout(sacar, 2500);
}

// =====================
function timer(num) {

    startTimes[num] = Date.now();

    if (timers[num]) clearTimeout(timers[num]);

    timers[num] = setTimeout(() => {

        if (!numeros[num] || numeros[num].estado === "pagado") return;

        const u = numeros[num].user.name;

        delete numeros[num];

        guardar();

        bot.sendMessage(tableroChatId,
`⛔ LIBERADO
🎰 ${num}
👤 ${u}`);

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

// ===================== ADMIN PANEL
bot.onText(/\/admin/, (msg) => {

    if (msg.from.id !== ADMIN_ID) return;

    bot.sendMessage(msg.chat.id,
`🛠 ADMIN PANEL PRO`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 DEBUG", callback_data: "admin_debug" }],
                [{ text: "⚡ PAY ALL", callback_data: "admin_payall" }],
                [{ text: "🔄 RESET", callback_data: "admin_reset" }],
                [{ text: "🎰 FORCE BINGO", callback_data: "admin_bingo" }]
            ]
        }
    });
});

// ===================== DEBUG
bot.onText(/\/debug/, (msg) => {

    let p=0,pn=0,r=0;

    for (let i=1;i<=15;i++){
        const n=numeros[i];
        if(!n)continue;
        if(n.estado==="pagado")p++;
        else if(n.estado==="pendiente")pn++;
        else r++;
    }

    bot.sendMessage(msg.chat.id,
`🧠 DEBUG

✅ ${p}
⏳ ${pn}
⛔ ${r}

📊 ${p}/15`);
});

// =====================
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

    // ================= PAY ALL
    if (d === "admin_payall") {

        for (let i=1;i<=15;i++){
            if(!numeros[i]){
                numeros[i]={user:{name:"ADMIN"},estado:"pagado"};
            } else {
                numeros[i].estado="pagado";
            }
        }

        totalDinero=15*3000;
        guardar();

        bot.sendMessage(tableroChatId,"⚡ TODOS PAGADOS");

        repost();

        setTimeout(()=> {
            if(todosVendidos()) iniciarBingo();
        },800);

        return;
    }

    // ================= RESET
    if (d === "admin_reset") {

        numeros={};
        totalDinero=0;
        bingoActivo=false;
        sorteados=[];

        guardar();

        bot.sendMessage(tableroChatId,"🔄 RESET OK");

        repost();

        return;
    }

    // ================= FORCE BINGO
    if (d === "admin_bingo") {

        iniciarBingo();
        return;
    }

    // ================= DEBUG BUTTON
    if (d === "admin_debug") {

        bot.sendMessage(tableroChatId, "🧠 DEBUG USAR /debug");
        return;
    }

    // ================= APPROVE
    if (d.startsWith("ok_")) {

        nums.forEach(n=>{
            if(numeros[n]){
                numeros[n].estado="pagado";
                totalDinero+=3000;
                if(timers[n])clearTimeout(timers[n]);
            }
        });

        guardar();

        bot.sendMessage(tableroChatId,"🔍 COMPROBANDO...");

        repost();

        setTimeout(()=> {
            if(todosVendidos()) iniciarBingo();
        },1000);

        return;
    }

    // ================= REJECT
    if (d.startsWith("no_")) {

        nums.forEach(n=>{
            delete numeros[n];
            if(timers[n])clearTimeout(timers[n]);
        });

        guardar();

        bot.sendMessage(tableroChatId,"❌ RECHAZADO");

        repost();

        return;
    }
});

// ===================== PHOTO
bot.on('message', (msg) => {

    if(!msg.photo)return;

    const id=msg.from.id;
    const file=msg.photo[msg.photo.length-1].file_id;

    let nums=[];

    for(let n in numeros){
        const item=numeros[n];

        if(item.user.id===id &&
        (item.estado==="reservado"||item.estado==="pendiente")){
            nums.push(n);
        }
    }

    if(!nums.length)return;

    nums.forEach(n=>numeros[n].estado="pendiente");

    guardar();

    bot.sendMessage(tableroChatId,"🔍 COMPROBANDO PAGO...");

    bot.sendPhoto(tableroChatId,file,{
        caption:`📥 COMPROBANTE\n👤 ${user(msg.from)}\n🎰 ${nums.join(", ")}`,
        reply_markup:{
            inline_keyboard:[
                [
                    {text:"🟢 APROBAR",callback_data:`ok_${nums.join("-")}`},
                    {text:"🔴 RECHAZAR",callback_data:`no_${nums.join("-")}`}
                ]
            ]
        }
    });
});