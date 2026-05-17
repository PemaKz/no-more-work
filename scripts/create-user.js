#!/usr/bin/env node
const prompts = require('prompts');
const { Kernel } = require('zyket');

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    const m = raw.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

async function main() {
  const cli = parseArgs(process.argv);

  if (!process.env.SCRIPT_PORT_OVERRIDE) {
    process.env.PORT = String(3000 + Math.floor(Math.random() * 1000) + 1000);
  }
  process.env.DISABLE_EVENTS = process.env.DISABLE_EVENTS || 'true';
  process.env.DISABLE_BULLMQ = process.env.DISABLE_BULLMQ || 'true';
  process.env.DISABLE_SCHEDULER = process.env.DISABLE_SCHEDULER || 'true';
  process.env.DISABLE_SOCKET = process.env.DISABLE_SOCKET || 'true';

  const answers = await prompts(
    [
      {
        type: cli.email ? null : 'text',
        name: 'email',
        message: 'Email',
        validate: (v) => /.+@.+\..+/.test(v) || 'Email inválido',
      },
      {
        type: cli.name ? null : 'text',
        name: 'name',
        message: 'Nombre',
        validate: (v) => (v && v.trim().length > 0) || 'Requerido',
      },
      {
        type: cli.password ? null : 'password',
        name: 'password',
        message: 'Contraseña (mín. 8)',
        validate: (v) => (v && v.length >= 8) || 'Mínimo 8 caracteres',
      },
    ],
    {
      onCancel: () => {
        console.log('Cancelado.');
        process.exit(1);
      },
    }
  );

  const email = cli.email || answers.email;
  const name = cli.name || answers.name;
  const password = cli.password || answers.password;
  const role = cli.role || 'user';

  if (!email || !name || !password) {
    console.error('Faltan datos (email, name, password).');
    process.exit(1);
  }

  const kernel = new Kernel({
    services: [
      ['auth', require('../src/services/auth'), ['@service_container']],
    ],
  });

  await kernel.boot(false);

  const authService = kernel.container.get('auth');
  const auth = authService.client;

  try {
    const signupResult = await auth.api.signUpEmail({
      body: { email, password, name },
    });

    const userId = signupResult?.user?.id;
    if (!userId) {
      throw new Error('No se pudo obtener el ID del usuario tras signUp.');
    }

    if (role && role !== 'user') {
      try {
        await auth.api.setRole({
          body: { userId, role },
        });
      } catch (e) {
        console.warn(`Usuario creado pero no se pudo asignar role "${role}":`, e.message);
      }
    }

    console.log('\n✅ Usuario creado:');
    console.log(JSON.stringify(signupResult, null, 2));
    console.log(
      '\nℹ️  Se añadirá automáticamente a la organización "No More Work" en su primer login.'
    );
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error creando usuario:', err.message || err);
    if (err.body) console.error(err.body);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
