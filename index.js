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
  lastShard: 0,
  numShards: 1,
  eventPath: path.join(__dirname, './requestHandlers/')
})
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

gateway.bot.on('ready', () => {
  gateway.log.info('Gateway', 'Connected to Discord gateway')
  setInterval(
    async () => {
      const shards = []
      for (const shard in gateway.bot.shardManager.shards) {
        shards[shard] = { shard_id: gateway.bot.shardManager.shards[shard].id, shard_status: gateway.bot.shardManager.shards[shard].connector.status, shard_event: gateway.bot.shardManager.shards[shard].connector.seq }
      }
      await gateway.cache.storage.set('shards', shards)
    }
    , 5000)
})

gateway.bot.on('shardReady', event => {
  gateway.bot.shardStatusUpdate(event.id, { status: 'online', game: { name: `Shard: ${event.id} || ==help`, type: 0 } })
  gateway.log.info('Gateway', 'Shard: ' + event.id + ' joined the hive')
  gateway.log.debug('Gateway', `Starting recover for ${event.id}`)
  gateway.workerConnector.sendToQueue({
    t: 'LAVALINK_RECOVER',
    d: {
      shard_amount: 2,
      gateway: gateway.id,
      shard: event.id
    }
  })
})

gateway.bot.on('disconnected', () => { gateway.log.info('Gateway', 'All shards disconnected succesfully') })

gateway.bot.on('event', event => {
  if(event.d.author){ if (event.d.author.bot || event.d.author.id === process.env.BOT_ID) { return }}
  switch (event.t) {
    case 'VOICE_SERVER_UPDATE':
      gateway.lavalink.voiceServerUpdate(event.d)
      break
    case 'VOICE_STATE_UPDATE':
      gateway.cache.actions.voiceStates.upsert(event.d)
      gateway.lavalink.voiceStateUpdate(event.d)
      break
  }
  if (event.t !== 'PRESENCE_UPDATE') {
    gateway.stats.increment('discordevent', 1, 1, [`shard:${event.shard_id}`, `event:${event.t}`], (error) => {
      if (error) {
        this.client.log.error('Gateway-event', error)
      }
    })
    gateway.log.debug(`EVENT-${event.shard_id}`, event.t)
    if (event.d) { 
      event.d['type'] = event.t 
      event.d['gateway'] = gateway.id
    }
    gateway.workerConnector.sendToQueue(event)
  }
})
