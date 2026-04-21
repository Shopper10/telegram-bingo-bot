const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// CONFIG
const ADMIN_ID = Number(process.env.ADMIN_ID);
const TOTAL = 15;
const TIME_LIMIT = 10 * 60; // 10 min

// ESTADO GLOBAL
let numbers = {};
let timers = {};
let boardMsgId = null;

// INIT NUMBERS
for (let i = 1; i <= TOTAL; i++) {
  numbers[i] = {
    state: 'available', // available | reserved | paid
    userId: null,
    user: null,
    time: 0
  };
}

// TABLERO
function board() {
  let text = `🎱 *BINGO 15 NÚMEROS*\n\n`;

  for (let i = 1; i <= TOTAL; i++) {
    const n = numbers[i];

    if (n.state === 'available') {
      text += `🟢 ${i} - Disponible\n`;
    }

    if (n.state === 'reserved') {
      let m = Math.floor(n.time / 60);
      let s = n.time % 60;
      text += `⛔️ ${i} - ${n.user} (${m}:${s.toString().padStart(2,'0')})\n`;
    }

    if (n.state === 'paid') {
      text += `✅ ${i} - ${n.user} PAGADO\n`;
    }
  }

  return text;
}

// UPDATE BOARD
async function updateBoard(ctx) {
  if (!boardMsgId) return;

  try {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      boardMsgId,
      null,
      board(),
      { parse_mode: 'Markdown' }
    );
  } catch (e) {}
}

// BOTONES
function buttons() {
  let btn = [];

  for (let i = 1; i <= TOTAL; i++) {
    btn.push(Markup.button.callback(`🎯 ${i}`, `pick_${i}`));
  }

  return Markup.inlineKeyboard(btn, { columns: 5 });
}

// START
bot.command('start', async (ctx) => {
  const msg = await ctx.reply(board(), {
    parse_mode: 'Markdown',
    ...buttons()
  });

  boardMsgId = msg.message_id;
});

// TOMAR NÚMERO
bot.action(/pick_(\d+)/, async (ctx) => {
  const num = ctx.match[1];
  const userId = ctx.from.id;
  const user = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

  if (numbers[num].state !== 'available') {
    return ctx.answerCbQuery('No disponible');
  }

  numbers[num] = {
    state: 'reserved',
    userId,
    user,
    time: TIME_LIMIT
  };

  ctx.reply(`📩 ${user}, envía comprobante de pago a Nequi para el número ${num}`);

  startTimer(ctx, num);

  await updateBoard(ctx);

  ctx.answerCbQuery('Número reservado');
});

// TIMER
function startTimer(ctx, num) {
  timers[num] = setInterval(async () => {
    if (numbers[num].state !== 'reserved') {
      clearInterval(timers[num]);
      return;
    }

    numbers[num].time--;

    if (numbers[num].time <= 0) {
      clearInterval(timers[num]);

      const u = numbers[num].user;

      numbers[num] = {
        state: 'available',
        userId: null,
        user: null,
        time: 0
      };

      ctx.telegram.sendMessage(ctx.chat.id, `⏰ ${u} no pagó. Número ${num} disponible de nuevo`);
    }

    await updateBoard(ctx);

  }, 1000);
}

// RECIBIR FOTO (COMPROBANTE)
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const user = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

  const num = Object.keys(numbers).find(
    n => numbers[n].userId === userId && numbers[n].state === 'reserved'
  );

  if (!num) return;

  const msg = await ctx.reply('⏳ Verificando pago...');

  // animación simple
  let i = 0;
  const anim = setInterval(async () => {
    i++;
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      null,
      `⏳ Verificando pago${'.'.repeat(i % 4)}`
    );
  }, 500);

  setTimeout(async () => {
    clearInterval(anim);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      null,
      `Pago detectado de ${user} para número ${num}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Aprobar', `ok_${num}`),
          Markup.button.callback('❌ Rechazar', `no_${num}`)
        ]
      ])
    );
  }, 3000);
});

// APROBAR
bot.action(/ok_(\d+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const num = ctx.match[1];

  numbers[num].state = 'paid';
  clearInterval(timers[num]);

  ctx.reply(`✅ Número ${num} PAGADO`);

  await updateBoard(ctx);
});

// RECHAZAR
bot.action(/no_(\d+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const num = ctx.match[1];

  numbers[num] = {
    state: 'available',
    userId: null,
    user: null,
    time: 0
  };

  clearInterval(timers[num]);

  ctx.reply(`❌ Pago rechazado, número ${num} liberado`);

  await updateBoard(ctx);
});

// START BOT
bot.launch();

console.log("Bot bingo iniciado...");