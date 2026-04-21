const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = Number(process.env.ADMIN_ID);

const TOTAL = 15;
const TIME = 10 * 60;

let data = {};
let timers = {};
let boardMsg = null;

// INIT
for (let i = 1; i <= TOTAL; i++) {
  data[i] = {
    state: 'free', // free | reserved | paid
    userId: null,
    user: null,
    time: 0
  };
}

// 🔥 CONTAR NUMEROS POR USUARIO
function contar(userId) {
  return Object.values(data).filter(n =>
    n.userId === userId && n.state === 'reserved'
  ).length;
}

// 🟩 BARRA VERDE
function barra(step) {
  const total = 10;
  return '🟩'.repeat(step) + '⬜️'.repeat(total - step) + ` ${step * 10}%`;
}

// 📊 TABLERO
function render() {
  let txt = `🎱 *BINGO 15 NÚMEROS*\n\n`;

  for (let i = 1; i <= TOTAL; i++) {
    let n = data[i];

    if (n.state === 'free') {
      txt += `🟢 ${i} - Disponible\n`;
    }

    if (n.state === 'reserved') {
      let m = Math.floor(n.time / 60);
      let s = n.time % 60;
      txt += `⛔️ ${n.user} ${m}:${s.toString().padStart(2,'0')}\n`;
    }

    if (n.state === 'paid') {
      txt += `✅ ${n.user} PAGADO\n`;
    }
  }

  return txt;
}

// 🔄 ACTUALIZAR TABLERO
async function update(ctx) {
  if (!boardMsg) return;

  try {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      boardMsg,
      null,
      render(),
      { parse_mode: 'Markdown' }
    );
  } catch {}
}

// 🚀 START
bot.command('start', async (ctx) => {
  const msg = await ctx.reply(render());
  boardMsg = msg.message_id;
});

// 🎯 TOMAR NUMERO (MAX 5)
bot.action(/pick_(\d+)/, async (ctx) => {
  const num = ctx.match[1];
  const userId = ctx.from.id;

  if (contar(userId) >= 5) {
    return ctx.answerCbQuery('❌ Máximo 5 números');
  }

  if (data[num].state !== 'free') {
    return ctx.answerCbQuery('No disponible');
  }

  let user = ctx.from.username
    ? `@${ctx.from.username}`
    : ctx.from.first_name;

  data[num] = {
    state: 'reserved',
    userId,
    user,
    time: TIME
  };

  ctx.reply(`📩 ${user}, envía comprobante a Nequi`);

  startTimer(ctx, num);
  update(ctx);

  ctx.answerCbQuery('Reservado');
});

// ⏳ TIMER
function startTimer(ctx, num) {
  timers[num] = setInterval(async () => {

    if (data[num].state !== 'reserved') {
      clearInterval(timers[num]);
      return;
    }

    data[num].time--;

    if (data[num].time <= 0) {
      clearInterval(timers[num]);

      let user = data[num].user;

      data[num] = {
        state: 'free',
        userId: null,
        user: null,
        time: 0
      };

      ctx.telegram.sendMessage(
        ctx.chat.id,
        `⏰ ${user} no pagó. Número ${num} libre otra vez`
      );
    }

    update(ctx);

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

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      null,
      `⏳ Verificando pago...\n\n${barra(step)}`
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
  clearInterval(timers[num]);

  ctx.reply(`✅ Número ${num} PAGADO`);

  update(ctx);
});

// ❌ RECHAZAR
bot.action(/no_(\d+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const num = ctx.match[1];

  data[num] = {
    state: 'free',
    userId: null,
    user: null,
    time: 0
  };

  clearInterval(timers[num]);

  ctx.reply(`❌ Rechazado, número ${num} liberado`);

  update(ctx);
});

bot.launch();

console.log("🎱 Bingo bot activo...");