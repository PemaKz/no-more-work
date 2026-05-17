const { Kernel } = require('zyket');

const kernel = new Kernel({
	services: [
		['auth', require('./src/services/auth'), ["@service_container"]],
	]
});

kernel.boot().then(async () => {
    console.log('Kernel booted successfully!');

    // Auto-sync de modelos Sequelize en dev. Para producción, sustituir por
    // migraciones (database.runMigrations()).
    try {
        const db = kernel.container.get('database');
        const isSqlite = process.env.DATABASE_DIALECT === 'sqlite';
        if (db) {
            // SQLite no soporta ALTER TABLE para muchos cambios. Sequelize lo
            // emula creando una tabla <name>_backup, copiando datos, dropeando
            // la original y renombrando. Esto tiene DOS problemas en SQLite:
            //   1) Si un sync anterior se interrumpió a mitad (crash, ^C),
            //      quedan _backup huérfanos → próximo sync peta con
            //      "UNIQUE constraint failed: <name>_backup.id".
            //   2) El DROP de la tabla original viola las FK de tablas hijas
            //      (agents, zone_contexts, …) → "FOREIGN KEY constraint failed".
            // Soluciones: borrar backups huérfanos + desactivar FK durante sync.
            if (isSqlite) {
                try {
                    const [rows] = await db.sequelize.query(
                        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%\\_backup' ESCAPE '\\'"
                    );
                    for (const row of rows) {
                        await db.sequelize.query(`DROP TABLE IF EXISTS \`${row.name}\``);
                        kernel.container.get('logger').warn(
                            `Dropped stale sync backup table: ${row.name}`
                        );
                    }
                } catch (cleanupErr) {
                    kernel.container.get('logger').warn(
                        'Failed to clean stale backup tables:',
                        cleanupErr.message
                    );
                }
                await db.sequelize.query('PRAGMA foreign_keys = OFF');
            }

            try {
                // `{ alter: true }` añade columnas/índices nuevos sin destruir
                // datos existentes — útil en dev. Para producción, usar Umzug.
                await db.sequelize.sync({ alter: true });
                kernel.container.get('logger').info(
                    `Database synced: ${Object.keys(db.models).join(', ') || '(no models)'}`
                );
            } finally {
                if (isSqlite) {
                    await db.sequelize.query('PRAGMA foreign_keys = ON');
                }
            }
        }
    } catch (error) {
        console.error('Error syncing database:', error);
    }
}).catch((error) => {
    console.error('Error booting kernel:', error);
});
