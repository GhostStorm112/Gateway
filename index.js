require('bluebird')
require('dotenv').config()
const GhostGateway = require('ghost-gateway')
const path = require('path')
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

gateway.log.info('Gateway', 'Starting gateway')

gateway.initialize()
gateway.on('error', error => gateway.log.error('ERROR', error))
gateway.bot.on('error', error => gateway.log.error('ERROR', error))
/* const object = { d:
  { guild_id: '268807882059939840',
    attachments: [],
    author:
     { avatar: 'f37ad54f3bd57c5848be2c14945c281a',
       discriminator: '3460',
       id: '167927608191746048',
       username: '112' },
    channel_id: '268807882059939840',
    content: '==test',
    edited_timestamp: null,
    embeds: [],
    id: '500220744777596930',
    member:
     { deaf: false,
       joined_at: '2017-01-11T18:26:33.296000+00:00',
       mute: false,
       nick: null,
       roles: [Array] },
    mention_everyone: false,
    mention_roles: [],
    mentions: [],
    nonce: '500220744119091200',
    pinned: false,
    timestamp: '2018-10-12T08:18:39.207000+00:00',
    tts: false,
    type: 0 },
op: 0,
s: 6,
t: 'MESSAGE_CREATE',
shard_id: 0 } */
gateway.bot.on('ready', () => {
  gateway.log.info('Gateway', 'Connected to Discord gateway')
  /*   let count = 0
  setInterval(async () => {
    console.log(`Sending number ${count}`)
    object.d['nonce'] = count

    gateway.workerConnector.sendToQueue(object)
    count++
  }, 20) */
  setInterval(
    async () => {
      const shards = []
      for (const shard in gateway.bot.shardManager.shards) {
        // console.log({ shard_id: gateway.bot.shardManager.shards[shard].id, shard_status: gateway.bot.shardManager.shards[shard].connector.status, shard_event: gateway.bot.shardManager.shards[shard].connector.seq })
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
      shard: event.id
    }
  })
})

gateway.bot.on('disconnected', () => { gateway.log.info('Gateway', 'All shards disconnected succesfully') })

gateway.bot.on('event', event => {
  if(event.d.author){ if (event.d.author.bot || event.d.author.id === process.env.BOT_ID) { return }}
  gateway.stats.increment('discordevent', 1, 1, [`shard:${event.shard_id}`, `event:${event.t}`], (error) => {
    if (error) {
      this.client.log.error('Gateway-event', error)
    }
  })
  if (event.t !== 'PRESENCE_UPDATE') {
    gateway.stats.increment('discordevent.np', 1, 1, [`shard:${event.shard_id}`, `event:${event.t}`], (error) => {
      if (error) {
        this.client.log.error('Gateway-event', error)
      }
    })
  }
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
    gateway.log.debug(`EVENT-${event.shard_id}`, event.t)
    if (event.d) { event.d['type'] = event.t }
    gateway.workerConnector.sendToQueue(event)
  }
})
