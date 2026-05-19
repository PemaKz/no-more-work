const { Kernel, BullBoardExtension } = require('zyket');

const kernel = new Kernel({
	services: [
		['auth', require('./src/services/auth'), ["@service_container"]],
	],
    extensions: [
        new BullBoardExtension({
        }),
    ],
});

kernel.boot().then(async () => {
    console.log('Kernel booted successfully!');
    const db = kernel.container.get('database');
    await db.sequelize.sync();

    try {
        const { initScheduler } = require('./src/engine/scheduler');
        await initScheduler(kernel.container);
    } catch (error) {
        kernel.container.get('logger')?.error?.(
            'Error initializing agent scheduler:',
            error.message
        );
    }

    
}).catch((error) => {
    console.error('Error booting kernel:', error);
});
