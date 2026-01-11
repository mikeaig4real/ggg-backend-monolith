const { Client } = require( 'pg' );
require( 'dotenv' ).config();

const client = new Client( {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT === undefined ? 5432 : +process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'Mikeaig4real',
    database: process.env.POSTGRES_DB || 'ggg_wallet_db',
} );

async function describeTable ()
{
    try
    {
        await client.connect();
        const res = await client.query( `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'wallets';
    `);

        console.log( 'Columns in wallets table:' );
        res.rows.forEach( row =>
        {
            console.log( `- ${ row.column_name } (${ row.data_type })` );
        } );
    } catch ( err )
    {
        console.error( 'Error describing table:', err );
    } finally
    {
        await client.end();
    }
}

describeTable();
