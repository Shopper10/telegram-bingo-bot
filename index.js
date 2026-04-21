const { Telegraf, Markup } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = Number(process.env.ADMIN_ID);

const TOTAL = 15;
const TIME = 10 * 60;

let data = {};
let boardMsg = null;

// 🔥 INIT
for (let i = 1; i <= TOTAL; i++) {
  data[i] = {
    state: 'free', // free | reserved | paid
    userId: null,
    user: null,
    time: 0,
    lock: false
  };
}

// 🎰 TABLERO CASINO PRO (BOTONES BLOQUEADOS)
function boardUI() {
  let rows = [];

  for (let i = 1; i <= TOTAL; i += 3) {
    let row = [];

    for (let j = i; j < i + 3 && j <= TOTAL; j++) {
      let n = data[j];

      let label = '';

      if (n.state === 'free') {
        label = `🟢 ${j}`;
      }

      if (n.state === 'reserved') {
        let m = Math.floor(n.time / 60);
        let s = n.time % 60;
        label = `⛔️ ${j} ${n.user} ${m}:${s.toString().padStart(2,'0')}`;
      }

      if (n.state === 'paid') {
        label = `✅ ${j} ${n.user}`;
      }

      row.push(
        Markup.button.callback(
          label,
          `pick_${j}`,
          n.state !== 'free' // 🔒 bloqueado si no está libre
        )
      );
    }

    rows.push(row);
  }

  return Markup.inlineKeyboard(rows);
}

// 🚀 START
bot.command('start', async (ctx) => {
  const msg = await ctx.reply(
    '🎰 CASINO BINGO PRO',
    boardUI()
  );

  boardMsg = msg.message_id;
});

// 🎯 TOMAR NÚMERO
bot.action(/pick_(\d+)/, async (ctx) => {
  const num = ctx.match[1];
  const userId = ctx.from.id;

  if (data[num].state !== 'free') {
    return ctx.answerCbQuery('❌ No disponible');
  }

  if (data[num].lock) {
    return ctx.answerCbQuery('⏳ Procesando...');
  }

  data[num].lock = true;

  // 🔥 LIMITE 5 NUMEROS POR USUARIO
  const count = Object.values(data).filter(
    n => n.userId === userId && n.state === 'reserved'
  ).length;

  if (count >= 5) {
    data[num].lock = false;
    return ctx.answerCbQuery('❌ Máximo 5 números');
  }

  let user = '@' + (ctx.from.username || ctx.from.first_name);

  data[num] = {
    state: 'reserved',
    userId,
    user,
    time: TIME,
    lock: false
  };

  ctx.reply(`📩 ${user}, envía comprobante de pago a Nequi`);

  startTimer(ctx, num);
  await updateBoard(ctx);

  ctx.answerCbQuery('✔ Reservado');
});

// ⏱ TIMER CASINO
function startTimer(ctx, num) {
  setInterval(async () => {

    if (data[num].state !== 'reserved') return;

    data[num].time--;

    if (data[num].time <= 0) {

      let user = data[num].user;

      data[num] = {
        state: 'free',
        userId: null,
        user: null,
        time: 0,
        lock: false
      };

      ctx.telegram.sendMessage(
        ctx.chat.id,
        `⏰ ${user} no pagó. Número ${num} liberado`
      );
    }

    await updateBoard(ctx);

  }, 1000);
}

// 📸 FOTO COMPROBANTE
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;

  let num = Object.keys(data).find(
    n => data[n].userId === userId && data[n].state === 'reserved'
  );

  if (!num) return;

  let msg = await ctx.reply('⏳ Verificando pago...');

  let step = 0;

  let anim = setInterval(async () => {
    step++;

    let bar =
      '🟩'.repeat(step) +
      '⬜️'.repeat(10 - step) +
      ` ${step * 10}%`;

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      null,
      `⏳ Verificando pago...\n\n${bar}`
    );

    if (step >= 10) clearInterval(anim);

  }, 400);

  setTimeout(async () => {
    clearInterval(anim);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      null,
      `📩 Pago detectado para número ${num}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Aprobar', `ok_${num}`),
          Markup.button.callback('❌ Rechazar', `no_${num}`)
        ]
      ])
    );
  }, 4500);
});

// ✅ APROBAR
bot.action(/ok_(\d+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const num = ctx.match[1];

  data[num].state = 'paid';

  ctx.reply(`✅ Número ${num} PAGADO`);

  await updateBoard(ctx);
});

// ❌ RECHAZAR
bot.action(/no_(\d+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const num = ctx.match[1];

  data[num] = {
    state: 'free',
    userId: null,
    user: null,
    time: 0,
    lock: false
  };

  ctx.reply(`❌ Rechazado, número ${num} liberado`);

  await updateBoard(ctx);
});

// 🔄 UPDATE TABLERO
async function updateBoard(ctx) {
  if (!boardMsg) return;

  try {
    await ctx.telegram.editMessageReplyMarkup(
      ctx.chat.id,
      boardMsg,
      null,
      boardUI().reply_markup
    );
  } catch {}
}

bot.launch();

console.log("🎰 Casino Bingo PRO activo...");