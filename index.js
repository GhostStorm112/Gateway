require('bluebird')
require('dotenv').config()
const GhostGateway = require('ghost-gateway')
const path = require('path')
const git = require('git-rev-sync')
const info = require('./package.json')
const gateway = new GhostGateway({
  amqpUrl: process.env.AMQP_URL,
  redisUrl: process.env.REDIS_URL,
  token: process.env.TOKEN,
  botId: process.env.BOT_ID,
  lavalinkPassword: process.env.LAVALINK_PASSWORD,
  lavalinkRest: process.env.LAVALINK_REST,
  lavalinkWs: process.env.LAVALINK_WS,
  statsHost: process.env.STATS_HOST,
  statsPort: process.env.STATS_PORT,
  statsPrefix: process.env.STATS_PREFIX,
  firstShard: 0,
  lastShard: 1,
  numShards: 2,
  eventPath: path.join(__dirname, './eventHandlers/'),
  requestPath: path.join(__dirname, './requestHandlers/')
})

async function run () {
  gateway.log.mode = 1
  gateway.log.info('Gateway', `
   _____ _    _  ____   _____ _______
  / ____| |  | |/ __ \\ / ____|__   __|
 | |  __| |__| | |  | | (___    | |
 | | |_ |  __  | |  | |\\___ \\   | |
 | |__| | |  | | |__| |____) |  | |
  \\_____|_|  |_|\\____/|_____/   |_|
    
    Version: ${info.version} By: ${info.author}

    Commit ID: ${git.short()} Branch: ${git.branch()}
  `)

  gateway.log.info('Gateway', `Starting gateway ${gateway.id}`)
  gateway.initialize()
  gateway.on('error', error => gateway.log.error('ERROR', error))
  gateway.bot.on('error', error => gateway.log.error('ERROR', error))

}
run().catch(error => gateway.log.error('STARTUP', error))

