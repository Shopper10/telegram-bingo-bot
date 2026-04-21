const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf('TU_TOKEN_AQUI');

// CONFIG
const ADMIN_ID = 123456789; // <-- TU ID
const TOTAL_NUMEROS = 15;
const TIEMPO_RESERVA = 10 * 60; // 10 min en segundos

// ESTADO
let numeros = {};
let timers = {};
let tableroMsgId = null;

// INICIALIZAR
for (let i = 1; i <= TOTAL_NUMEROS; i++) {
  numeros[i] = {
    estado: 'disponible',
    user: null,
    tiempo: 0
  };
}

// CREAR TABLERO
function generarTablero() {
  let texto = '🎱 *BINGO 15 NÚMEROS*\n\n';

  for (let i = 1; i <= TOTAL_NUMEROS; i++) {
    let n = numeros[i];

    if (n.estado === 'disponible') {
      texto += `🟢 ${i} - Disponible\n`;
    }

    if (n.estado === 'reservado') {
      let min = Math.floor(n.tiempo / 60);
      let sec = n.tiempo % 60;
      texto += `⛔️ ${n.user} ${min}:${sec.toString().padStart(2, '0')}\n`;
    }

    if (n.estado === 'pagado') {
      texto += `✅ ${n.user} PAGADO\n`;
    }
  }

  return texto;
}

// ACTUALIZAR TABLERO
async function actualizarTablero(ctx) {
  if (!tableroMsgId) return;

  try {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      tableroMsgId,
      null,
      generarTablero(),
      { parse_mode: 'Markdown' }
    );
  } catch (e) {}
}

// CREAR BOTONES
function botonesNumeros() {
  let botones = [];

  for (let i = 1; i <= TOTAL_NUMEROS; i++) {
    botones.push(Markup.button.callback(`🎯 ${i}`, `num_${i}`));
  }

  return Markup.inlineKeyboard(botones, { columns: 5 });
}

// INICIAR JUEGO
bot.command('start', async (ctx) => {
  let msg = await ctx.reply(generarTablero(), {
    parse_mode: 'Markdown',
    ...botonesNumeros()
  });

  tableroMsgId = msg.message_id;
});

// TOMAR NÚMERO
bot.action(/num_(\d+)/, async (ctx) => {
  let num = ctx.match[1];
  let user = '@' + (ctx.from.username || ctx.from.first_name);

  if (numeros[num].estado !== 'disponible') {
    return ctx.answerCbQuery('No disponible');
  }

  // RESERVAR
  numeros[num] = {
    estado: 'reservado',
    user: user,
    tiempo: TIEMPO_RESERVA
  };

  ctx.reply(`📩 ${user}, envía comprobante de pago a Nequi para el número ${num}`);

  iniciarTimer(ctx, num);

  actualizarTablero(ctx);

  ctx.answerCbQuery('Número tomado');
});

// TIMER
function iniciarTimer(ctx, num) {
  timers[num] = setInterval(async () => {
    if (numeros[num].estado !== 'reservado') {
      clearInterval(timers[num]);
      return;
    }

    numeros[num].tiempo--;

    // EXPIRÓ
    if (numeros[num].tiempo <= 0) {
      clearInterval(timers[num]);

      ctx.reply(`⏰ Número ${num} liberado nuevamente`);

      numeros[num] = {
        estado: 'disponible',
        user: null,
        tiempo: 0
      };
    }

    actualizarTablero(ctx);

  }, 1000);
}

// RECIBIR FOTO
bot.on('photo', async (ctx) => {
  let user = '@' + (ctx.from.username || ctx.from.first_name);

  let numero = Object.keys(numeros).find(
    n => numeros[n].user === user && numeros[n].estado === 'reservado'
  );

  if (!numero) return;

  let msg = await ctx.reply('⏳ Verificando pago...');

  // animación simple
  let dots = 0;
  let anim = setInterval(async () => {
    dots = (dots + 1) % 4;
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      null,
      '⏳ Verificando pago' + '.'.repeat(dots)
    );
  }, 500);

  setTimeout(async () => {
    clearInterval(anim);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      null,
      `Pago de ${user} para número ${numero}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Aprobar', `ok_${numero}`),
          Markup.button.callback('❌ Rechazar', `bad_${numero}`)
        ]
      ])
    );

  }, 3000);
});

// APROBAR
bot.action(/ok_(\d+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  let num = ctx.match[1];

  numeros[num].estado = 'pagado';
  clearInterval(timers[num]);

  ctx.reply(`✅ Número ${num} PAGADO`);

  actualizarTablero(ctx);
});

// RECHAZAR
bot.action(/bad_(\d+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  let num = ctx.match[1];

  numeros[num] = {
    estado: 'disponible',
    user: null,
    tiempo: 0
  };

  clearInterval(timers[num]);

  ctx.reply(`❌ Pago rechazado, número ${num} disponible`);

  actualizarTablero(ctx);
});

bot.launch();